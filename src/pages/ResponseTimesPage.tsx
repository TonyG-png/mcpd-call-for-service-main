import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, Clock, Zap, Timer, SlidersHorizontal } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { getDateRangeBounds, getDateRangeOptions } from "@/lib/dateRanges";
import { fetchResponseTimeData, formatSeconds, ResponseTimeRecord } from "@/services/responseTimeService";
import type { DateRangeOption } from "@/types/incident";

interface BenchmarkMetric {
  average_seconds: number | null;
  valid_count: number;
}

interface AnnualResponseTimeBenchmark {
  year: number;
  record_count: number;
  call_to_dispatch: BenchmarkMetric;
  dispatch_to_arrival: BenchmarkMetric;
  call_to_arrival: BenchmarkMetric;
  by_priority?: Record<string, Omit<AnnualResponseTimeBenchmark, "year" | "by_priority">>;
}

interface ResponseTimeBenchmarks {
  generated_at: string;
  benchmark_type: string;
  excludes_tru_calls: boolean;
  excludes_detail_calls?: boolean;
  years: number[];
  annual: AnnualResponseTimeBenchmark[];
  annual_by_priority?: Record<string, AnnualResponseTimeBenchmark[]>;
  three_year_average: {
    call_to_dispatch: BenchmarkMetric;
    dispatch_to_arrival: BenchmarkMetric;
    call_to_arrival: BenchmarkMetric;
  };
  three_year_average_by_priority?: Record<string, {
    call_to_dispatch: BenchmarkMetric;
    dispatch_to_arrival: BenchmarkMetric;
    call_to_arrival: BenchmarkMetric;
  }>;
}

