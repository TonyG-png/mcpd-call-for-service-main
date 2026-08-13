import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Clock3, FileText, Info, Loader2, Route } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard from "@/components/dashboard/ChartCard";
import MetricCard from "@/components/dashboard/MetricCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TruPdfButton from "@/components/reports/TruPdfButton";
import { createQuarterlyTruPdf } from "@/lib/truPdfReport";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  color: "hsl(var(--foreground))",
  fontSize: 12,
};

interface TimingSummary {
  valid_count: number;
  coverage_share: number;
  average_seconds: number | null;
  median_seconds: number | null;
  p90_seconds: number | null;
  over_1_hour_share: number;
  over_2_hours_share: number;
  over_3_hours_share: number;
  over_4_hours_share: number;
}

interface CallTypeSummary {
  type: string;
  calls: number;
  share: number;
}

interface DemandProfile {
  by_hour: { hour: string; calls: number; average_calls_per_day: number }[];
  by_weekday: { day: string; calls: number; average_calls: number }[];
}

interface QuarterlyMetrics {
  quarter?: string;
  start?: string;
  end?: string;
  days?: number;
  total_cfs: number;
  tru_calls: number;
  patrol_estimate_calls: number;
  tru_calls_per_day: number;
  patrol_estimate_calls_per_day: number;
  event_reports_total: number;
  tru_event_reports: number;
  patrol_estimate_event_reports: number;
  tru_share_of_total_calls: number;
  tru_share_of_event_reports: number;
  tru_event_report_conversion: number;
  patrol_estimate_event_report_conversion: number;
  tru_calls_without_event_report: number;
  tru_calls_without_event_report_share: number;
  tru_timing: TimingSummary;
  patrol_estimate_report_call_timing: TimingSummary;
  routing_outcomes: {
    remained_tru: number;
    routed_into_tru: number;
    routed_away_from_tru: number;
  };
  top_tru_call_types: CallTypeSummary[];
  top_tru_call_types_without_event_report: CallTypeSummary[];
  demand_profile: DemandProfile;
}

interface ScopeAnalysis {
  summary: QuarterlyMetrics;
  quarters: QuarterlyMetrics[];
}

interface DistrictComparison {
  district: string;
  total_cfs: number;
  tru_calls: number;
  tru_calls_per_day: number;
  tru_event_reports: number;
  tru_share_of_event_reports: number;
  tru_event_report_conversion: number;
  median_cad_seconds: number | null;
  p90_cad_seconds: number | null;
}

interface TruQuarterlyPayload {
  generated_at: string;
  period_start: string;
  period_end_exclusive: string;
  quarters: string[];
  countywide: ScopeAnalysis;
  by_district: Record<string, ScopeAnalysis>;
  district_comparison: DistrictComparison[];
}

