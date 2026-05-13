import { useEffect, useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { VEHICLE_THEFT_CALL_TYPE } from "@/lib/callTypes";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { useTheme } from "next-themes";
import { AlertTriangle } from "lucide-react";

const TOP_LEGEND_LIMIT = 8;
const CLUSTER_GRID_SIZE = 52;
const INDIVIDUAL_MARKER_ZOOM = 15;
const OTHER_CATEGORY = "Other";
const VEHICLE_THEFT_COLOR = "#f97316";
const CATEGORY_COLORS = [
  "#06b6d4",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
];
const OTHER_COLOR = "#64748b";

type MapMode = "cluster" | "hotspots";

interface MapIncident {
  id: string;
  incidentId?: string;
  callType?: string;
  priority?: string;
  address?: string;
  startTime?: Date;
  district?: string;
  beat?: string;
  latitude: number;
  longitude: number;
  mapCategory: string;
  actualCategory: string;
}

interface MapCluster {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  incidents: MapIncident[];
  categoryCounts: { category: string; count: number }[];
}

function getClusterSize(count: number) {
  if (count >= 1000) return 52;
  if (count >= 250) return 46;
  if (count >= 75) return 40;
  if (count >= 20) return 34;
  return 30;
}

function getClusterIcon(cluster: MapCluster, categoryColorMap: Map<string, string>) {
  const dominantCategory = cluster.categoryCounts[0]?.category || OTHER_CATEGORY;
  const color = categoryColorMap.get(dominantCategory) || OTHER_COLOR;
  const size = getClusterSize(cluster.count);

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:9999px;
        background:${color};
        border:2px solid #ffffff;
        color:#ffffff;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:12px;
        font-weight:800;
        box-shadow:0 6px 18px rgba(0,0,0,0.35);
      ">${cluster.count.toLocaleString()}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ClusteredIncidentLayer({
  incidents,
  categoryColorMap,
}: {
  incidents: MapIncident[];
  categoryColorMap: Map<string, string>;
}) {
  const [zoom, setZoom] = useState(10);
  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });

  const clusters = useMemo<MapCluster[]>(() => {
    if (zoom >= INDIVIDUAL_MARKER_ZOOM) {
      return incidents.map((inc) => ({
        id: inc.id,
        latitude: inc.latitude,
        longitude: inc.longitude,
        count: 1,
        incidents: [inc],
        categoryCounts: [{ category: inc.mapCategory, count: 1 }],
      }));
    }

    const grouped = new Map<string, MapIncident[]>();
    for (const inc of incidents) {
      const projected = map.project(L.latLng(inc.latitude, inc.longitude), zoom);
      const key = `${Math.floor(projected.x / CLUSTER_GRID_SIZE)}:${Math.floor(projected.y / CLUSTER_GRID_SIZE)}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(inc);
      } else {
        grouped.set(key, [inc]);
      }
    }

    return Array.from(grouped.entries()).map(([key, group]) => {
      const categoryCountsMap = new Map<string, number>();
      let latitudeTotal = 0;
      let longitudeTotal = 0;

      for (const inc of group) {
        latitudeTotal += inc.latitude;
        longitudeTotal += inc.longitude;
        categoryCountsMap.set(inc.mapCategory, (categoryCountsMap.get(inc.mapCategory) || 0) + 1);
      }

      return {
        id: key,
        latitude: latitudeTotal / group.length,
        longitude: longitudeTotal / group.length,
        count: group.length,
        incidents: group,
        categoryCounts: Array.from(categoryCountsMap.entries())
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
      };
    });
  }, [incidents, map, zoom]);

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.count === 1) {
          const inc = cluster.incidents[0];
          return (
            <CircleMarker
              key={inc.id}
              center={[inc.latitude, inc.longitude]}
              radius={inc.priority === "0" ? 7 : 5}
              color={inc.priority === "0" ? "#ffffff" : categoryColorMap.get(inc.mapCategory)}
              weight={inc.priority === "0" ? 2 : 1}
              fillColor={categoryColorMap.get(inc.mapCategory)}
              fillOpacity={0.78}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  {inc.incidentId && <p><strong>ID:</strong> {inc.incidentId}</p>}
                  <p><strong>Mapped Category:</strong> {inc.mapCategory}</p>
                  {inc.mapCategory === OTHER_CATEGORY && inc.actualCategory && (
                    <p><strong>Type:</strong> {inc.actualCategory}</p>
                  )}
                  {inc.priority && <p><strong>Priority:</strong> {inc.priority}</p>}
                  {inc.address && <p><strong>Location:</strong> {inc.address}</p>}
                  {inc.startTime && <p><strong>Time:</strong> {inc.startTime.toLocaleString()}</p>}
                  {inc.district && <p><strong>District:</strong> {inc.district}</p>}
                  {inc.beat && <p><strong>Beat:</strong> {inc.beat}</p>}
                </div>
              </Popup>
            </CircleMarker>
          );
        }

        return (
          <Marker
            key={cluster.id}
            position={[cluster.latitude, cluster.longitude]}
            icon={getClusterIcon(cluster, categoryColorMap)}
            eventHandlers={{
              click: () => {
                map.setView(
                  [cluster.latitude, cluster.longitude],
                  Math.min(map.getZoom() + 2, INDIVIDUAL_MARKER_ZOOM),
                );
              },
            }}
          >
            <Popup>
              <div className="text-xs space-y-2">
                <p><strong>{cluster.count.toLocaleString()} calls in this area</strong></p>
                <div className="space-y-1">
                  {cluster.categoryCounts.slice(0, 5).map((item) => (
                    <p key={item.category} className="flex justify-between gap-3">
                      <span>{item.category}</span>
                      <strong>{item.count.toLocaleString()}</strong>
                    </p>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Click the cluster to zoom in.</p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function createHeatGradient() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0.05, "rgba(0, 0, 255, 0)");
  gradient.addColorStop(0.25, "#06b6d4");
  gradient.addColorStop(0.45, "#22c55e");
  gradient.addColorStop(0.62, "#facc15");
  gradient.addColorStop(0.78, "#f97316");
  gradient.addColorStop(1, "#ef4444");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1, 256);
  return ctx.getImageData(0, 0, 1, 256).data;
}

function HotSpotIncidentLayer({ incidents }: { incidents: MapIncident[] }) {
  const map = useMap();

  useEffect(() => {
    const pane = map.getPanes().overlayPane;
    const canvas = L.DomUtil.create("canvas", "leaflet-heatmap-layer") as HTMLCanvasElement;
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "450";
    pane.appendChild(canvas);

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const gradient = createHeatGradient();
    if (!ctx || !gradient) {
      canvas.remove();
      return undefined;
    }

    const drawHeat = () => {
      const size = map.getSize();
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);
      canvas.width = size.x;
      canvas.height = size.y;
      ctx.clearRect(0, 0, size.x, size.y);

      const radius = Math.max(24, Math.min(42, 20 + map.getZoom() * 1.5));
      const visibleBounds = map.getBounds().pad(0.2);

      ctx.globalCompositeOperation = "source-over";
      for (const inc of incidents) {
        const latLng = L.latLng(inc.latitude, inc.longitude);
        if (!visibleBounds.contains(latLng)) continue;
        const point = map.latLngToContainerPoint(latLng);
        const heat = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        heat.addColorStop(0, "rgba(0,0,0,0.075)");
        heat.addColorStop(0.45, "rgba(0,0,0,0.028)");
        heat.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = heat;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = image.data;
      let maxAlpha = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > maxAlpha) {
          maxAlpha = pixels[i + 3];
        }
      }

      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha === 0 || maxAlpha === 0) continue;
        const normalizedDensity = alpha / maxAlpha;
        if (normalizedDensity < 0.1) {
          pixels[i + 3] = 0;
          continue;
        }
        const emphasizedDensity = Math.pow(normalizedDensity, 1.75);
        const gradientIndex = Math.min(255, Math.max(0, Math.round(emphasizedDensity * 255))) * 4;
        pixels[i] = gradient[gradientIndex];
        pixels[i + 1] = gradient[gradientIndex + 1];
        pixels[i + 2] = gradient[gradientIndex + 2];
        pixels[i + 3] = Math.round(45 + emphasizedDensity * 175);
      }
      ctx.putImageData(image, 0, 0);
    };

    drawHeat();
    map.on("moveend zoomend resize", drawHeat);

    return () => {
      map.off("moveend zoomend resize", drawHeat);
      canvas.remove();
    };
  }, [incidents, map]);

  return null;
}

export default function MapPage() {
  const { filteredIncidents, availableFields, filters, isLoading } = useData();
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("cluster");

  const geoCandidates = useMemo(
    () => filteredIncidents.filter((inc) => inc.latitude && inc.longitude),
    [filteredIncidents]
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const inc of geoCandidates) {
      const category = inc.callType || "Unknown";
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    return counts;
  }, [geoCandidates]);

  const topCategories = useMemo(() => {
    return Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_LEGEND_LIMIT)
      .map(([category, count], index) => ({
        category,
        count,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }));
  }, [categoryCounts]);

  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of topCategories) {
      map.set(item.category, item.color);
    }
    if (!filters.callType && !map.has(VEHICLE_THEFT_CALL_TYPE)) {
      map.set(VEHICLE_THEFT_CALL_TYPE, VEHICLE_THEFT_COLOR);
    }
    map.set(OTHER_CATEGORY, OTHER_COLOR);
    return map;
  }, [filters.callType, topCategories]);

  const allGeoIncidents = useMemo<MapIncident[]>(
    () =>
      geoCandidates.map((inc) => {
        const actualCategory = inc.callType || "Unknown";
        const mapCategory = categoryColorMap.has(actualCategory) ? actualCategory : OTHER_CATEGORY;
        return {
          id: inc.id,
          incidentId: inc.incidentId,
          callType: inc.callType,
          priority: inc.priority,
          address: inc.address,
          startTime: inc.startTime,
          district: inc.district,
          beat: inc.beat,
          latitude: inc.latitude!,
          longitude: inc.longitude!,
          mapCategory,
          actualCategory,
        };
      }),
    [categoryColorMap, geoCandidates]
  );

  const geoIncidents = useMemo(
    () => allGeoIncidents.filter((inc) => !selectedCategory || inc.mapCategory === selectedCategory),
    [allGeoIncidents, selectedCategory],
  );

  const legendItems = useMemo(() => {
    const vehicleTheftLegendItem = {
      category: VEHICLE_THEFT_CALL_TYPE,
      count: categoryCounts.get(VEHICLE_THEFT_CALL_TYPE) || 0,
      color: categoryColorMap.get(VEHICLE_THEFT_CALL_TYPE) || VEHICLE_THEFT_COLOR,
    };
    const mappedOtherCount = geoCandidates.filter((inc) => {
      const category = inc.callType || "Unknown";
      return !categoryColorMap.has(category);
    }).length;

    const topWithoutVehicleTheft = topCategories.filter((item) => item.category !== VEHICLE_THEFT_CALL_TYPE);
    return [
      ...topWithoutVehicleTheft,
      ...(!filters.callType || categoryCounts.has(VEHICLE_THEFT_CALL_TYPE) ? [vehicleTheftLegendItem] : []),
      ...(mappedOtherCount > 0
        ? [{ category: OTHER_CATEGORY, count: mappedOtherCount, color: OTHER_COLOR }]
        : []),
    ];
  }, [categoryColorMap, categoryCounts, filters.callType, geoCandidates, topCategories]);

  const hasGeo = availableFields.has("latitude") && availableFields.has("longitude");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasGeo || allGeoIncidents.length === 0) {
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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <h2 className="text-xl font-display font-bold">Geographic View</h2>
          <div className="inline-flex w-fit rounded-md border border-border bg-card p-1 text-xs">
            {[
              { value: "cluster", label: "Cluster" },
              { value: "hotspots", label: "Hot Spots" },
            ].map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setMapMode(mode.value as MapMode)}
                className={`rounded px-3 py-1.5 font-medium transition-colors ${
                  mapMode === mode.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {geoIncidents.length.toLocaleString()} of {geoCandidates.length.toLocaleString()} geocoded incidents mapped
          {selectedCategory ? ` (${selectedCategory})` : ""}
        </span>
      </div>
      <div className="dashboard-card overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
        <MapContainer
          center={[39.1, -77.2]}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer url={tileUrl} attribution='&copy; <a href="https://carto.com">CARTO</a>' />
          {mapMode === "cluster" ? (
            <ClusteredIncidentLayer incidents={geoIncidents} categoryColorMap={categoryColorMap} />
          ) : (
            <HotSpotIncidentLayer incidents={geoIncidents} />
          )}

          <div className="leaflet-bottom leaflet-left">
            <div className="leaflet-control m-3 max-w-[240px] rounded-md border border-border bg-card/95 p-3 text-xs text-foreground shadow-lg backdrop-blur">
              <div className="mb-2 font-semibold font-display">Call Type Legend</div>
              <div className="space-y-1.5">
                {legendItems.map((item) => (
                  <button
                    key={item.category}
                    type="button"
                    onClick={() => setSelectedCategory((current) => current === item.category ? null : item.category)}
                    className={`flex w-full items-center justify-between gap-3 rounded px-1.5 py-1 text-left transition-colors hover:bg-accent ${
                      selectedCategory === item.category ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate" title={item.category}>{item.category}</span>
                    </div>
                    <span className="shrink-0 text-muted-foreground">{item.count.toLocaleString()}</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
                Click a legend item to isolate that category. Click it again to show all categories. Vehicle Theft is available when viewing all call types. Priority 0 calls have a white outline in Cluster mode.
              </div>
            </div>
          </div>
        </MapContainer>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {mapMode === "cluster"
          ? "Marker clustering is enabled for high-volume views. Click a cluster to zoom into that area."
          : "Hot spots show relative call density as a heat surface for the current filters and selected legend category."} Use filters to narrow results. District/beat boundary overlays can be added with GeoJSON files.
      </p>
    </div>
  );
}
