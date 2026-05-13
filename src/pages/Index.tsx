import { useEffect, useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import MetricCard from "@/components/dashboard/MetricCard";
import ChartCard from "@/components/dashboard/ChartCard";
import * as analytics from "@/lib/analytics";
import { getDateRangeBounds } from "@/lib/dateRanges";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Activity, Clock, AlertTriangle, TrendingUp, Moon } from "lucide-react";
import type { DateRangeOption, FilterState } from "@/types/incident";

const COLORS = ["#06b6d4", "#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];
const PRIORITY_ZERO_COLOR = "#ef4444";
const PRIORITY_THREE_COLOR = "#10b981";

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--card-foreground))",
  borderRadius: "6px",
  fontSize: "12px",
};

interface OverviewDailyBenchmark {
  date: string;
  year: number;
  month: number;
  day: number;
  call_count: number;
  daywork_count?: number;
  evening_count?: number;
  midnight_count?: number;
  overnight_count: number;
  priority_zero_count: number;
}

interface OverviewAnnualBenchmark {
  year: number;
  days: number;
  total_calls: number;
  average_calls_per_day: number;
  daywork_calls?: number;
  daywork_share?: number;
  evening_calls?: number;
  evening_share?: number;
  midnight_calls?: number;
  midnight_share?: number;
  overnight_calls: number;
  overnight_share: number;
  priority_zero_calls: number;
  priority_zero_share: number;
}

interface OverviewBenchmarks {
  generated_at: string;
  years: number[];
  annual: OverviewAnnualBenchmark[];
  annual_by_district?: Record<string, OverviewAnnualBenchmark[]>;
  three_year_average: {
    average_calls_per_day: number;
    daywork_share?: number;
    evening_share?: number;
    midnight_share?: number;
    overnight_share: number;
    priority_zero_share: number;
  };
  daily: OverviewDailyBenchmark[];
  daily_by_district?: Record<string, OverviewDailyBenchmark[]>;
}

interface OverviewCurrentMetrics {
  byDay: { date: string; count: number }[];
  overnight: number;
  priorityZero: number;
}

interface OverviewProjection {
  year: number;
  daysInYear: number;
  projectedTotalCalls: number;
  projectedOvernightCalls: number;
  projectedPriorityZeroCalls: number;
  projectedOvernightShare: number;
  projectedPriorityZeroShare: number;
  annualAverageTotalCalls: number;
}