export default function ResponseTimesPage() {
  const [data, setData] = useState<ResponseTimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dateRange, setDateRange] = useState<DateRangeOption>(28);
  const [priority, setPriority] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [beat, setBeat] = useState<string>("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [benchmarks, setBenchmarks] = useState<ResponseTimeBenchmarks | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    fetch("/data/response-time-annual-benchmarks.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Benchmark fetch failed: ${response.status}`);
        return response.json() as Promise<ResponseTimeBenchmarks>;
      })
      .then((payload) => {
        if (!cancelled) setBenchmarks(payload);
      })
      .catch((e: unknown) => {
        if (!cancelled) setBenchmarkError(e instanceof Error ? e.message : "Unable to load response time benchmarks");
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const activeBenchmarks = useMemo(
    () => getResponseBenchmarksForPriority(benchmarks, priority),
    [benchmarks, priority],
  );

  const dateButtons = useMemo(() => getDateRangeOptions(), []);
  const activeResponseFilters = [priority, district, beat].filter(Boolean).length;
  const renderResponseDateButtons = (isMobile = false) => (
    <div className="flex items-center gap-1 rounded-lg bg-secondary p-0.5">
      {dateButtons.map((btn) => (
        <button
          key={btn.value}
          onClick={() => setDateRange(btn.value)}
          className={`${isMobile ? "px-2.5 py-2" : "px-3 py-1.5"} rounded-md text-xs font-medium transition-colors ${
            dateRange === btn.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );

  const renderResponseFilterSelects = (isMobile = false) => (
    <>
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className={`${isMobile ? "h-10 w-full" : "h-8"} rounded-md border border-border bg-card px-3 text-xs text-foreground`}
      >
        <option value="">All Priorities</option>
        {priorities.map((p) => (
          <option key={p} value={p}>Priority {p}</option>
        ))}
      </select>

      <select
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
        className={`${isMobile ? "h-10 w-full" : "h-8"} rounded-md border border-border bg-card px-3 text-xs text-foreground`}
      >
        <option value="">All Districts</option>
        {districts.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      <select
        value={beat}
        onChange={(e) => setBeat(e.target.value)}
        className={`${isMobile ? "h-10 w-full" : "h-8"} rounded-md border border-border bg-card px-3 text-xs text-foreground`}
      >
        <option value="">All Beats</option>
        {beats.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Sticky filters */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="hidden flex-wrap items-center gap-3 md:flex">
          {renderResponseDateButtons()}
          {renderResponseFilterSelects()}
          <span className="ml-auto text-[10px] text-muted-foreground">
            {filtered.length.toLocaleString()} records
          </span>
        </div>

        <div className="space-y-2 md:hidden">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-x-auto">
              {renderResponseDateButtons(true)}
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeResponseFilters > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                  {activeResponseFilters}
                </span>
              )}
            </button>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {filtered.length.toLocaleString()} records
          </div>
          {mobileFiltersOpen && (
            <div className="grid gap-2">
              {renderResponseFilterSelects(true)}
            </div>
          )}
        </div>
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
          <div className="dashboard-card p-4 text-xs text-muted-foreground">
            Response-time assessment excludes Telephone Reporting Unit/TRS calls and DT-Detail calls. Annual benchmark averages are countywide.
          </div>

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

          <ResponseTimeBenchmarkPanel
            benchmarks={activeBenchmarks}
            error={benchmarkError}
            priority={priority}
            current={{
              callToDispatch: { average: avgCallToDispatch, count: validCallToDispatch.length },
              dispatchToArrive: { average: avgDispatchToArrive, count: validDispatchToArrive.length },
              callToArrive: { average: avgCallToArrive, count: validCallToArrive.length },
            }}
          />

          {/* Rolling Average Chart */}
          <div className="dashboard-card p-4 animate-fade-in">
            <h3 className="text-sm font-semibold font-display mb-1">Daily Average Response Times</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Rolling daily averages (mm:ss), excluding Telephone Reporting Unit/TRS and DT-Detail calls.
            </p>
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

function ResponseTimeBenchmarkPanel({
  benchmarks,
  error,
  priority,
  current,
}: {
  benchmarks: ResponseTimeBenchmarks | null;
  error: string | null;
  priority: string;
  current: {
    callToDispatch: { average: number; count: number };
    dispatchToArrive: { average: number; count: number };
    callToArrive: { average: number; count: number };
  };
}) {
  if (error) {
    return (
      <div className="dashboard-card p-4 text-sm text-destructive">
        Unable to load response-time benchmarks: {error}
      </div>
    );
  }

  if (!benchmarks) {
    return (
      <div className="dashboard-card p-4 text-sm text-muted-foreground">
        Loading annual response-time benchmarks...
      </div>
    );
  }

  const comparisons = [
    {
      label: "Call -> Dispatch",
      current: current.callToDispatch,
      benchmark: benchmarks.three_year_average.call_to_dispatch,
    },
    {
      label: "Dispatch -> Arrival",
      current: current.dispatchToArrive,
      benchmark: benchmarks.three_year_average.dispatch_to_arrival,
    },
    {
      label: "Call -> On Scene",
      current: current.callToArrive,
      benchmark: benchmarks.three_year_average.call_to_arrival,
    },
  ];

  return (
    <div className="dashboard-card p-4 animate-fade-in">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold font-display">Annual Response-Time Benchmarks</h3>
          <p className="text-xs text-muted-foreground">
            Current filtered period compared with {benchmarks.years.join(", ")} countywide {priority ? `Priority ${priority}` : "all-priority"} annual averages, excluding Telephone Reporting Unit/TRS and DT-Detail calls.
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Updated {formatBenchmarkDate(benchmarks.generated_at)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {comparisons.map((item) => (
          <div key={item.label} className="rounded-md border border-border p-3">
            <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <div>
                <div className="text-xl font-bold font-display">{formatSeconds(item.current.average)}</div>
                <div className="text-[10px] text-muted-foreground">
                  Current, {item.current.count.toLocaleString()} records
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{formatBenchmarkMetric(item.benchmark)}</div>
                <div className="text-[10px] text-muted-foreground">
                  countywide {priority ? `Priority ${priority}` : ""} 3-year avg
                </div>
              </div>
            </div>
            <div className={`mt-3 text-xs font-medium ${getComparisonClass(item.current.average, item.benchmark.average_seconds)}`}>
              {formatComparison(item.current.average, item.benchmark.average_seconds)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:hidden">
        {benchmarks.annual.map((year) => (
          <ResponseAnnualMobileCard key={year.year} year={year} />
        ))}
      </div>

      <div className="mt-4 hidden overflow-auto md:block">
        <table className="w-full min-w-[760px] text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Year</th>
              <th className="py-2 pr-3 font-medium">Countywide Call to Dispatch</th>
              <th className="py-2 pr-3 font-medium">Countywide Dispatch to Arrival</th>
              <th className="py-2 pr-3 font-medium">Countywide Call to On Scene</th>
              <th className="py-2 pr-3 text-right font-medium">Records</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.annual.map((year) => (
              <tr key={year.year} className="border-b border-border/50">
                <td className="py-2 pr-3 font-semibold">{year.year}</td>
                <td className="py-2 pr-3">{formatBenchmarkMetric(year.call_to_dispatch)}</td>
                <td className="py-2 pr-3">{formatBenchmarkMetric(year.dispatch_to_arrival)}</td>
                <td className="py-2 pr-3">{formatBenchmarkMetric(year.call_to_arrival)}</td>
                <td className="py-2 pr-3 text-right">{year.record_count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getResponseBenchmarksForPriority(
  benchmarks: ResponseTimeBenchmarks | null,
  priority: string,
): ResponseTimeBenchmarks | null {
  if (!benchmarks || !priority) return benchmarks;

  const annual = benchmarks.annual_by_priority?.[priority];
  const threeYearAverage = benchmarks.three_year_average_by_priority?.[priority];
  if (!annual || !threeYearAverage) return benchmarks;

  return {
    ...benchmarks,
    annual,
    three_year_average: threeYearAverage,
  };
}

function ResponseAnnualMobileCard({ year }: { year: AnnualResponseTimeBenchmark }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
        <div className="text-sm font-semibold font-display">{year.year}</div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Records</div>
          <div className="text-sm font-bold">{year.record_count.toLocaleString()}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-xs">
        <MobileResponseBenchmarkStat label="Countywide Call to Dispatch" value={formatBenchmarkMetric(year.call_to_dispatch)} />
        <MobileResponseBenchmarkStat label="Countywide Dispatch to Arrival" value={formatBenchmarkMetric(year.dispatch_to_arrival)} />
        <MobileResponseBenchmarkStat label="Countywide Call to On Scene" value={formatBenchmarkMetric(year.call_to_arrival)} />
      </div>
    </div>
  );
}

function MobileResponseBenchmarkStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function formatBenchmarkMetric(metric: BenchmarkMetric) {
  return metric.average_seconds == null ? "-" : formatSeconds(metric.average_seconds);
}

function formatComparison(currentAverage: number, benchmarkAverage: number | null) {
  if (!benchmarkAverage || currentAverage <= 0) return "Not enough data to compare";

  const delta = currentAverage - benchmarkAverage;
  const pct = Math.abs(delta / benchmarkAverage) * 100;
  if (pct < 5) return "Stable vs 3-year average";
  return `${pct.toFixed(1)}% ${delta > 0 ? "slower" : "faster"} than 3-year average`;
}

function getComparisonClass(currentAverage: number, benchmarkAverage: number | null) {
  if (!benchmarkAverage || currentAverage <= 0) return "text-muted-foreground";
  const deltaPct = (currentAverage - benchmarkAverage) / benchmarkAverage;
  if (Math.abs(deltaPct) < 0.05) return "text-muted-foreground";
  return deltaPct > 0 ? "text-destructive" : "text-emerald-500";
}

function formatBenchmarkDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}
