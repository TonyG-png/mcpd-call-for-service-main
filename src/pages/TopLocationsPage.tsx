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
    if (!selectedLocation || monthlySummary.length > 0 || summaryError) return;

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
  }, [monthlySummary.length, selectedLocation, summaryError]);

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

  const selectedMonthlyRows = useMemo(
    () => {
      if (!selectedLocation) return [];

      const actualRows = monthlySummary.filter((row) => row.normalized_location === selectedLocation.key);
      if (actualRows.length === 0) return [];

      const rowsByMonth = new Map(actualRows.map((row) => [`${row.year}-${row.month}`, row]));

      return summaryMonths.map((month) => {
        const key = `${month.year}-${month.month}`;
        return rowsByMonth.get(key) || {
          location: selectedLocation.address,
          normalized_location: selectedLocation.key,
          district: selectedLocation.district,
          beat: selectedLocation.beat,
          year: month.year,
          month: month.month,
          month_label: month.month_label,
          call_count: 0,
          top_call_types: [],
          last_updated: monthlySummary[0]?.last_updated || "",
        };
      });
    },
    [monthlySummary, selectedLocation, summaryMonths],
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
          Top 25 addresses by calls for service in the current filter window, excluding station response calls.
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
          title="Top 25 Calls"
          value={totalCallsAtTop25.toLocaleString()}
          subtitle={`${top25Share.toFixed(1)}% of filtered calls`}
          icon={<Building2 className="h-4 w-4" />}
        />
      </div>

      <ChartCard title="Top 10 Locations" subtitle="Highest call volume among the top 25" visible={chartData.length > 0}>
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

      <div className="dashboard-card overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Rank</th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Location</th>
              {availableFields.has("district") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground">District</th>}
              {availableFields.has("beat") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Beat</th>}
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Calls</th>
              {availableFields.has("callType") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Top Call Types</th>}
            </tr>
          </thead>
          <tbody>
            {locations.map((location, index) => (
              <tr
                key={location.key}
                className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer"
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
                {availableFields.has("callType") && (
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {getTopCallTypes(location.callTypes) || "-"}
                  </td>
                )}
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-sm">
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
            <div className="py-10 text-center text-sm text-muted-foreground">Loading 12-month trend...</div>
          )}

          {!summaryLoading && summaryError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {summaryError}
            </div>
          )}

          {!summaryLoading && !summaryError && selectedLocation && selectedTrend && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <MetricCard
                  title="12-Month Calls"
                  value={selectedTrend.total.toLocaleString()}
                  subtitle="Complete months"
                  icon={<Activity className="h-4 w-4" />}
                />
                <MetricCard
                  title="Avg / Month"
                  value={selectedTrend.averagePerMonth.toFixed(1)}
                  subtitle="12-month average"
                  icon={<Activity className="h-4 w-4" />}
                />
                <MetricCard
                  title="Recent Month"
                  value={selectedTrend.recent.call_count.toLocaleString()}
                  subtitle={selectedTrend.recent.month_label}
                  icon={<MapPin className="h-4 w-4" />}
                />
                <MetricCard
                  title="Highest Month"
                  value={selectedTrend.peak.call_count.toLocaleString()}
                  subtitle={selectedTrend.peak.month_label}
                  icon={<TrendingUp className="h-4 w-4" />}
                />
                <MetricCard
                  title="Trend"
                  value={selectedTrend.label}
                  subtitle="Recent month vs prior average"
                  icon={selectedTrend.label === "Decreasing" ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
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

              <div className="rounded-md border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Month-by-Month Calls</h3>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedMonthlyRows} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="month_label"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--border))" }}
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
                <h3 className="text-sm font-semibold mb-3">Top Call Types Over 12 Months</h3>
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
              No 12-month summary is available for this location yet. Refresh the summary file and try again.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getTrendSummary(rows: MonthlyLocationSummary[]) {
  const total = rows.reduce((sum, row) => sum + row.call_count, 0);
  const recent = rows[rows.length - 1];
  const peak = rows.reduce((max, row) => (row.call_count > max.call_count ? row : max), rows[0]);
  const topCallTypes = combineTopCallTypes(rows);
  const priorRows = rows.slice(0, -1);
  const priorAverage =
    priorRows.length > 0 ? priorRows.reduce((sum, row) => sum + row.call_count, 0) / priorRows.length : recent.call_count;
  let label: "Increasing" | "Decreasing" | "Stable" | "Recent Spike" = "Stable";

  if (priorAverage === 0 && recent.call_count > 0) {
    label = "Recent Spike";
  } else if (recent.call_count >= priorAverage * 1.5 && recent.call_count >= peak.call_count * 0.8) {
    label = "Recent Spike";
  } else if (recent.call_count > priorAverage * 1.2) {
    label = "Increasing";
  } else if (recent.call_count < priorAverage * 0.8) {
    label = "Decreasing";
  }

  return {
    total,
    averagePerMonth: total / rows.length,
    recent,
    peak,
    label,
    topCallTypes,
    district: rows.find((row) => row.district)?.district || "",
    beat: rows.find((row) => row.beat)?.beat || "",
    lastUpdated: rows[0]?.last_updated || "",
  };
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
