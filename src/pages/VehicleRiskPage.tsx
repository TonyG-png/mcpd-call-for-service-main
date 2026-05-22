import { useEffect, useMemo, useState } from "react";
import MetricCard from "@/components/dashboard/MetricCard";
import ChartCard from "@/components/dashboard/ChartCard";
import { AlertTriangle, CalendarClock, Car, FileText, Gauge, MapPin, ShieldCheck, Target } from "lucide-react";
import { MapContainer, CircleMarker, Popup, TileLayer } from "react-leaflet";
import { useTheme } from "next-themes";

type RiskGroup = "combined" | "theft_from_auto" | "stolen_vehicle";

interface ForecastPrediction {
  id: string;
  offenseGroup: RiskGroup;
  offenseLabel: string;
  windowLabel: string;
  probability: number;
  expectedIncidents: number;
  riskBand: string;
  confidence: string;
  district?: string;
  beat?: string;
  place?: string;
  summaryLocation?: string;
  nearbyLocations?: string[];
  topDrivers: string[];
  cell: {
    id: string;
    centroid: {
      latitude: number;
      longitude: number;
    };
  };
}

interface VehicleRiskForecast {
  metadata: {
    generatedAtEastern: string;
    runDate: string;
    forecastStart: string;
    forecastEnd: string;
    candidateCellCount: number;
    historyIncidentCount: number;
    gridSizeFeet: number;
    caveat: string;
    auxiliary: {
      parkingPointCount: number;
      transitPointCount: number;
    };
  };
  topPredictions: Record<RiskGroup, ForecastPrediction[]>;
  predictions: ForecastPrediction[];
}

interface ForecastValidationMetric {
  hitRate: number;
  precision: number;
  falsePositiveBurden: number;
  brierScore: number;
  predictiveAccuracyIndex: number;
  actualHits: number;
  selectedWithActual: number;
}

interface ForecastValidation {
  forecastRunDate: string;
  forecastWindow: {
    start: string;
    end: string;
  };
  actualIncidentCount: number;
  metrics: Record<RiskGroup, {
    model: ForecastValidationMetric;
    baseline: ForecastValidationMetric;
    actualIncidentCount: number;
    selectedPredictionCount: number;
  }>;
}

interface ValidationSummary {
  validationStartDate: string;
  validations: ForecastValidation[];
}

const GROUPS: { value: RiskGroup; label: string }[] = [
  { value: "combined", label: "Combined" },
  { value: "theft_from_auto", label: "Theft From Auto" },
  { value: "stolen_vehicle", label: "Stolen Vehicle" },
];

const riskBandStyles: Record<string, string> = {
  "Very High": "border-destructive/40 bg-destructive/15 text-destructive",
  High: "border-orange-400/40 bg-orange-400/15 text-orange-300",
  Elevated: "border-amber-300/40 bg-amber-300/15 text-amber-200",
  Low: "border-emerald-400/40 bg-emerald-400/15 text-emerald-300",
};

const riskColors: Record<string, string> = {
  "Very High": "#ef4444",
  High: "#f97316",
  Elevated: "#facc15",
  Low: "#22c55e",
};