export default function TruQuarterlyAnalysis() {
  const [data, setData] = useState<TruQuarterlyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [district, setDistrict] = useState("Countywide");

  useEffect(() => {
    let cancelled = false;
    fetch("/data/tru-quarterly-analysis.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Historical TRU data request failed: ${response.status}`);
        return response.json() as Promise<TruQuarterlyPayload>;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load historical TRU data.");
      });
    return () => { cancelled = true; };
  }, []);

  const scope = data ? (district === "Countywide" ? data.countywide : data.by_district[district]) : null;
  const chartData = useMemo(() => (scope?.quarters || []).map((quarter) => ({
    ...quarter,
    median_minutes: secondsToMinutes(quarter.tru_timing.median_seconds),
    p90_minutes: secondsToMinutes(quarter.tru_timing.p90_seconds),
  })), [scope]);

  if (error) {
    return (
      <div className="dashboard-card border-destructive/60 p-5 text-sm text-destructive">
        Unable to load the eight-quarter TRU analysis. {error}
      </div>
    );
  }

  if (!data || !scope) {
    return (
      <div className="dashboard-card flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading eight-quarter TRU analysis...
      </div>
    );
  }

  const summary = scope.summary;
  const insights = buildInsights(scope);
  const districts = Object.entries(data.by_district)
    .filter(([, value]) => value.summary.tru_calls > 0)
    .map(([value]) => value);

  return (
    <div className="space-y-6">
      <div className="dashboard-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold font-display">Eight Complete Quarters</h3>
            <p className="max-w-3xl text-xs text-muted-foreground">
              {formatDate(data.period_start)} through {formatEndDate(data.period_end_exclusive)}. Historical results use
              the district selector below; the page&apos;s date, beat, priority, and call-type filters do not alter this cached analysis.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Historical TRU district">
                <SelectValue placeholder="Countywide" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Countywide">Countywide</SelectItem>
                {districts.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
              </SelectContent>
            </Select>
            <TruPdfButton
              onCreate={() => createQuarterlyTruPdf({
                scopeName: district,
                periodLabel: `${formatDate(data.period_start)} through ${formatEndDate(data.period_end_exclusive)}`,
                generatedAt: data.generated_at,
                summary,
                quarters: scope.quarters,
                districtComparison: data.district_comparison,
              })}
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Patrol estimate means non-TRU-coded activity. The public CFS data does not identify the handling unit, so these
            results estimate workload distribution and do not prove patrol officer-hours saved. Updated {formatDateTime(data.generated_at)}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Eight-Quarter TRU Calls"
          value={summary.tru_calls.toLocaleString()}
          subtitle={`${formatPercent(summary.tru_share_of_total_calls)} of all CFS`}
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          title="TRU Event Reports"
          value={summary.tru_event_reports.toLocaleString()}
          subtitle="Unique CR numbers attributed to TRU"
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          title="TRU Share of Event Reports"
          value={formatPercent(summary.tru_share_of_event_reports)}
          subtitle={`${summary.patrol_estimate_event_reports.toLocaleString()} patrol-estimated reports`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          title="TRU Report Conversion"
          value={formatPercent(summary.tru_event_report_conversion)}
          subtitle={`${summary.tru_calls_without_event_report.toLocaleString()} TRU calls without a CR number`}
          icon={<Route className="h-4 w-4" />}
        />
        <MetricCard
          title="Median CAD Time Open"
          value={formatDuration(summary.tru_timing.median_seconds)}
          subtitle={`P90 ${formatDuration(summary.tru_timing.p90_seconds)}; ${formatPercent(summary.tru_timing.coverage_share)} timing coverage`}
          icon={<Clock3 className="h-4 w-4" />}
        />
      </div>

      <div className="dashboard-card p-4">
        <h3 className="text-sm font-semibold font-display">Executive Findings</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {insights.map((insight) => (
            <div key={insight.label} className="rounded-md border border-border p-3">
              <div className="text-xs font-medium text-muted-foreground">{insight.label}</div>
              <div className="mt-1 text-sm font-semibold leading-snug">{insight.value}</div>
            </div>
          ))}
        </div>
      </div>

      <ChartCard title="TRU vs Patrol-Estimated Event Reports" subtitle="Unique CR numbers by quarter; mixed TRU/non-TRU numbers are attributed to TRU">
        <div className="h-[310px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => value.toLocaleString()} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="tru_event_reports" name="TRU Event Reports" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="patrol_estimate_event_reports" name="Patrol Estimate" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Quarterly TRU Utilization" subtitle="Share of all CFS compared with share of unique event reports">
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => formatPercent(value)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="tru_share_of_total_calls" name="TRU Share of CFS" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                <Line type="monotone" dataKey="tru_share_of_event_reports" name="TRU Share of Event Reports" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="TRU CAD Time to Cleared" subtitle="Median and 90th percentile elapsed time by quarter">
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(value) => `${Math.round(value)}m`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => `${Math.round(value)} min`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="median_minutes" name="Median" stroke="hsl(var(--chart-3))" strokeWidth={2} />
                <Line type="monotone" dataKey="p90_minutes" name="90th Percentile" stroke="hsl(var(--destructive))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Open 1+ Hour", summary.tru_timing.over_1_hour_share],
          ["Open 2+ Hours", summary.tru_timing.over_2_hours_share],
          ["Open 3+ Hours", summary.tru_timing.over_3_hours_share],
          ["Open 4+ Hours", summary.tru_timing.over_4_hours_share],
        ].map(([label, value]) => (
          <div key={String(label)} className="dashboard-card p-4">
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-bold font-display">{formatPercent(Number(value))}</div>
            <div className="text-[11px] text-muted-foreground">of valid TRU timing records</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Stable TRU Demand by Hour" subtitle="Average calls in each hour per calendar day across eight complete quarters">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.demand_profile.by_hour} margin={{ top: 5, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => value.toFixed(1)} />
                <Bar dataKey="average_calls_per_day" name="Average Calls" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Stable TRU Demand by Weekday" subtitle="Average calls for each occurrence of the weekday across the period">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.demand_profile.by_weekday} margin={{ top: 5, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => value.toFixed(1)} />
                <Bar dataKey="average_calls" name="Average Calls" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TypeList title="Top TRU Call Types" items={summary.top_tru_call_types} denominatorLabel="of TRU calls" />
        <TypeList title="Top TRU Types Without an Event Report" items={summary.top_tru_call_types_without_event_report} denominatorLabel="of TRU calls without a CR number" />
      </div>

      <div className="dashboard-card p-4">
        <h3 className="text-sm font-semibold font-display">Initial-to-Final TRU Routing</h3>
        <p className="text-xs text-muted-foreground">Routing outcomes use strict TRS designation on initial and final call types.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <RoutingStat label="Remained TRU" value={summary.routing_outcomes.remained_tru} />
          <RoutingStat label="Routed Into TRU" value={summary.routing_outcomes.routed_into_tru} />
          <RoutingStat label="Routed Away From TRU" value={summary.routing_outcomes.routed_away_from_tru} />
        </div>
      </div>

      <DistrictTable rows={data.district_comparison.filter((row) => row.tru_calls > 0)} />
      <QuarterTable rows={scope.quarters} />
    </div>
  );
}

function TypeList({ title, items, denominatorLabel }: { title: string; items: CallTypeSummary[]; denominatorLabel: string }) {
  return (
    <div className="dashboard-card p-4">
      <h3 className="text-sm font-semibold font-display">{title}</h3>
      <div className="mt-3 divide-y divide-border/50">
        {items.slice(0, 10).map((item, index) => (
          <div key={item.type} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs">
            <span className="text-muted-foreground">{index + 1}</span>
            <span className="truncate font-medium" title={item.type}>{item.type}</span>
            <span className="text-right">
              <span className="font-semibold">{item.calls.toLocaleString()}</span>
              <span className="ml-2 text-muted-foreground">{formatPercent(item.share)} {denominatorLabel}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoutingStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold font-display">{value.toLocaleString()}</div>
    </div>
  );
}

function DistrictTable({ rows }: { rows: DistrictComparison[] }) {
  return (
    <div className="dashboard-card overflow-hidden">
      <div className="p-4">
        <h3 className="text-sm font-semibold font-display">Eight-Quarter District Comparison</h3>
        <p className="text-xs text-muted-foreground">Countywide methodology applied independently to each district.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-xs">
          <thead className="border-y border-border bg-secondary/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">District</th>
              <th className="px-4 py-3 text-right font-medium">TRU Calls</th>
              <th className="px-4 py-3 text-right font-medium">Calls / Day</th>
              <th className="px-4 py-3 text-right font-medium">TRU Reports</th>
              <th className="px-4 py-3 text-right font-medium">Report Share</th>
              <th className="px-4 py-3 text-right font-medium">Conversion</th>
              <th className="px-4 py-3 text-right font-medium">Median Open</th>
              <th className="px-4 py-3 text-right font-medium">P90 Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.district} className="border-b border-border/50">
                <td className="px-4 py-3 font-semibold">{row.district}</td>
                <td className="px-4 py-3 text-right">{row.tru_calls.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{row.tru_calls_per_day.toFixed(1)}</td>
                <td className="px-4 py-3 text-right">{row.tru_event_reports.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{formatPercent(row.tru_share_of_event_reports)}</td>
                <td className="px-4 py-3 text-right">{formatPercent(row.tru_event_report_conversion)}</td>
                <td className="px-4 py-3 text-right">{formatDuration(row.median_cad_seconds)}</td>
                <td className="px-4 py-3 text-right">{formatDuration(row.p90_cad_seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuarterTable({ rows }: { rows: QuarterlyMetrics[] }) {
  return (
    <div className="dashboard-card overflow-hidden">
      <div className="p-4">
        <h3 className="text-sm font-semibold font-display">Quarterly Detail</h3>
        <p className="text-xs text-muted-foreground">Raw counts and rate denominators for reconciliation.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="border-y border-border bg-secondary/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Quarter</th>
              <th className="px-4 py-3 text-right font-medium">Total CFS</th>
              <th className="px-4 py-3 text-right font-medium">TRU Calls</th>
              <th className="px-4 py-3 text-right font-medium">Patrol Est. Calls</th>
              <th className="px-4 py-3 text-right font-medium">TRU Reports</th>
              <th className="px-4 py-3 text-right font-medium">Patrol Est. Reports</th>
              <th className="px-4 py-3 text-right font-medium">TRU Report Share</th>
              <th className="px-4 py-3 text-right font-medium">TRU Conversion</th>
              <th className="px-4 py-3 text-right font-medium">Median</th>
              <th className="px-4 py-3 text-right font-medium">P90</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.quarter} className="border-b border-border/50">
                <td className="px-4 py-3 font-semibold">{row.quarter}</td>
                <td className="px-4 py-3 text-right">{row.total_cfs.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{row.tru_calls.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{row.patrol_estimate_calls.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{row.tru_event_reports.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{row.patrol_estimate_event_reports.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{formatPercent(row.tru_share_of_event_reports)}</td>
                <td className="px-4 py-3 text-right">{formatPercent(row.tru_event_report_conversion)}</td>
                <td className="px-4 py-3 text-right">{formatDuration(row.tru_timing.median_seconds)}</td>
                <td className="px-4 py-3 text-right">{formatDuration(row.tru_timing.p90_seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildInsights(scope: ScopeAnalysis) {
  const first = scope.quarters[0];
  const latest = scope.quarters[scope.quarters.length - 1];
  const prior = scope.quarters.slice(0, -1);
  const priorCalls = average(prior.map((quarter) => quarter.tru_calls));
  const priorShare = average(prior.map((quarter) => quarter.tru_share_of_event_reports));
  const priorMedian = average(prior.map((quarter) => quarter.tru_timing.median_seconds || 0).filter(Boolean));
  const topType = scope.summary.top_tru_call_types[0];

  return [
    {
      label: "Latest Quarter TRU Volume",
      value: `${latest.quarter}: ${latest.tru_calls.toLocaleString()} calls, ${formatSignedPercentChange(latest.tru_calls, priorCalls)} the prior-seven-quarter average.`,
    },
    {
      label: "Event-Report Workload Share",
      value: `${formatPercent(latest.tru_share_of_event_reports)} in ${latest.quarter}, ${formatPointChange(latest.tru_share_of_event_reports, priorShare)} than the prior average and ${formatPointChange(latest.tru_share_of_event_reports, first.tru_share_of_event_reports)} than ${first.quarter}.`,
    },
    {
      label: "CAD Time Open",
      value: `${formatDuration(latest.tru_timing.median_seconds)} median in ${latest.quarter}, ${formatSignedPercentChange(latest.tru_timing.median_seconds || 0, priorMedian)} the prior-seven-quarter average.`,
    },
    {
      label: "Workload Composition",
      value: topType
        ? `${topType.type} was the largest TRU category at ${topType.calls.toLocaleString()} calls (${formatPercent(topType.share)}).`
        : "No TRU call-type data was available.",
    },
  ];
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatSignedPercentChange(value: number, baseline: number) {
  if (!baseline) return "not comparable";
  const change = ((value - baseline) / baseline) * 100;
  return `${Math.abs(change).toFixed(1)}% ${change >= 0 ? "above" : "below"}`;
}

function formatPointChange(value: number, baseline: number) {
  const change = value - baseline;
  return `${Math.abs(change).toFixed(1)} points ${change >= 0 ? "higher" : "lower"}`;
}

function secondsToMinutes(value: number | null) {
  return value === null ? null : value / 60;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "-";
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes} min`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatEndDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
