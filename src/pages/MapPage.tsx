import { useMemo } from "react";
import { useData } from "@/context/DataContext";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useTheme } from "next-themes";
import { AlertTriangle } from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  "1": "#ef4444", "emergency": "#ef4444", "high": "#ef4444",
  "2": "#f59e0b", "non-emergency": "#f59e0b", "medium": "#f59e0b",
  "3": "#3b82f6", "low": "#3b82f6",
};

function getPriorityColor(priority?: string): string {
  if (!priority) return "#06b6d4";
  const key = priority.toLowerCase();
  for (const [k, v] of Object.entries(PRIORITY_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "#06b6d4";
}

export default function MapPage() {
  const { filteredIncidents, availableFields, isLoading } = useData();
  const { theme } = useTheme();

  const geoIncidents = useMemo(
    () => filteredIncidents.filter((inc) => inc.latitude && inc.longitude).slice(0, 1000),
    [filteredIncidents]
  );

  const hasGeo = availableFields.has("latitude") && availableFields.has("longitude");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasGeo || geoIncidents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto" />
          <p className="text-sm">No geographic data available for mapping.</p>
        </div>
      </div>
    );
  }

  const tileUrl = theme === "dark"
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold">Geographic View</h2>
        <span className="text-xs text-muted-foreground">{geoIncidents.length} incidents mapped</span>
      </div>
      <div className="dashboard-card overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
        <MapContainer
          center={[39.1, -77.2]}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer url={tileUrl} attribution='&copy; <a href="https://carto.com">CARTO</a>' />
          {geoIncidents.map((inc) => (
            <CircleMarker
              key={inc.id}
              center={[inc.latitude!, inc.longitude!]}
              radius={5}
              fillColor={getPriorityColor(inc.priority)}
              fillOpacity={0.7}
              stroke={false}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  {inc.incidentId && <p><strong>ID:</strong> {inc.incidentId}</p>}
                  {inc.callType && <p><strong>Type:</strong> {inc.callType}</p>}
                  {inc.priority && <p><strong>Priority:</strong> {inc.priority}</p>}
                  {inc.address && <p><strong>Location:</strong> {inc.address}</p>}
                  {inc.startTime && <p><strong>Time:</strong> {inc.startTime.toLocaleString()}</p>}
                  {inc.district && <p><strong>District:</strong> {inc.district}</p>}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Showing up to 1,000 incidents. Use filters to narrow results. District/beat boundary overlays can be added with GeoJSON files.
      </p>
    </div>
  );
}
