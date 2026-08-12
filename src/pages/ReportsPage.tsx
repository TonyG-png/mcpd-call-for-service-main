import { useMemo, useState } from "react";
import { FileText, Car, Activity, BarChart3, Clock3, Info, Timer } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { useData } from "@/context/DataContext";
import MetricCard from "@/components/dashboard/MetricCard";
import ChartCard from "@/components/dashboard/ChartCard";
import { isTelephoneReportingUnitCallType } from "@/lib/callTypes";
import { NormalizedIncident } from "@/types/incident";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getDateRangeBounds } from "@/lib/dateRanges";

const hasValue = (v: unknown): boolean =>
  v !== undefined && v !== null && String(v).trim() !== "";

const isCrime = (i: NormalizedIncident) => hasValue(i.crNumber);
const isCrash = (i: NormalizedIncident) => hasValue(i.crashReport);
const reportCount = (i: NormalizedIncident) => (isCrime(i) ? 1 : 0) + (isCrash(i) ? 1 : 0);
const isTruReport = (i: NormalizedIncident) => isTelephoneReportingUnitCallType(i.rawCallType || i.callType);
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CHART_TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

type ReportView = "overview" | "tru";

interface TruDurationRecord {
  incident: NormalizedIncident;
  seconds: number;
}

export default function ReportsPage() {
  const { filteredIncidents, filters, isLoading, availableFields, columns } = useData();
  const [view, setView] = useState<ReportView>("overview");

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
      .slice(0, 5);
  }, [filteredIncidents]);

  const byReportChannel = useMemo(() => {
    const channels = {
      TRU: { channel: "TRU", crime: 0, crash: 0, total: 0 },
      nonTru: { channel: "Non-TRU Code", crime: 0, crash: 0, total: 0 },
    };

    for (const i of filteredIncidents) {
      const reports = reportCount(i);
      if (reports === 0) continue;

      const entry = isTruReport(i) ? channels.TRU : channels.nonTru;
      if (isCrime(i)) entry.crime++;
      if (isCrash(i)) entry.crash++;
      entry.total += reports;
    }

    return [channels.TRU, channels.nonTru];
  }, [filteredIncidents]);

  const truPatrolStats = useMemo(() => {
    const tru = byReportChannel.find((r) => r.channel === "TRU")?.total || 0;
    const patrol = byReportChannel.find((r) => r.channel === "Non-TRU Code")?.total || 0;
    return { tru, patrol, total: tru + patrol };
  }, [byReportChannel]);

  const handlerUnitColumns = useMemo(
    () => columns.filter((column) => looksLikeHandlerUnitField(column.fieldName, column.name, column.description)),
    [columns],
  );

  const topReportCallTypes = useMemo(() => {
    const tru = new Map<string, number>();
    const patrol = new Map<string, number>();

    for (const incident of filteredIncidents) {
      const reports = reportCount(incident);
      if (reports === 0) continue;

      const callType = incident.callType || "Unknown";
      const target = isTruReport(incident) ? tru : patrol;
      target.set(callType, (target.get(callType) || 0) + reports);
    }

    return {
      tru: getTopReportTypes(tru),
      patrol: getTopReportTypes(patrol),
    };
  }, [filteredIncidents]);

  const truAnalysis = useMemo(() => {
    const truCalls = filteredIncidents.filter(isTruReport);
    const uniqueCrimeReports = new Map<string, NormalizedIncident>();
    const truCrimeReports = new Map<string, NormalizedIncident>();
    const patrolCrimeReports = new Map<string, NormalizedIncident>();
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour: String(hour).padStart(2, "0"), calls: 0 }));
    const days = DAYS_OF_WEEK.map((day) => ({ day, calls: 0 }));
    const trendByDate = new Map<string, { truCalls: number; truReports: Set<string> }>();
    const typeCounts = new Map<string, number>();
    const durations: TruDurationRecord[] = [];

    for (const incident of filteredIncidents) {
      const crimeNumber = String(incident.crNumber || "").trim();
      const tru = isTruReport(incident);

      if (crimeNumber && !uniqueCrimeReports.has(crimeNumber)) {
        uniqueCrimeReports.set(crimeNumber, incident);
      }

      if (!tru) {
        if (crimeNumber && !patrolCrimeReports.has(crimeNumber)) patrolCrimeReports.set(crimeNumber, incident);
        continue;
      }

      if (crimeNumber && !truCrimeReports.has(crimeNumber)) truCrimeReports.set(crimeNumber, incident);
      if (incident.startTime) {
        hours[incident.startTime.getHours()].calls++;
        days[incident.startTime.getDay()].calls++;
        const date = incident.startTime.toISOString().slice(0, 10);
        const trend = trendByDate.get(date) || { truCalls: 0, truReports: new Set<string>() };
        trend.truCalls++;
        if (crimeNumber) trend.truReports.add(crimeNumber);
        trendByDate.set(date, trend);
      }

      const callType = incident.rawCallType || incident.callType || "Unknown";
      typeCounts.set(callType, (typeCounts.get(callType) || 0) + 1);

      const seconds = getCadTimeToClearedSeconds(incident);
      if (seconds !== null) durations.push({ incident, seconds });
    }

    const totalCrimeReports = uniqueCrimeReports.size;
    const truReportCount = truCrimeReports.size;
    const patrolReportCount = totalCrimeReports - truReportCount;
    const durationValues = durations.map((record) => record.seconds).sort((a, b) => a - b);
    const durationBuckets = [
      { label: "Under 1 hour", min: 0, max: 3600, calls: 0 },
      { label: "1-2 hours", min: 3600, max: 7200, calls: 0 },
      { label: "2-3 hours", min: 7200, max: 10800, calls: 0 },
      { label: "3-4 hours", min: 10800, max: 14400, calls: 0 },
      { label: "4+ hours", min: 14400, max: Number.POSITIVE_INFINITY, calls: 0 },
    ];
    durations.forEach(({ seconds }) => {
      durationBuckets.find((bucket) => seconds >= bucket.min && seconds < bucket.max)!.calls++;
    });

    const range = getDateRangeBounds(filters.dateRange, new Date(), filters.customStartDate, filters.customEndDate);
    const rangeEnd = range.end || new Date();
    const selectedDayCount = Math.max(1, Math.round((rangeEnd.getTime() - range.start.getTime()) / 86400000));

    const dailyTrend = Array.from(trendByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        calls: value.truCalls,
        reports: value.truReports.size,
      }));

    return {
      truCalls,
      totalCalls: filteredIncidents.length,
      callsWithReports: filteredIncidents.filter((incident) => isCrime(incident) || isCrash(incident)).length,
      truReportCount,
      patrolReportCount,
      totalCrimeReports,
      truReportShare: totalCrimeReports > 0 ? (truReportCount / totalCrimeReports) * 100 : 0,
      conversionRate: truCalls.length > 0 ? (truReportCount / truCalls.length) * 100 : 0,
      hours: hours.map((entry) => ({ ...entry, averageCalls: entry.calls / selectedDayCount })),
      selectedDayCount,
      days,
      dailyTrend,
      topTypes: Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10)
        .map(([type, count]) => ({ type, count, share: truCalls.length > 0 ? (count / truCalls.length) * 100 : 0 })),
      durations,
      averageSeconds: durationValues.length ? durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length : null,
      medianSeconds: durationValues.length ? getMedian(durationValues) : null,
      durationBuckets: durationBuckets.map((bucket) => ({
        ...bucket,
        share: durations.length ? (bucket.calls / durations.length) * 100 : 0,
      })),
      overThresholds: [3600, 7200, 10800, 14400].map((seconds) => ({
        seconds,
        calls: durations.filter((record) => record.seconds >= seconds).length,
        share: durations.length ? (durations.filter((record) => record.seconds >= seconds).length / durations.length) * 100 : 0,
      })),
      longestCalls: durations.sort((a, b) => b.seconds - a.seconds).slice(0, 10),
    };
  }, [filteredIncidents, filters.customEndDate, filters.customStartDate, filters.dateRange]);

  const pctOfCalls = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}% of calls` : undefined);
  const pctOfReportCalls = (n: number, d: number) =>
    d > 0 ? `${((n / d) * 100).toFixed(1)}% of report calls` : undefined;
  const pctOfTruEligibleReportCalls = (n: number, d: number) =>
    d > 0 ? `${((n / d) * 100).toFixed(1)}% of report calls are TRU-designated` : undefined;

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
          Event reports and crash reports associated with calls in the selected window.
        </p>
      </div>

      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(value) => value && setView(value as ReportView)}
        variant="outline"
        className="w-fit rounded-md border border-border bg-card p-1"
        aria-label="Report view"
      >
        <ToggleGroupItem value="overview" aria-label="Report overview" className="px-3 text-xs sm:text-sm">
          Report Overview
        </ToggleGroupItem>
        <ToggleGroupItem value="tru" aria-label="TRU analysis" className="px-3 text-xs sm:text-sm">
          TRU Analysis
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="dashboard-card p-4">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold font-display">TRU Designation Method</h3>
            <p className="text-xs text-muted-foreground">
              TRU-designated calls use the final call type and must explicitly include TRS or Telephone Reporting Unit.
              This public CFS feed does not include the handling officer, car number, or unit identifier, so it does not
              prove who completed a report.
            </p>
            {handlerUnitColumns.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Potential handler fields detected in this source: {handlerUnitColumns.map((column) => column.name).join(", ")}.
              </p>
            )}
          </div>
        </div>
      </div>

      {view === "tru" ? (
        <TruAnalysisView analysis={truAnalysis} />
      ) : (
        <>

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
            title="Event Reports"
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
                  name === "crime" ? "Event Reports" : "Crash Reports",
                ]}
              />
              <Legend
                formatter={(v: string) => (v === "crime" ? "Event Reports" : "Crash Reports")}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="TRU-Designated Reports"
          value={truPatrolStats.tru.toLocaleString()}
          subtitle={pctOfTruEligibleReportCalls(truPatrolStats.tru, truPatrolStats.total)}
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          title="Patrol Reports"
          value={truPatrolStats.patrol.toLocaleString()}
          subtitle={pctOfReportCalls(truPatrolStats.patrol, truPatrolStats.total)}
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          title="Total Written Event / Crash Reports"
          value={truPatrolStats.total.toLocaleString()}
          subtitle="Event plus crash reports"
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportTypeListCard
          title="Top 5 TRU-Designated Report Calls"
          items={topReportCallTypes.tru}
          emptyText="No TRU-designated report calls in the current filters."
        />
        <ReportTypeListCard
          title="Top 5 Patrol Report Calls"
          items={topReportCallTypes.patrol}
          emptyText="No patrol report calls in the current filters."
        />
      </div>

      <ChartCard
        title="TRU-Designated vs Patrol Reports"
        subtitle="This is based on final TRS designation, not handler car/unit, because the public CFS feed does not publish handler fields."
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
                  name === "crime" ? "Event Reports" : "Crash Reports",
                ]}
              />
              <Legend
                formatter={(v: string) => (v === "crime" ? "Event Reports" : "Crash Reports")}
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
                    name === "crime" ? "Event Reports" : "Crash Reports",
                  ]}
                />
                <Legend
                  formatter={(v: string) => (v === "crime" ? "Event Reports" : "Crash Reports")}
                  wrapperStyle={{ fontSize: 12 }}
                />
                {showCrime && <Bar dataKey="crime" stackId="a" fill="hsl(var(--primary))" />}
                {showCrash && <Bar dataKey="crash" stackId="a" fill="hsl(var(--chart-4))" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Reports by Call Type" subtitle="Top 5 call types">
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
                    name === "crime" ? "Event Reports" : "Crash Reports",
                  ]}
                />
                <Legend
                  formatter={(v: string) => (v === "crime" ? "Event Reports" : "Crash Reports")}
                  wrapperStyle={{ fontSize: 12 }}
                />
                {showCrime && <Bar dataKey="crime" stackId="a" fill="hsl(var(--primary))" />}
                {showCrash && <Bar dataKey="crash" stackId="a" fill="hsl(var(--chart-4))" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
        </>
      )}
    </div>
  );
}

function getTopReportTypes(callTypes: Map<string, number>) {
  return Array.from(callTypes.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));
}

function looksLikeHandlerUnitField(fieldName?: string, name?: string, description?: string) {
  const text = [fieldName, name, description].filter(Boolean).join(" ").toLowerCase();
  return /\b(primary unit|handling unit|responding unit|dispatched unit|assigned unit|unit id|unit number|car number|car no|officer|badge|employee id)\b/.test(text);
}

function getCadTimeToClearedSeconds(incident: NormalizedIncident) {
  const rawSeconds = Number(incident.raw.calltime_cleared);
  if (Number.isFinite(rawSeconds) && rawSeconds >= 0 && rawSeconds < 86400) return rawSeconds;

  if (incident.startTime && incident.endTime) {
    const seconds = (incident.endTime.getTime() - incident.startTime.getTime()) / 1000;
    if (seconds >= 0 && seconds < 86400) return seconds;
  }

  return null;
}

function getMedian(sortedValues: number[]) {
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[middle - 1] + sortedValues[middle]) / 2
    : sortedValues[middle];
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "-";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
}

function TruAnalysisView({
  analysis,
}: {
  analysis: {
    truCalls: NormalizedIncident[];
    totalCalls: number;
    callsWithReports: number;
    truReportCount: number;
    patrolReportCount: number;
    totalCrimeReports: number;
    truReportShare: number;
    conversionRate: number;
    hours: { hour: string; calls: number; averageCalls: number }[];
    selectedDayCount: number;
    days: { day: string; calls: number }[];
    dailyTrend: { date: string; label: string; calls: number; reports: number }[];
    topTypes: { type: string; count: number; share: number }[];
    durations: TruDurationRecord[];
    averageSeconds: number | null;
    medianSeconds: number | null;
    durationBuckets: { label: string; min: number; max: number; calls: number; share: number }[];
    overThresholds: { seconds: number; calls: number; share: number }[];
    longestCalls: TruDurationRecord[];
  };
}) {
  const hasData = analysis.truCalls.length > 0;

  if (!hasData) {
    return (
      <div className="dashboard-card p-6 text-center text-sm text-muted-foreground">
        No TRU-designated calls match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Calls for Service"
          value={analysis.totalCalls.toLocaleString()}
          subtitle="In current filter window"
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          title="Calls Requiring a Report"
          value={analysis.totalCalls > 0 ? `${((analysis.callsWithReports / analysis.totalCalls) * 100).toFixed(1)}%` : "0.0%"}
          subtitle={`${analysis.callsWithReports.toLocaleString()} calls with a crime or crash report`}
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          title="TRU Share of Event Reports"
          value={`${analysis.truReportShare.toFixed(1)}%`}
          subtitle={`${analysis.truReportCount.toLocaleString()} TRU; ${analysis.patrolReportCount.toLocaleString()} patrol of ${analysis.totalCrimeReports.toLocaleString()} unique event report numbers`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          title="TRS Calls Resulting in an Event Report"
          value={`${analysis.conversionRate.toFixed(1)}%`}
          subtitle={`${analysis.truReportCount.toLocaleString()} of ${analysis.truCalls.length.toLocaleString()} TRS calls resulted in an event report`}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          title="Average CAD Time to Cleared"
          value={formatDuration(analysis.averageSeconds)}
          subtitle={`${analysis.durations.length.toLocaleString()} valid TRS timing records`}
          icon={<Timer className="h-4 w-4" />}
        />
        <MetricCard
          title="Median CAD Time to Cleared"
          value={formatDuration(analysis.medianSeconds)}
          subtitle="Less affected by unusually long calls"
          icon={<Timer className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Average TRS Calls by Hour" subtitle={`Average per calendar day across ${analysis.selectedDayCount.toLocaleString()} selected day${analysis.selectedDayCount === 1 ? "" : "s"}`}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.hours} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number) => [`${value.toFixed(1)} average calls`, "TRS calls per day"]} />
                <Bar dataKey="averageCalls" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="TRS Calls by Day of Week" subtitle="Call pickup day">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.days} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number) => [value.toLocaleString(), "TRS calls"]} />
                <Bar dataKey="calls" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="TRS Call and Event Report Trend" subtitle="TRS calls and unique event report numbers by day">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analysis.dailyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="calls" name="TRS Calls" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="reports" name="Unique Event Report Numbers" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dashboard-card p-4">
          <h3 className="mb-1 text-sm font-semibold font-display">Top Final TRS Call Types</h3>
          <p className="mb-3 text-xs text-muted-foreground">Share of TRS-designated calls in the current filters.</p>
          <div className="space-y-3">
            {analysis.topTypes.map((item) => (
              <div key={item.type} className="space-y-1.5">
                <div className="flex items-start justify-between gap-3 text-xs">
                  <span className="min-w-0 font-medium text-foreground" title={item.type}>{item.type}</span>
                  <span className="shrink-0 font-semibold text-foreground">{item.count.toLocaleString()} ({item.share.toFixed(1)}%)</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(item.share, 2)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <ChartCard title="CAD Time to Cleared Distribution" subtitle={`${analysis.durations.length.toLocaleString()} valid TRS timing records; values shown as percentage of valid records`}>
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.durationBuckets} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number) => [`${value.toFixed(1)}%`, "Share of valid TRS calls"]} />
                <Bar dataKey="share" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {analysis.overThresholds.map((threshold) => (
          <MetricCard
            key={threshold.seconds}
            title={`Over ${threshold.seconds / 3600} Hour${threshold.seconds > 3600 ? "s" : ""}`}
            value={`${threshold.share.toFixed(1)}%`}
            subtitle={`${threshold.calls.toLocaleString()} valid TRS timing records`}
            icon={<Clock3 className="h-4 w-4" />}
          />
        ))}
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold font-display">Longest TRS CAD Times to Cleared</h3>
          <p className="text-xs text-muted-foreground">Top 10 valid records for operational review. CAD duration is not report completion time.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">CAD Time</th>
                <th className="px-4 py-3 font-medium">Incident</th>
                <th className="px-4 py-3 font-medium">Call Time</th>
                <th className="px-4 py-3 font-medium">District / Beat</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">CR Number</th>
                <th className="px-4 py-3 font-medium">Final TRS Type</th>
              </tr>
            </thead>
            <tbody>
              {analysis.longestCalls.map(({ incident, seconds }) => (
                <tr key={incident.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">{formatDuration(seconds)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{incident.incidentId || incident.id}</td>
                  <td className="whitespace-nowrap px-4 py-3">{incident.startTime?.toLocaleString() || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{[incident.district, incident.beat].filter(Boolean).join(" / ") || "-"}</td>
                  <td className="px-4 py-3">{incident.priority || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{incident.crNumber || "-"}</td>
                  <td className="max-w-[260px] px-4 py-3">{incident.rawCallType || incident.callType || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportTypeListCard({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: { type: string; count: number }[];
  emptyText: string;
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="dashboard-card p-4">
      <h3 className="text-sm font-semibold font-display mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const percent = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.type} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="truncate font-medium text-foreground" title={item.type}>
                      {item.type}
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold text-foreground">
                    {item.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(percent, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