export default function ExecutiveOverview() {
  const { filteredIncidents, availableFields, isLoading, error, filters } = useData();
  const [benchmarks, setBenchmarks] = useState<OverviewBenchmarks | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/overview-annual-benchmarks.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Benchmark fetch failed: ${response.status}`);
        return response.json() as Promise<OverviewBenchmarks>;
      })
      .then((payload) => {
        if (!cancelled) setBenchmarks(payload);
      })
      .catch((e: unknown) => {
        if (!cancelled) setBenchmarkError(e instanceof Error ? e.message : "Unable to load overview benchmarks");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const inc = filteredIncidents;
    const byDay = analytics.callsByDay(inc);
    const byHour = analytics.callsByHour(inc);
    const topTypes = analytics.topCallTypes(inc, 10);
    const priorities = analytics.priorityBreakdown(inc);
    const districts = analytics.districtBreakdown(inc);
    const rolling = analytics.rollingAverage(byDay, 7);
    const dur = analytics.avgDuration(inc);
    const overnight = analytics.overnightCalls(inc);
    const priorityZero = inc.filter((incident) => String(incident.priority ?? "").trim() === "0").length;
    const avgPerDay = byDay.length > 0 ? Math.round(inc.length / byDay.length) : 0;
    const highPri = priorities.find(
      (p) => p.priority?.toLowerCase().includes("emergency") || p.priority === "1" || p.priority?.toLowerCase().includes("high")
    );
    const highPriAvgPerDay = highPri && byDay.length > 0 ? highPri.count / byDay.length : 0;
    return { byDay, byHour, topTypes, priorities, districts, rolling, dur, overnight, priorityZero, avgPerDay, highPri, highPriAvgPerDay };
  }, [filteredIncidents]);

  const benchmarkComparison = useMemo(
    () => (benchmarks ? getOverviewComparison(benchmarks, metrics, filters) : null),
    [benchmarks, filters, metrics],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading data from Socrata…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2 text-destructive">
          <AlertTriangle className="h-8 w-8 mx-auto" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-bold">Executive Overview</h2>

      <div className="dashboard-card border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
        For official department numbers, contact the Crime Analysis Unit. This dashboard reflects calls for service only and should not be used as official NIBRS, crime, or incident statistics. Call-type analysis is based on initial dispatch type; for 2026 YTD, grouped initial call type differed from grouped closed call type for about 1.5% of calls.
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard title="Total Calls" value={filteredIncidents.length.toLocaleString()} icon={<Activity className="h-4 w-4" />} />
        <MetricCard title="Avg / Day" value={metrics.avgPerDay} icon={<TrendingUp className="h-4 w-4" />} />
        {metrics.dur !== null && (
          <MetricCard title="Avg Duration" value={`${metrics.dur} min`} icon={<Clock className="h-4 w-4" />} />
        )}
        {metrics.highPri && (
          <MetricCard
            title="High Priority / Day"
            value={metrics.highPriAvgPerDay.toFixed(1)}
            subtitle={`${metrics.highPri.count.toLocaleString()} total`}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        )}
        <MetricCard title="Overnight (22-06)" value={metrics.overnight.toLocaleString()} icon={<Moon className="h-4 w-4" />} />
      </div>

      <OverviewBenchmarkPanel
        benchmarks={benchmarks}
        error={benchmarkError}
        comparison={benchmarkComparison}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Calls by Day" visible={metrics.byDay.length > 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={metrics.byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Calls by Hour of Day" visible={metrics.byHour.some((h) => h.count > 0)}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={metrics.byHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Call Types" visible={availableFields.has("callType") && metrics.topTypes.length > 0}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.topTypes} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis dataKey="type" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={95} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill={COLORS[2]} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Priority Breakdown" visible={availableFields.has("priority") && metrics.priorities.length > 0}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={metrics.priorities} dataKey="count" nameKey="priority" cx="50%" cy="50%" outerRadius={100} label={({ priority, percent }) => `${priority} (${(percent * 100).toFixed(0)}%)`}>
                {metrics.priorities.map((_, i) => (
                  <Cell key={i} fill={getPriorityColor(metrics.priorities[i].priority, i)} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="District Breakdown" visible={availableFields.has("district") && metrics.districts.length > 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={metrics.districts}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="district" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill={COLORS[3]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="7-Day Rolling Average" visible={metrics.rolling.length > 3}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={metrics.rolling}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="count" stroke={COLORS[0]} strokeWidth={1} dot={false} name="Daily" />
              <Line type="monotone" dataKey="avg" stroke={COLORS[2]} strokeWidth={2} dot={false} name="7-day Avg" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function OverviewBenchmarkPanel({
  benchmarks,
  error,
  comparison,
}: {
  benchmarks: OverviewBenchmarks | null;
  error: string | null;
  comparison: ReturnType<typeof getOverviewComparison> | null;
}) {
  if (error) {
    return <div className="dashboard-card p-4 text-sm text-destructive">Unable to load overview benchmarks: {error}</div>;
  }

  if (!benchmarks || !comparison) {
    return <div className="dashboard-card p-4 text-sm text-muted-foreground">Loading overview benchmarks...</div>;
  }

  return (
    <div className="dashboard-card p-4">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold font-display">3-Year Overview Benchmarks</h3>
          <p className="text-xs text-muted-foreground">
            Current filters compared with {comparison.scopeLabel.toLowerCase()} annual averages and the same calendar window from {benchmarks.years.join(", ")}.
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground">Updated {formatBenchmarkDate(benchmarks.generated_at)}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <BenchmarkTile
          label="Avg Calls / Day"
          current={comparison.current.avgPerDay}
          annual={comparison.annual.avgPerDay}
          seasonal={comparison.seasonal.avgPerDay}
          format={(value) => value.toFixed(1)}
          direction="higher-is-more"
        />
        <BenchmarkTile
          label="Overnight Share"
          current={comparison.current.overnightShare}
          annual={comparison.annual.overnightShare}
          seasonal={comparison.seasonal.overnightShare}
          format={formatPercent}
          direction="higher-is-more"
        />
        <BenchmarkTile
          label="Priority 0 Share"
          current={comparison.current.priorityZeroShare}
          annual={comparison.annual.priorityZeroShare}
          seasonal={comparison.seasonal.priorityZeroShare}
          format={formatPercent}
          direction="higher-is-more"
        />
      </div>

      <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold font-display">{comparison.projection.year} Expected Trend</h4>
            <p className="text-xs text-muted-foreground">
              Projection assumes the current filtered daily pace continues through the full calendar year.
            </p>
          </div>
          <span className={getDeltaClass(comparison.projection.projectedTotalCalls, comparison.projection.annualAverageTotalCalls)}>
            {formatDelta(comparison.projection.projectedTotalCalls, comparison.projection.annualAverageTotalCalls)} vs 3-year avg
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ProjectionStat
            label="Projected Calls"
            value={comparison.projection.projectedTotalCalls.toLocaleString()}
            detail={`${comparison.projection.daysInYear} day estimate`}
          />
          <ProjectionStat
            label="Projected Overnight"
            value={comparison.projection.projectedOvernightCalls.toLocaleString()}
            detail={formatPercent(comparison.projection.projectedOvernightShare)}
          />
          <ProjectionStat
            label="Projected Priority 0"
            value={comparison.projection.projectedPriorityZeroCalls.toLocaleString()}
            detail={formatPercent(comparison.projection.projectedPriorityZeroShare)}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:hidden">
        {comparison.annualRows.map((year) => (
          <OverviewAnnualMobileCard key={year.year} year={year} />
        ))}
      </div>

      <div className="mt-4 hidden overflow-auto md:block">
        <table className="w-full min-w-[760px] text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Year</th>
              <th className="py-2 pr-3 font-medium">Total Calls</th>
              <th className="py-2 pr-3 font-medium">Avg / Day</th>
              <th className="py-2 pr-3 font-medium">Daywork 0600-1430</th>
              <th className="py-2 pr-3 font-medium">Evening 1430-2200</th>
              <th className="py-2 pr-3 font-medium">Midnight 2200-0600</th>
              <th className="py-2 pr-3 font-medium">Priority 0 Share</th>
            </tr>
          </thead>
          <tbody>
            {comparison.annualRows.map((year) => (
              <tr key={year.year} className="border-b border-border/50">
                <td className="py-2 pr-3 font-semibold">{year.year}</td>
                <td className="py-2 pr-3">{year.total_calls.toLocaleString()}</td>
                <td className="py-2 pr-3">{year.average_calls_per_day.toFixed(1)}</td>
                <td className="py-2 pr-3">{formatPercent(getShiftShare(year, "daywork"))}</td>
                <td className="py-2 pr-3">{formatPercent(getShiftShare(year, "evening"))}</td>
                <td className="py-2 pr-3">{formatPercent(getShiftShare(year, "midnight"))}</td>
                <td className="py-2 pr-3">{formatPercent(year.priority_zero_share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OverviewAnnualMobileCard({ year }: { year: OverviewAnnualBenchmark }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
        <div className="text-sm font-semibold font-display">{year.year}</div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total Calls</div>
          <div className="text-sm font-bold">{year.total_calls.toLocaleString()}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <MobileBenchmarkStat label="Avg / Day" value={year.average_calls_per_day.toFixed(1)} />
        <MobileBenchmarkStat label="Priority 0" value={formatPercent(year.priority_zero_share)} />
        <MobileBenchmarkStat label="Daywork" value={formatPercent(getShiftShare(year, "daywork"))} />
        <MobileBenchmarkStat label="Evening" value={formatPercent(getShiftShare(year, "evening"))} />
        <MobileBenchmarkStat label="Midnight" value={formatPercent(getShiftShare(year, "midnight"))} />
      </div>
    </div>
  );
}

function MobileBenchmarkStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}

function ProjectionStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold font-display">{value}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function BenchmarkTile({
  label,
  current,
  annual,
  seasonal,
  format,
}: {
  label: string;
  current: number;
  annual: number;
  seasonal: number;
  format: (value: number) => string;
  direction: "higher-is-more";
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold font-display">{format(current)}</div>
      <div className="mt-3 space-y-1 text-xs">
        <ComparisonLine label="Annual avg" current={current} baseline={annual} />
        <ComparisonLine label="Same window" current={current} baseline={seasonal} />
      </div>
    </div>
  );
}

function ComparisonLine({ label, current, baseline }: { label: string; current: number; baseline: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={getDeltaClass(current, baseline)}>{formatDelta(current, baseline)}</span>
    </div>
  );
}

function getOverviewComparison(benchmarks: OverviewBenchmarks, metrics: OverviewCurrentMetrics, filters: FilterState) {
  const currentDays = Math.max(metrics.byDay.length, 1);
  const currentTotalCalls = metrics.byDay.reduce((sum, day) => sum + day.count, 0);
  const annualRows = getBenchmarkAnnualRows(benchmarks, filters);
  const annualAverage = weightedAnnualAverage(annualRows);
  const current = {
    avgPerDay: metrics.byDay.length > 0 ? currentTotalCalls / currentDays : 0,
    overnightShare: currentTotalCalls > 0
      ? metrics.overnight / currentTotalCalls
      : 0,
    priorityZeroShare: currentTotalCalls > 0
      ? metrics.priorityZero / currentTotalCalls
      : 0,
  };
  const seasonal = getSeasonalBaseline(benchmarks, filters);
  const projection = getOverviewProjection(annualRows, current);

  return {
    current,
    annual: {
      avgPerDay: annualAverage.average_calls_per_day,
      overnightShare: annualAverage.overnight_share,
      priorityZeroShare: annualAverage.priority_zero_share,
    },
    seasonal,
    projection,
    annualRows,
    scopeLabel: getDistrictScopeLabel(filters),
  };
}

function getBenchmarkAnnualRows(benchmarks: OverviewBenchmarks, filters: FilterState) {
  if (filters.district.length > 0) {
    return getAggregatedAnnualRows(benchmarks, filters.district);
  }
  return benchmarks.annual;
}

function getAggregatedAnnualRows(benchmarks: OverviewBenchmarks, districts: string[]) {
  const rowsByYear = new Map<number, OverviewAnnualBenchmark>();

  for (const district of districts) {
    const rows = benchmarks.annual_by_district?.[district] || [];
    for (const row of rows) {
      const existing = rowsByYear.get(row.year) || {
        year: row.year,
        days: row.days,
        total_calls: 0,
        average_calls_per_day: 0,
        daywork_calls: 0,
        daywork_share: 0,
        evening_calls: 0,
        evening_share: 0,
        midnight_calls: 0,
        midnight_share: 0,
        overnight_calls: 0,
        overnight_share: 0,
        priority_zero_calls: 0,
        priority_zero_share: 0,
      };

      existing.total_calls += row.total_calls;
      existing.daywork_calls = (existing.daywork_calls || 0) + (row.daywork_calls || 0);
      existing.evening_calls = (existing.evening_calls || 0) + (row.evening_calls || 0);
      existing.midnight_calls = (existing.midnight_calls || 0) + (row.midnight_calls || 0);
      existing.overnight_calls += row.overnight_calls;
      existing.priority_zero_calls += row.priority_zero_calls;
      rowsByYear.set(row.year, existing);
    }
  }

  return Array.from(rowsByYear.values())
    .map((row) => ({
      ...row,
      average_calls_per_day: row.days > 0 ? row.total_calls / row.days : 0,
      daywork_share: row.total_calls > 0 ? (row.daywork_calls || 0) / row.total_calls : 0,
      evening_share: row.total_calls > 0 ? (row.evening_calls || 0) / row.total_calls : 0,
      midnight_share: row.total_calls > 0 ? (row.midnight_calls || 0) / row.total_calls : 0,
      overnight_share: row.total_calls > 0 ? row.overnight_calls / row.total_calls : 0,
      priority_zero_share: row.total_calls > 0 ? row.priority_zero_calls / row.total_calls : 0,
    }))
    .sort((a, b) => a.year - b.year);
}

function getOverviewProjection(
  annualRows: OverviewAnnualBenchmark[],
  current: { avgPerDay: number; overnightShare: number; priorityZeroShare: number },
): OverviewProjection {
  const year = new Date().getFullYear();
  const daysInYear = getDaysInYear(year);
  const projectedTotalCalls = Math.round(current.avgPerDay * daysInYear);
  const annualAverageTotalCalls =
    annualRows.reduce((sum, row) => sum + row.total_calls, 0) / Math.max(annualRows.length, 1);

  return {
    year,
    daysInYear,
    projectedTotalCalls,
    projectedOvernightCalls: Math.round(projectedTotalCalls * current.overnightShare),
    projectedPriorityZeroCalls: Math.round(projectedTotalCalls * current.priorityZeroShare),
    projectedOvernightShare: current.overnightShare,
    projectedPriorityZeroShare: current.priorityZeroShare,
    annualAverageTotalCalls,
  };
}

function weightedAnnualAverage(annualRows: OverviewAnnualBenchmark[]) {
  const totalCalls = annualRows.reduce((sum, row) => sum + row.total_calls, 0);
  const totalDays = annualRows.reduce((sum, row) => sum + row.days, 0);
  const overnight = annualRows.reduce((sum, row) => sum + row.overnight_calls, 0);
  const priorityZero = annualRows.reduce((sum, row) => sum + row.priority_zero_calls, 0);

  return {
    average_calls_per_day: totalDays > 0 ? totalCalls / totalDays : 0,
    overnight_share: totalCalls > 0 ? overnight / totalCalls : 0,
    priority_zero_share: totalCalls > 0 ? priorityZero / totalCalls : 0,
  };
}

function getSeasonalBaseline(benchmarks: OverviewBenchmarks, filters: FilterState) {
  const bounds = getDateRangeBounds(filters.dateRange, new Date(), filters.customStartDate, filters.customEndDate);
  const dailyRows = filters.district.length > 0
    ? filters.district.flatMap((district) => benchmarks.daily_by_district?.[district] || [])
    : benchmarks.daily;
  let calls = 0;
  let overnight = 0;
  let priorityZero = 0;
  let days = 0;

  for (const year of benchmarks.years) {
    const start = shiftDateToYear(bounds.start, year);
    const end = shiftDateToYear(bounds.end || new Date(), year);
    const startKey = formatDateKey(start);
    const endKey = formatDateKey(end);
    const windowDays = Math.max(Math.round((end.getTime() - start.getTime()) / 86400000), 1);
    days += windowDays;

    for (const row of dailyRows) {
      if (row.year !== year) continue;
      if (row.date >= startKey && row.date < endKey) {
        calls += row.call_count;
        overnight += row.overnight_count;
        priorityZero += row.priority_zero_count;
      }
    }
  }

  return {
    avgPerDay: days > 0 ? calls / days : 0,
    overnightShare: calls > 0 ? overnight / calls : 0,
    priorityZeroShare: calls > 0 ? priorityZero / calls : 0,
  };
}

function getDistrictScopeLabel(filters: FilterState) {
  if (filters.district.length === 0) return "Countywide";
  if (filters.district.length === 1) return `${filters.district[0]} district`;
  return `${filters.district.join(" + ")} districts`;
}

function shiftDateToYear(date: Date, year: number) {
  const shifted = new Date(year, date.getMonth(), date.getDate());
  if (shifted.getMonth() !== date.getMonth()) return new Date(year, date.getMonth() + 1, 0);
  return shifted;
}

function getDaysInYear(year: number) {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function formatDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatBenchmarkDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getShiftShare(
  year: OverviewAnnualBenchmark,
  shift: "daywork" | "evening" | "midnight",
) {
  if (shift === "daywork") return year.daywork_share ?? 0;
  if (shift === "evening") return year.evening_share ?? 0;
  return year.midnight_share ?? year.overnight_share;
}

function formatDelta(current: number, baseline: number) {
  if (!baseline || !Number.isFinite(baseline)) return "No baseline";
  const delta = ((current - baseline) / baseline) * 100;
  if (Math.abs(delta) < 5) return "Stable";
  return `${Math.abs(delta).toFixed(1)}% ${delta > 0 ? "higher" : "lower"}`;
}

function getDeltaClass(current: number, baseline: number) {
  if (!baseline || !Number.isFinite(baseline)) return "text-muted-foreground";
  const delta = Math.abs((current - baseline) / baseline);
  return delta < 0.05 ? "text-muted-foreground" : "text-foreground font-semibold";
}

function getPriorityColor(priority: unknown, index: number) {
  const value = String(priority ?? "").trim();
  if (value === "0") return PRIORITY_ZERO_COLOR;
  if (value === "3") return PRIORITY_THREE_COLOR;
  return COLORS[index % COLORS.length];
}
