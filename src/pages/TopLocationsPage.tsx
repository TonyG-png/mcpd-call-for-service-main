import { useEffect, useMemo, useState } from "react";
import { MapPin, Activity, Building2, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "@/context/DataContext";
import ChartCard from "@/components/dashboard/ChartCard";
import MetricCard from "@/components/dashboard/MetricCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatLocationLabel, getNormalizedLocationKey, normalizeLocationPart } from "@/lib/locations";

interface LocationSummary {
  key: string;
  address: string;
  city: string;
  district: string;
  beat: string;
  count: number;
  callTypes: Map<string, number>;
}

interface MonthlyLocationSummary {
  location: string;
  normalized_location: string;
  district: string;
  beat: string;
  year: number;
  month: number;
  month_label: string;
  call_count: number;
  top_call_types: { type: string; count: number }[];
  last_updated: string;
}

interface TrendWindowSummary {
  rows: MonthlyLocationSummary[];
  total: number;
  averagePerMonth: number;
}

interface ChangeSummary {
  percent: number | null;
  averageDelta: number;
  baselineTotal: number;
  hasSignal: boolean;
  reason: string;
}

interface LocationTrendSummary {
  total: number;
  averagePerMonth: number;
  latestMonth: TrendWindowSummary;
  recent12: TrendWindowSummary;
  full36: TrendWindowSummary;
  latestVs12Change: ChangeSummary;
  latestVs36Change: ChangeSummary;
  recent: MonthlyLocationSummary;
  peak: MonthlyLocationSummary;
  topCallTypes: { type: string; count: number }[];
  district: string;
  beat: string;
  lastUpdated: string;
}

interface LocationSummaryWithTrend extends LocationSummary {
  trend: LocationTrendSummary | null;
}

type ChangeBand =
  | "strongDecrease"
  | "moderateDecrease"
  | "slightDecrease"
  | "neutral"
  | "slightIncrease"
  | "moderateIncrease"
  | "strongIncrease"
  | "insufficient";

const MONTHS_PER_YEAR = 12;
const HISTORY_MONTHS = 36;
const MIN_BASELINE_CALLS = 12;
const MIN_AVERAGE_DELTA_FOR_SIGNAL = 0.5;

const rowChangeClasses: Record<ChangeBand, string> = {
  strongDecrease: "bg-emerald-100/80 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/25",
  moderateDecrease: "bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15",
  slightDecrease: "bg-lime-50 hover:bg-lime-100/80 dark:bg-lime-400/10 dark:hover:bg-lime-400/15",
  neutral: "hover:bg-secondary/50",
  slightIncrease: "bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-300/10 dark:hover:bg-amber-300/15",
  moderateIncrease: "bg-orange-50 hover:bg-orange-100/80 dark:bg-orange-400/10 dark:hover:bg-orange-400/15",
  strongIncrease: "bg-red-50 hover:bg-red-100/80 dark:bg-red-500/15 dark:hover:bg-red-500/20",
  insufficient: "hover:bg-secondary/50",
};

const changeBadgeClasses: Record<ChangeBand, string> = {
  strongDecrease: "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-100",
  moderateDecrease: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-100",
  slightDecrease: "border-lime-300 bg-lime-50 text-lime-900 dark:border-lime-400/35 dark:bg-lime-400/15 dark:text-lime-100",
  neutral: "border-border bg-secondary text-muted-foreground",
  slightIncrease: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-300/40 dark:bg-amber-300/15 dark:text-amber-100",
  moderateIncrease: "border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-400/40 dark:bg-orange-400/15 dark:text-orange-100",
  strongIncrease: "border-red-300 bg-red-50 text-red-950 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-100",
  insufficient: "border-border bg-muted/40 text-muted-foreground",
};

const isStationResponse = (callType?: string) =>
  normalizeLocationPart(callType) === "STATION RESPONSE";

const getTopCallTypes = (callTypes: Map<string, number>) =>
  Array.from(callTypes.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([type, count]) => `${type} (${count})`)
    .join(", ");

export default function TopLocationsPage() {
  const { filteredIncidents, availableFields, isLoading } = useData();
  const [selectedLocation, setSelectedLocation] = useState<LocationSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyLocationSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (monthlySummary.length > 0 || summaryError) return;

    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);

    fetch("/data/top-location-monthly-summary.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Summary fetch failed: ${response.status}`);
        return response.json() as Promise<MonthlyLocationSummary[]>;
      })
      .then((rows) => {
        if (!cancelled) setMonthlySummary(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled) setSummaryError(error instanceof Error ? error.message : "Unable to load location summary");
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [monthlySummary.length, summaryError]);

  const locationEligibleIncidents = useMemo(
    () => filteredIncidents.filter((incident) => !isStationResponse(incident.callType)),
    [filteredIncidents],
  );

  const locations = useMemo(() => {
    const map = new Map<string, LocationSummary>();

    for (const incident of locationEligibleIncidents) {
      const address = normalizeLocationPart(incident.address);
      if (!address) continue;

      const city = normalizeLocationPart(incident.city) || "UNKNOWN";
      const key = getNormalizedLocationKey(address, city);
      const existing = map.get(key) || {
        key,
        address,
        city,
        district: incident.district || "",
        beat: incident.beat || "",
        count: 0,
        callTypes: new Map<string, number>(),
      };

      existing.count += 1;
      if (!existing.district && incident.district) existing.district = incident.district;
      if (!existing.beat && incident.beat) existing.beat = incident.beat;
      if (incident.callType) {
        existing.callTypes.set(incident.callType, (existing.callTypes.get(incident.callType) || 0) + 1);
      }

      map.set(key, existing);
    }

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || a.address.localeCompare(b.address))
      .slice(0, 25);
  }, [locationEligibleIncidents]);

  const chartData = useMemo(
    () =>
      locations.slice(0, 10).map((location) => ({
        location: formatLocationLabel(location.address, location.city),
        count: location.count,
        key: location.key,
      })),
    [locations],
  );

  const summaryMonths = useMemo(() => {
    const months = new Map<string, Pick<MonthlyLocationSummary, "year" | "month" | "month_label">>();
    for (const row of monthlySummary) {
      months.set(`${row.year}-${row.month}`, {
        year: row.year,
        month: row.month,
        month_label: row.month_label,
      });
    }
    return Array.from(months.values()).sort((a, b) => a.year - b.year || a.month - b.month);
  }, [monthlySummary]);

  const summaryRowsByLocation = useMemo(() => {
    const map = new Map<string, MonthlyLocationSummary[]>();
    for (const row of monthlySummary) {
      const rows = map.get(row.normalized_location) || [];
      rows.push(row);
      map.set(row.normalized_location, rows);
    }
    return map;
  }, [monthlySummary]);

  const locationsWithTrends = useMemo<LocationSummaryWithTrend[]>(
    () =>
      locations.map((location) => {
        const rows = getLocationMonthlyRows(location, summaryRowsByLocation, summaryMonths, monthlySummary[0]?.last_updated || "");
        return {
          ...location,
          trend: rows.length > 0 ? getTrendSummary(rows) : null,
        };
      }),
    [locations, monthlySummary, summaryMonths, summaryRowsByLocation],
  );

  const selectedMonthlyRows = useMemo(
    () => {
      if (!selectedLocation) return [];
      return getLocationMonthlyRows(selectedLocation, summaryRowsByLocation, summaryMonths, monthlySummary[0]?.last_updated || "");
    },
    [monthlySummary, selectedLocation, summaryMonths, summaryRowsByLocation],
  );

  const selectedTrend = useMemo(
    () => (selectedMonthlyRows.length > 0 ? getTrendSummary(selectedMonthlyRows) : null),
    [selectedMonthlyRows],
  );

  const openLocationDetails = (key: string) => {
    const location = locations.find((item) => item.key === key);
    if (location) setSelectedLocation(location);
  };

  const totalCallsAtTop25 = locations.reduce((total, location) => total + location.count, 0);
  const top25Share =
    filteredIncidents.length > 0 ? (totalCallsAtTop25 / filteredIncidents.length) * 100 : 0;
  const excludedStationResponses = filteredIncidents.length - locationEligibleIncidents.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!availableFields.has("address")) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">
        No address/location field is available in this dataset.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Top Locations</h2>
        <p className="text-sm text-muted-foreground">
          Top 25 addresses by calls in the selected dashboard filter. Trend columns use the latest complete month and
          historical monthly averages.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Filtered Calls"
          value={filteredIncidents.length.toLocaleString()}
          subtitle="Current filters"
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          title="Excluded"
          value={excludedStationResponses.toLocaleString()}
          subtitle="Station response calls"
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          title="Top 25 Filter Calls"
          value={totalCallsAtTop25.toLocaleString()}
          subtitle={`${top25Share.toFixed(1)}% of filtered calls`}
          icon={<Building2 className="h-4 w-4" />}
        />
      </div>

      <ChartCard title="Top 10 Locations" subtitle="Highest call volume in the selected filter" visible={chartData.length > 0}>
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 24, left: 120, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                type="category"
                dataKey="location"
                width={118}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
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
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(data) => openLocationDetails(data.key)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {(summaryLoading || summaryError) && (
        <div className="rounded-md border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
          {summaryLoading ? "Loading 36-month intervention trends..." : `Trend summary unavailable: ${summaryError}`}
        </div>
      )}

      <div className="dashboard-card overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Rank</th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Location</th>
              {availableFields.has("district") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground">District</th>}
              {availableFields.has("beat") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Beat</th>}
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Filter Calls</th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Latest Month</th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Avg / Month 12M</th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Avg / Month 36M</th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Latest vs 12M</th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Latest vs 36M</th>
              {availableFields.has("callType") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Top Call Types</th>}
            </tr>
          </thead>
          <tbody>
            {locationsWithTrends.map((location, index) => (
              <tr
                key={location.key}
                className={`border-b border-border/50 transition-colors cursor-pointer ${getRowChangeClass(location.trend?.latestVs36Change)}`}
                onClick={() => setSelectedLocation(location)}
              >
                <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{index + 1}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{location.address}</div>
                  <div className="text-xs text-muted-foreground">{location.city}</div>
                </td>
                {availableFields.has("district") && <td className="px-3 py-2 text-xs">{location.district || "-"}</td>}
                {availableFields.has("beat") && <td className="px-3 py-2 text-xs">{location.beat || "-"}</td>}
                <td className="px-3 py-2 text-right font-semibold">{location.count.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-xs font-semibold">
                  {location.trend ? location.trend.recent.call_count.toLocaleString() : "-"}
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold">
                  {location.trend ? location.trend.recent12.averagePerMonth.toFixed(1) : "-"}
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold">
                  {location.trend ? location.trend.averagePerMonth.toFixed(1) : "-"}
                </td>
                <td className="px-3 py-2">
                  <ChangeBadge change={location.trend?.latestVs12Change} />
                </td>
                <td className="px-3 py-2">
                  <ChangeBadge change={location.trend?.latestVs36Change} />
                </td>
                {availableFields.has("callType") && (
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {getTopCallTypes(location.callTypes) || "-"}
                  </td>
                )}
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground text-sm">
                  No locations match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={selectedLocation !== null} onOpenChange={(open) => !open && setSelectedLocation(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedLocation ? formatLocationLabel(selectedLocation.address, selectedLocation.city) : "Location Trend"}</DialogTitle>
          </DialogHeader>

          {summaryLoading && (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading 36-month trend...</div>
          )}

          {!summaryLoading && summaryError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {summaryError}
            </div>
          )}

          {!summaryLoading && !summaryError && selectedLocation && selectedTrend && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                <MetricCard
                  title="Filter Calls"
                  value={selectedLocation.count.toLocaleString()}
                  subtitle="Selected dashboard range"
                  icon={<Activity className="h-4 w-4" />}
                />
                <MetricCard
                  title="Latest Month"
                  value={selectedTrend.recent.call_count.toLocaleString()}
                  subtitle={selectedTrend.recent.month_label}
                  icon={<MapPin className="h-4 w-4" />}
                />
                <MetricCard
                  title="Last 12 Avg"
                  value={selectedTrend.recent12.averagePerMonth.toFixed(1)}
                  subtitle={`${selectedTrend.recent12.total.toLocaleString()} calls total`}
                  icon={<Activity className="h-4 w-4" />}
                />
                <MetricCard
                  title="36 Mo Avg"
                  value={selectedTrend.averagePerMonth.toFixed(1)}
                  subtitle={`${selectedTrend.total.toLocaleString()} total calls`}
                  icon={<Activity className="h-4 w-4" />}
                />
                <MetricCard
                  title="Latest vs 12M"
                  value={formatChangeValue(selectedTrend.latestVs12Change)}
                  subtitle={getChangeComparisonSubtitle(selectedTrend.latestVs12Change, selectedTrend.latestMonth, selectedTrend.recent12)}
                  icon={getChangeIcon(selectedTrend.latestVs12Change)}
                />
                <MetricCard
                  title="Latest vs 36M"
                  value={formatChangeValue(selectedTrend.latestVs36Change)}
                  subtitle={getChangeComparisonSubtitle(selectedTrend.latestVs36Change, selectedTrend.latestMonth, selectedTrend.full36)}
                  icon={getChangeIcon(selectedTrend.latestVs36Change)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs text-muted-foreground">District</div>
                  <div className="font-semibold">{selectedTrend.district || selectedLocation.district || "-"}</div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs text-muted-foreground">Beat</div>
                  <div className="font-semibold">{selectedTrend.beat || selectedLocation.beat || "-"}</div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs text-muted-foreground">Updated</div>
                  <div className="font-semibold">{formatUpdatedDate(selectedTrend.lastUpdated)}</div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                Filter Calls follows the dashboard date filters. Latest Month and percent changes use the most recent
                complete month from the 36-month history. A single month can be noisy, so treat this as an intervention
                signal, not proof of causation.
              </div>

              <div className="rounded-md border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">36-Month Calls</h3>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedMonthlyRows} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="month_label"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        interval={2}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
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
                        formatter={(value: number) => [value.toLocaleString(), "Calls"]}
                      />
                      <Line type="monotone" dataKey="call_count" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-md border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Top Call Types Over Recent 12 Months</h3>
                <div className="space-y-2">
                  {selectedTrend.topCallTypes.map((item) => (
                    <div key={item.type} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{item.type}</span>
                      <span className="shrink-0 font-semibold">{item.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!summaryLoading && !summaryError && selectedLocation && !selectedTrend && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No 36-month summary is available for this location yet. Refresh the summary file and try again.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getLocationMonthlyRows(
  location: LocationSummary,
  rowsByLocation: Map<string, MonthlyLocationSummary[]>,
  summaryMonths: Pick<MonthlyLocationSummary, "year" | "month" | "month_label">[],
  lastUpdated: string,
) {
  const actualRows = rowsByLocation.get(location.key) || [];
  if (actualRows.length === 0 || summaryMonths.length === 0) return [];

  const rowsByMonth = new Map(actualRows.map((row) => [`${row.year}-${row.month}`, row]));

  return summaryMonths.map((month) => {
    const key = `${month.year}-${month.month}`;
    return rowsByMonth.get(key) || {
      location: location.address,
      normalized_location: location.key,
      district: location.district,
      beat: location.beat,
      year: month.year,
      month: month.month,
      month_label: month.month_label,
      call_count: 0,
      top_call_types: [],
      last_updated: lastUpdated,
    };
  });
}

function getTrendSummary(rows: MonthlyLocationSummary[]): LocationTrendSummary {
  const total = rows.reduce((sum, row) => sum + row.call_count, 0);
  const recent = rows[rows.length - 1];
  const peak = rows.reduce((max, row) => (row.call_count > max.call_count ? row : max), rows[0]);
  const recentRows = rows.slice(-MONTHS_PER_YEAR);
  const latestMonth = summarizeWindow([recent]);
  const recent12 = summarizeWindow(recentRows);
  const full36 = summarizeWindow(rows.slice(-HISTORY_MONTHS));
  const topCallTypes = combineTopCallTypes(recentRows);

  return {
    total,
    averagePerMonth: total / rows.length,
    latestMonth,
    recent12,
    full36,
    latestVs12Change: getChangeSummary(latestMonth, recent12),
    latestVs36Change: getChangeSummary(latestMonth, full36),
    recent,
    peak,
    topCallTypes,
    district: rows.find((row) => row.district)?.district || "",
    beat: rows.find((row) => row.beat)?.beat || "",
    lastUpdated: rows[0]?.last_updated || "",
  };
}

function summarizeWindow(rows: MonthlyLocationSummary[]): TrendWindowSummary {
  const total = rows.reduce((sum, row) => sum + row.call_count, 0);
  return {
    rows,
    total,
    averagePerMonth: rows.length > 0 ? total / rows.length : 0,
  };
}

function getChangeSummary(current: TrendWindowSummary, baseline: TrendWindowSummary): ChangeSummary {
  const averageDelta = current.averagePerMonth - baseline.averagePerMonth;

  if (baseline.rows.length < MONTHS_PER_YEAR) {
    return {
      percent: null,
      averageDelta,
      baselineTotal: baseline.total,
      hasSignal: false,
      reason: "Needs a complete 12-month comparison baseline.",
    };
  }

  if (baseline.total < MIN_BASELINE_CALLS) {
    return {
      percent: baseline.averagePerMonth > 0 ? (averageDelta / baseline.averagePerMonth) * 100 : null,
      averageDelta,
      baselineTotal: baseline.total,
      hasSignal: false,
      reason: `Baseline has ${baseline.total} calls; at least ${MIN_BASELINE_CALLS} are needed for color coding.`,
    };
  }

  const percent = baseline.averagePerMonth > 0 ? (averageDelta / baseline.averagePerMonth) * 100 : null;
  const hasSignal = Math.abs(averageDelta) >= MIN_AVERAGE_DELTA_FOR_SIGNAL;

  return {
    percent,
    averageDelta,
    baselineTotal: baseline.total,
    hasSignal,
    reason: hasSignal
      ? `${formatSignedDecimal(averageDelta)} calls/month compared with baseline.`
      : `Average change is ${formatSignedDecimal(averageDelta)} calls/month; at least ${MIN_AVERAGE_DELTA_FOR_SIGNAL.toFixed(1)} is needed for color coding.`,
  };
}

function getChangeBand(change?: ChangeSummary | null): ChangeBand {
  if (!change || change.percent === null || !change.hasSignal) return "insufficient";
  if (change.percent <= -15) return "strongDecrease";
  if (change.percent <= -10) return "moderateDecrease";
  if (change.percent <= -5) return "slightDecrease";
  if (change.percent >= 15) return "strongIncrease";
  if (change.percent >= 10) return "moderateIncrease";
  if (change.percent >= 5) return "slightIncrease";
  return "neutral";
}

function getRowChangeClass(change?: ChangeSummary | null) {
  return rowChangeClasses[getChangeBand(change)];
}

function formatChangeValue(change?: ChangeSummary | null) {
  if (!change || change.percent === null) return "n/a";
  return formatSignedPercent(change.percent);
}

function formatSignedPercent(value: number) {
  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(1)}%`;
}

function formatSignedDecimal(value: number) {
  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(1)}`;
}

function getChangeComparisonSubtitle(
  change: ChangeSummary,
  current: TrendWindowSummary,
  baseline: TrendWindowSummary,
) {
  if (change.percent === null) return "No complete baseline";
  const comparison = `${current.averagePerMonth.toFixed(1)} vs ${baseline.averagePerMonth.toFixed(1)}/mo`;
  return change.hasSignal ? comparison : `${comparison}; low signal`;
}

function getChangeIcon(change: ChangeSummary) {
  if (change.percent !== null && change.percent < 0) {
    return <TrendingDown className="h-4 w-4" />;
  }
  return <TrendingUp className="h-4 w-4" />;
}

function ChangeBadge({ change }: { change?: ChangeSummary | null }) {
  const band = getChangeBand(change);
  const isLowSignal = !change || change.percent === null || !change.hasSignal;

  return (
    <div className="inline-flex flex-col items-start gap-0.5" title={change?.reason || "No 36-month summary available."}>
      <span className={`rounded border px-2 py-1 text-xs font-semibold ${changeBadgeClasses[band]}`}>
        {formatChangeValue(change)}
      </span>
      {isLowSignal && <span className="text-[10px] leading-none text-muted-foreground">Insufficient signal</span>}
    </div>
  );
}

function combineTopCallTypes(rows: MonthlyLocationSummary[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const item of row.top_call_types) {
      counts.set(item.type, (counts.get(item.type) || 0) + item.count);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));
}

function formatUpdatedDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}
