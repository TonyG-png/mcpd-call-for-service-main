import { useMemo } from "react";
import { MapPin, Activity, Building2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "@/context/DataContext";
import ChartCard from "@/components/dashboard/ChartCard";
import MetricCard from "@/components/dashboard/MetricCard";

interface LocationSummary {
  key: string;
  address: string;
  city: string;
  district: string;
  beat: string;
  count: number;
  callTypes: Map<string, number>;
}

const normalizeLocationPart = (value?: string) =>
  value?.trim().replace(/\s+/g, " ").toUpperCase() || "";

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
      const key = `${address}|${city}`;
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
        location: `${location.address}${location.city !== "UNKNOWN" ? `, ${location.city}` : ""}`,
        count: location.count,
      })),
    [locations],
  );

  const totalCallsAtTop25 = locations.reduce((total, location) => total + location.count, 0);
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Filtered Calls"
          value={filteredIncidents.length.toLocaleString()}
          subtitle="Current filters"
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          title="Locations Ranked"
          value={locations.length}
          subtitle="Showing top 25"
          icon={<MapPin className="h-4 w-4" />}
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
          subtitle="Calls at ranked locations"
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
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
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
              <tr key={location.key} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
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
    </div>
  );
}
