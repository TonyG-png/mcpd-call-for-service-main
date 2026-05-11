import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, Clock, Zap, Timer } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { getDateRangeBounds, getDateRangeOptions } from "@/lib/dateRanges";
import { fetchResponseTimeData, formatSeconds, ResponseTimeRecord } from "@/services/responseTimeService";
import type { DateRangeOption } from "@/types/incident";

export default function ResponseTimesPage() {
  const [data, setData] = useState<ResponseTimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dateRange, setDateRange] = useState<DateRangeOption>(28);
  const [priority, setPriority] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [beat, setBeat] = useState<string>("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    try {
      const records = await fetchResponseTimeData(dateRange, setProgress);
      setData(records);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load response time data");
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  // Available priorities
  const priorities = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => { if (r.priority != null) set.add(r.priority); });
    return Array.from(set).sort();
  }, [data]);

  // Available districts
  const districts = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => { if (r.district != null) set.add(r.district); });
    return Array.from(set).sort();
  }, [data]);

  // Available beats
  const beats = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => {
      if (r.beat != null && (!district || r.district === district)) set.add(r.beat);
    });
    return Array.from(set).sort();
  }, [data, district]);

  useEffect(() => {
    if (beat && !beats.includes(beat)) setBeat("");
  }, [beat, beats]);

  // Filter data
  const filtered = useMemo(() => {
    const range = getDateRangeBounds(dateRange);
    return data.filter((r) => {
      if (!r.dispatch_date_time) return false;
      const dispatchDate = new Date(r.dispatch_date_time);
      if (dispatchDate < range.start) return false;
      if (range.end && dispatchDate >= range.end) return false;
      if (priority && r.priority !== priority) return false;
      if (district && r.district !== district) return false;
      if (beat && r.beat !== beat) return false;
      return true;
    });
  }, [data, dateRange, priority, district, beat]);

  // Valid records (non-zero, non-null)
  const validCallToDispatch = useMemo(
    () => filtered.filter((r) => r.calltime_dispatch != null && r.calltime_dispatch > 0),
    [filtered]
  );
  const validDispatchToArrive = useMemo(
    () => filtered.filter((r) => r.dispatch_arrive != null && r.dispatch_arrive > 0),
    [filtered]
  );

  // Records with BOTH segments valid → end-to-end (call answered → on scene)
  const validCallToArrive = useMemo(
    () =>
      filtered.filter(
        (r) =>
          r.calltime_dispatch != null && r.calltime_dispatch > 0 &&
          r.dispatch_arrive != null && r.dispatch_arrive > 0
      ),
    [filtered]
  );

  // KPI averages
  const avgCallToDispatch = useMemo(() => {
    if (!validCallToDispatch.length) return 0;
    return validCallToDispatch.reduce((s, r) => s + r.calltime_dispatch!, 0) / validCallToDispatch.length;
  }, [validCallToDispatch]);

  const avgDispatchToArrive = useMemo(() => {
    if (!validDispatchToArrive.length) return 0;
    return validDispatchToArrive.reduce((s, r) => s + r.dispatch_arrive!, 0) / validDispatchToArrive.length;
  }, [validDispatchToArrive]);

  const avgCallToArrive = useMemo(() => {
    if (!validCallToArrive.length) return 0;
    return (
      validCallToArrive.reduce((s, r) => s + r.calltime_dispatch! + r.dispatch_arrive!, 0) /
      validCallToArrive.length
    );
  }, [validCallToArrive]);

  // Rolling daily averages for chart
  const chartData = useMemo(() => {
    const dayMap = new Map<
      string,
      { ctdSum: number; ctdCount: number; dtaSum: number; dtaCount: number; ctaSum: number; ctaCount: number }
    >();

    for (const r of filtered) {
      if (!r.dispatch_date_time) continue;
      const day = r.dispatch_date_time.substring(0, 10);
      const entry = dayMap.get(day) || { ctdSum: 0, ctdCount: 0, dtaSum: 0, dtaCount: 0, ctaSum: 0, ctaCount: 0 };
      if (r.calltime_dispatch != null && r.calltime_dispatch > 0) {
        entry.ctdSum += r.calltime_dispatch;
        entry.ctdCount++;
      }
      if (r.dispatch_arrive != null && r.dispatch_arrive > 0) {
        entry.dtaSum += r.dispatch_arrive;
        entry.dtaCount++;
      }
      if (
        r.calltime_dispatch != null && r.calltime_dispatch > 0 &&
        r.dispatch_arrive != null && r.dispatch_arrive > 0
      ) {
        entry.ctaSum += r.calltime_dispatch + r.dispatch_arrive;
        entry.ctaCount++;
      }
      dayMap.set(day, entry);
    }

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        label: new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        callToDispatch: v.ctdCount > 0 ? v.ctdSum / v.ctdCount : null,
        dispatchToArrive: v.dtaCount > 0 ? v.dtaSum / v.dtaCount : null,
        callToArrive: v.ctaCount > 0 ? v.ctaSum / v.ctaCount : null,
      }));
  }, [filtered]);

  const dateButtons = useMemo(() => getDateRangeOptions(), []);

  return (
    <div className="space-y-6">
      {/* Sticky filters */}
      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
          {dateButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setDateRange(btn.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                dateRange === btn.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-8 px-3 text-xs rounded-md border border-border bg-card text-foreground"
        >
          <option value="">All Priorities</option>
          {priorities.map((p) => (
            <option key={p} value={p}>Priority {p}</option>
          ))}
        </select>

        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="h-8 px-3 text-xs rounded-md border border-border bg-card text-foreground"
        >
          <option value="">All Districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={beat}
          onChange={(e) => setBeat(e.target.value)}
          className="h-8 px-3 text-xs rounded-md border border-border bg-card text-foreground"
        >
          <option value="">All Beats</option>
          {beats.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <span className="text-[10px] text-muted-foreground ml-auto">
          {filtered.length.toLocaleString()} records
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Loading… {progress > 0 ? `${progress.toLocaleString()} records` : "Connecting…"}
          </span>
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-destructive text-sm">{error}</div>
      )}

      {!isLoading && !error && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="dashboard-card p-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Avg Call → Dispatch</p>
                  <p className="text-2xl font-bold font-display text-foreground">
                    {formatSeconds(avgCallToDispatch)}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Based on {validCallToDispatch.length.toLocaleString()} valid records
              </p>
            </div>

            <div className="dashboard-card p-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Avg Dispatch → Arrival</p>
                  <p className="text-2xl font-bold font-display text-foreground">
                    {formatSeconds(avgDispatchToArrive)}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Based on {validDispatchToArrive.length.toLocaleString()} valid records
              </p>
            </div>

            <div className="dashboard-card p-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <Timer className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Avg Call → On Scene</p>
                  <p className="text-2xl font-bold font-display text-foreground">
                    {formatSeconds(avgCallToArrive)}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Based on {validCallToArrive.length.toLocaleString()} valid records
              </p>
            </div>
          </div>

          {/* Rolling Average Chart */}
          <div className="dashboard-card p-4 animate-fade-in">
            <h3 className="text-sm font-semibold font-display mb-1">Daily Average Response Times</h3>
            <p className="text-xs text-muted-foreground mb-4">Rolling daily averages (mm:ss), excluding TRU calls</p>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatSeconds(v)}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number, name: string) => [
                      formatSeconds(value),
                      name === "callToDispatch"
                        ? "Call → Dispatch"
                        : name === "dispatchToArrive"
                        ? "Dispatch → Arrival"
                        : "Call → On Scene",
                    ]}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === "callToDispatch"
                        ? "Call → Dispatch"
                        : value === "dispatchToArrive"
                        ? "Dispatch → Arrival"
                        : "Call → On Scene"
                    }
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="callToDispatch"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="dispatchToArrive"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="callToArrive"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