export default function VehicleRiskPage() {
  const [forecast, setForecast] = useState<VehicleRiskForecast | null>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<RiskGroup>("combined");
  const [selectedWindowId, setSelectedWindowId] = useState("all");
  const { theme } = useTheme();

  useEffect(() => {
    let active = true;
    fetch(`/data/vehicle-risk-latest.json?ts=${Date.now()}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Latest forecast unavailable (${response.status})`);
        return response.json();
      })
      .then((data) => {
        if (active) setForecast(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Latest forecast unavailable");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/data/vehicle-risk-validations-latest.json?ts=${Date.now()}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active) setValidationSummary(data);
      })
      .catch(() => {
        if (active) setValidationSummary(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedPredictions = useMemo(
    () => forecast?.topPredictions[selectedGroup] || [],
    [forecast, selectedGroup],
  );

  const mappedPredictions = useMemo(() => {
    if (!forecast) return [];
    return forecast.predictions
      .filter((prediction) => prediction.offenseGroup === selectedGroup)
      .filter((prediction) => selectedWindowId === "all" || prediction.windowLabel.startsWith(selectedWindowId))
      .sort((a, b) => b.probability - a.probability || b.expectedIncidents - a.expectedIncidents)
      .slice(0, 80);
  }, [forecast, selectedGroup, selectedWindowId]);

  const forecastWindows = useMemo(() => {
    if (!forecast) return [];
    return Array.from(new Set(forecast.predictions.map((prediction) => prediction.windowLabel.slice(0, 16))));
  }, [forecast]);

  const latestValidation = validationSummary?.validations?.[0];
  const highestRisk = selectedPredictions[0];
  const averageProbability = selectedPredictions.length
    ? selectedPredictions.reduce((sum, item) => sum + item.probability, 0) / selectedPredictions.length
    : 0;
  const tileUrl = theme === "dark"
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-display font-bold">Vehicle Risk</h2>
        <div className="dashboard-card p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">{error}. Run npm run vehicle-risk:forecast to generate the first file.</span>
          </div>
        </div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-display font-bold">Vehicle Risk</h2>
          <p className="text-xs text-muted-foreground">
            Generated {forecast.metadata.generatedAtEastern}; forecast {forecast.metadata.forecastStart} through {forecast.metadata.forecastEnd}
          </p>
        </div>
        <div className="inline-flex w-fit rounded-md border border-border bg-card p-1 text-xs">
          {GROUPS.map((group) => (
            <button
              key={group.value}
              type="button"
              onClick={() => setSelectedGroup(group.value)}
              className={`rounded px-3 py-1.5 font-medium transition-colors ${
                selectedGroup === group.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          title="Highest Risk"
          value={highestRisk ? `${formatPercent(highestRisk.probability)}` : "n/a"}
          subtitle={highestRisk?.riskBand || "No ranked cells"}
          icon={<Gauge className="h-4 w-4" />}
        />
        <MetricCard
          title="Top Avg"
          value={formatPercent(averageProbability)}
          subtitle={`${selectedPredictions.length} ranked cells`}
          icon={<Car className="h-4 w-4" />}
        />
        <MetricCard
          title="Candidate Cells"
          value={forecast.metadata.candidateCellCount.toLocaleString()}
          subtitle={`${forecast.metadata.gridSizeFeet} ft grid`}
          icon={<MapPin className="h-4 w-4" />}
        />
        <MetricCard
          title="History Used"
          value={forecast.metadata.historyIncidentCount.toLocaleString()}
          subtitle="public crime records"
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>

      <ChartCard
        title="Risk Map"
        subtitle={`${GROUPS.find((group) => group.value === selectedGroup)?.label} forecast cells`}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedWindowId("all")}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedWindowId === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            All windows
          </button>
          {forecastWindows.map((windowId) => (
            <button
              key={windowId}
              type="button"
              onClick={() => setSelectedWindowId(windowId)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedWindowId === windowId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {windowId}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-md border border-border" style={{ height: 520 }}>
          <MapContainer
            center={[39.08, -77.12]}
            zoom={11}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer url={tileUrl} attribution='&copy; <a href="https://carto.com">CARTO</a>' />
            {mappedPredictions.map((prediction, index) => (
              <CircleMarker
                key={`${prediction.id}-${index}`}
                center={[prediction.cell.centroid.latitude, prediction.cell.centroid.longitude]}
                radius={circleRadius(prediction.probability)}
                color="#ffffff"
                weight={1}
                fillColor={riskColors[prediction.riskBand] || riskColors.Low}
                fillOpacity={0.72}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold">{prediction.summaryLocation || "Forecast cell"}</p>
                    <p><strong>Window:</strong> {prediction.windowLabel}</p>
                    <p><strong>Risk:</strong> {prediction.riskBand} ({formatPercent(prediction.probability)})</p>
                    <p><strong>Beat/District:</strong> {[prediction.beat, prediction.district].filter(Boolean).join(" / ") || "Unknown"}</p>
                    <p><strong>Drivers:</strong> {prediction.topDrivers.slice(0, 3).join("; ")}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </ChartCard>

      <ChartCard title="Top Forecast Cells" subtitle={GROUPS.find((group) => group.value === selectedGroup)?.label}>
        <div className="overflow-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Rank</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Window</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Risk</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Probability</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Area</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Beat / District</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Drivers</th>
              </tr>
            </thead>
            <tbody>
              {selectedPredictions.map((prediction, index) => (
                <tr key={prediction.id} className="border-b border-border/50 hover:bg-secondary/40">
                  <td className="px-3 py-3 align-top text-xs font-mono">{index + 1}</td>
                  <td className="px-3 py-3 align-top text-xs whitespace-nowrap">{prediction.windowLabel}</td>
                  <td className="px-3 py-3 align-top">
                    <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${riskBandStyles[prediction.riskBand] || riskBandStyles.Low}`}>
                      {prediction.riskBand}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top text-xs font-semibold">{formatPercent(prediction.probability)}</td>
                  <td className="px-3 py-3 align-top text-xs">
                    <div className="font-medium text-foreground">{prediction.summaryLocation || "Unknown area"}</div>
                    <div className="text-muted-foreground">
                      {prediction.cell.centroid.latitude.toFixed(4)}, {prediction.cell.centroid.longitude.toFixed(4)}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top text-xs">{[prediction.beat, prediction.district].filter(Boolean).join(" / ") || "Unknown"}</td>
                  <td className="px-3 py-3 align-top text-xs text-muted-foreground">
                    {prediction.topDrivers.slice(0, 3).join("; ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Prediction Accuracy">
          {latestValidation ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">
                    Latest validation: {latestValidation.forecastRunDate}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latestValidation.forecastWindow.start} through {latestValidation.forecastWindow.end}; {latestValidation.actualIncidentCount} actual matching incident(s)
                  </p>
                </div>
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Group</th>
                      <th className="py-2 pr-3 font-medium">Hit Rate</th>
                      <th className="py-2 pr-3 font-medium">Baseline</th>
                      <th className="py-2 pr-3 font-medium">Precision</th>
                      <th className="py-2 pr-3 font-medium">PAI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GROUPS.map((group) => {
                      const metrics = latestValidation.metrics[group.value];
                      return (
                        <tr key={group.value} className="border-b border-border/50">
                          <td className="py-2 pr-3 font-medium">{group.label}</td>
                          <td className="py-2 pr-3">{formatPercent(metrics.model.hitRate)}</td>
                          <td className="py-2 pr-3">{formatPercent(metrics.baseline.hitRate)}</td>
                          <td className="py-2 pr-3">{formatPercent(metrics.model.precision)}</td>
                          <td className="py-2 pr-3">{metrics.model.predictiveAccuracyIndex.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 text-sm text-muted-foreground">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Validation starts after May 27, 2026, once a 72-hour forecast window has ended and at least 48 hours have passed for records to settle. Results will appear here and in saved validation JSON files.
              </p>
            </div>
          )}
        </ChartCard>
        <ChartCard title="Assessment Caveat">
          <div className="flex gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>{forecast.metadata.caveat}</p>
          </div>
        </ChartCard>
        <ChartCard title="Source Coverage">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Parking Points</p>
              <p className="font-display text-2xl font-bold">{forecast.metadata.auxiliary.parkingPointCount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Transit Stops</p>
              <p className="font-display text-2xl font-bold">{forecast.metadata.auxiliary.transitPointCount.toLocaleString()}</p>
            </div>
          </div>
        </ChartCard>
      </div>

      <a
        href={`/data/vehicle-risk-latest.json?run=${forecast.metadata.runDate}`}
        className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline"
      >
        <FileText className="h-3.5 w-3.5" />
        Latest forecast JSON
      </a>
    </div>
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function circleRadius(probability: number) {
  return Math.max(8, Math.min(30, 8 + probability * 360));
}
