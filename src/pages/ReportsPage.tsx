import { useMemo } from "react";
import { FileText, Car, Activity } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { useData } from "@/context/DataContext";
import MetricCard from "@/components/dashboard/MetricCard";
import ChartCard from "@/components/dashboard/ChartCard";
import { isTruCallType } from "@/lib/callTypes";
import { NormalizedIncident } from "@/types/incident";

const hasValue = (v: unknown): boolean =>
  v !== undefined && v !== null && String(v).trim() !== "";

const isCrime = (i: NormalizedIncident) => hasValue(i.crNumber);
const isCrash = (i: NormalizedIncident) => hasValue(i.crashReport);
const reportCount = (i: NormalizedIncident) => (isCrime(i) ? 1 : 0) + (isCrash(i) ? 1 : 0);
const isTruReport = (i: NormalizedIncident) => isTruCallType(i.callType);

export default function ReportsPage() {
  const { filteredIncidents, isLoading, availableFields } = useData();

  const showCrime = availableFields.has("crNumber");
  const showCrash = availableFields.has("crashReport");

  const stats = useMemo(() => {
    const total = filteredIncidents.length;
    const crime = filteredIncidents.filter(isCrime).length;
    const crash = filteredIncidents.filter(isCrash).length;
    const callsWithReport = filteredIncidents.filter((i) => isCrime(i) || isCrash(i)).length;
    const reportRate = total > 0 ? (callsWithReport / total) * 100 : 0;
    return { total, crime, crash, callsWithReport, reportRate };
  }, [filteredIncidents]);

  const dailyData = useMemo(() => {
    const map = new Map<string, { crime: number; crash: number }>();
    for (const i of filteredIncidents) {
      if (!i.startTime) continue;
      const day = i.startTime.toISOString().slice(0, 10);
      const e = map.get(day) || { crime: 0, crash: 0 };
      if (isCrime(i)) e.crime++;
      if (isCrash(i)) e.crash++;
      map.set(day, e);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        label: new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        crime: v.crime,
        crash: v.crash,
      }));
  }, [filteredIncidents]);

  const byDistrict = useMemo(() => {
    const map = new Map<string, { crime: number; crash: number }>();
    for (const i of filteredIncidents) {
      const key = i.district || "Unknown";
      const e = map.get(key) || { crime: 0, crash: 0 };
      if (isCrime(i)) e.crime++;
      if (isCrash(i)) e.crash++;
      map.set(key, e);
    }
    return Array.from(map.entries())
      .map(([district, v]) => ({ district, ...v, total: v.crime + v.crash }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredIncidents]);

  const byCallType = useMemo(() => {
    const map = new Map<string, { crime: number; crash: number }>();
    for (const i of filteredIncidents) {
      const key = i.callType || "Unknown";
      const e = map.get(key) || { crime: 0, crash: 0 };
      if (isCrime(i)) e.crime++;
      if (isCrash(i)) e.crash++;
      map.set(key, e);
    }
    return Array.from(map.entries())
      .map(([callType, v]) => ({ callType, ...v, total: v.crime + v.crash }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredIncidents]);

  const byReportChannel = useMemo(() => {
    const channels = {
      TRU: { channel: "TRU", crime: 0, crash: 0, total: 0 },
      Patrol: { channel: "Patrol", crime: 0, crash: 0, total: 0 },
    };

    for (const i of filteredIncidents) {
      const reports = reportCount(i);
      if (reports === 0) continue;

      const entry = isTruReport(i) ? channels.TRU : channels.Patrol;
      if (isCrime(i)) entry.crime++;
      if (isCrash(i)) entry.crash++;
      entry.total += reports;
    }

    return [channels.TRU, channels.Patrol];
  }, [filteredIncidents]);

  const truPatrolStats = useMemo(() => {
    const tru = byReportChannel.find((r) => r.channel === "TRU")?.total || 0;
    const patrol = byReportChannel.find((r) => r.channel === "Patrol")?.total || 0;
    return { tru, patrol, total: tru + patrol };
  }, [byReportChannel]);

  const pctOfCalls = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}% of calls` : undefined);
  const pctValue = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "0.0%");
  const pctOfReportCalls = (n: number, d: number) =>
    d > 0 ? `${((n / d) * 100).toFixed(1)}% of report calls` : undefined;

  if (isLoading && filteredIncidents.length === 0) {
    return <div className="text-sm text-muted-foreground py-12 text-center">Loading reports…</div>;
  }

  if (!showCrime && !showCrash) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">
        No report fields available in this dataset.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-display">Reports</h2>
        <p className="text-xs text-muted-foreground">
          Crime reports and crash reports written for calls in the selected window.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Calls"
          value={stats.total.toLocaleString()}
          subtitle="In current filter window"
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          title="Calls With Reports"
          value={`${stats.reportRate.toFixed(1)}%`}
          subtitle={`${stats.callsWithReport.toLocaleString()} calls resulted in a report`}
          icon={<FileText className="h-4 w-4" />}
        />
        {showCrime && (
          <MetricCard
            title="Crime Reports"
            value={stats.crime.toLocaleString()}
            subtitle={pctOfCalls(stats.crime, stats.total)}
            icon={<FileText className="h-4 w-4" />}
          />
        )}
        {showCrash && (
          <MetricCard
            title="Crash Reports"
            value={stats.crash.toLocaleString()}
            subtitle={pctOfCalls(stats.crash, stats.total)}
            icon={<Car className="h-4 w-4" />}
          />
        )}
      </div>

      {/* Daily trend */}
      <ChartCard title="Reports Written per Day" subtitle="Daily count by report type">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                allowDecimals={false}
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
                  value.toLocaleString(),
                  name === "crime" ? "Crime Reports" : "Crash Reports",
                ]}
              />
              <Legend
                formatter={(v: string) => (v === "crime" ? "Crime Reports" : "Crash Reports")}
                wrapperStyle={{ fontSize: 12 }}
              />
              {showCrime && (
                <Line type="monotone" dataKey="crime" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              )}
              {showCrash && (
                <Line type="monotone" dataKey="crash" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="TRU Report Share"
          value={pctValue(truPatrolStats.tru, truPatrolStats.total)}
          subtitle={`${truPatrolStats.tru.toLocaleString()} of ${truPatrolStats.total.toLocaleString()} reports`}
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          title="TRU Reports"
          value={truPatrolStats.tru.toLocaleString()}
          subtitle={pctOfReportCalls(truPatrolStats.tru, truPatrolStats.total)}
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          title="Patrol Reports"
          value={truPatrolStats.patrol.toLocaleString()}
          subtitle={pctOfReportCalls(truPatrolStats.patrol, truPatrolStats.total)}
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          title="Total Written Reports"
          value={truPatrolStats.total.toLocaleString()}
          subtitle="Crime plus crash reports"
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      <ChartCard
        title="TRU vs Patrol Reports"
        subtitle="TRU is classified by call-type codes ending in T; all other report calls are Patrol"
      >
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byReportChannel} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="channel"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                allowDecimals={false}
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
                  value.toLocaleString(),
                  name === "crime" ? "Crime Reports" : "Crash Reports",
                ]}
              />
              <Legend
                formatter={(v: string) => (v === "crime" ? "Crime Reports" : "Crash Reports")}
                wrapperStyle={{ fontSize: 12 }}
              />
              {showCrime && <Bar dataKey="crime" stackId="reports" fill="hsl(var(--primary))" />}
              {showCrash && <Bar dataKey="crash" stackId="reports" fill="hsl(var(--chart-4))" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Reports by District" subtitle="Top 10 districts">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDistrict} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  type="category"
                  dataKey="district"
                  width={80}
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
                    value.toLocaleString(),
                    name === "crime" ? "Crime Reports" : "Crash Reports",
                  ]}
                />
                <Legend
                  formatter={(v: string) => (v === "crime" ? "Crime Reports" : "Crash Reports")}
                  wrapperStyle={{ fontSize: 12 }}
                />
                {showCrime && <Bar dataKey="crime" stackId="a" fill="hsl(var(--primary))" />}
                {showCrash && <Bar dataKey="crash" stackId="a" fill="hsl(var(--chart-4))" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Reports by Call Type" subtitle="Top 10 call types">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCallType} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  type="category"
                  dataKey="callType"
                  width={140}
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
                    value.toLocaleString(),
                    name === "crime" ? "Crime Reports" : "Crash Reports",
                  ]}
                />
                <Legend
                  formatter={(v: string) => (v === "crime" ? "Crime Reports" : "Crash Reports")}
                  wrapperStyle={{ fontSize: 12 }}
                />
                {showCrime && <Bar dataKey="crime" stackId="a" fill="hsl(var(--primary))" />}
                {showCrash && <Bar dataKey="crash" stackId="a" fill="hsl(var(--chart-4))" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
