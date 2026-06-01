import { useEffect, useMemo, useState } from "react";
import MetricCard from "@/components/dashboard/MetricCard";
import ChartCard from "@/components/dashboard/ChartCard";
import { AlertTriangle, CalendarClock, Car, FileText, Gauge, Loader2, MapPin, RefreshCw, ShieldCheck, Target } from "lucide-react";
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer } from "react-leaflet";
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

interface ForecastDiagnosticScore {
  label: string;
  hours: number;
  radiusFeet: number;
  hitRate: number;
  precision: number;
  falsePositiveBurden: number;
  predictiveAccuracyIndex: number;
  actualHits: number;
  selectedWithActual: number;
  selectedTargetCount: number;
  actualIncidentCount: number;
}

interface ForecastDiagnosticScores {
  sixHourExact?: ForecastDiagnosticScore;
  sixHour1500?: ForecastDiagnosticScore;
  sixHour2250?: ForecastDiagnosticScore;
  twelveHour1500?: ForecastDiagnosticScore;
  twentyFourHour1500?: ForecastDiagnosticScore;
}

interface ValidationMapPrediction {
  id: string;
  windowId: string;
  windowLabel: string;
  summaryLocation: string;
  probability: number;
  riskBand: string;
  district: string;
  beat: string;
  cell: {
    id: string;
    centroid: {
      latitude: number;
      longitude: number;
    };
    bounds?: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  };
}

interface ValidationActualIncident {
  id: string;
  offenseLabel: string;
  startTimeEastern: string;
  windowLabel: string;
  location: string;
  district: string;
  beat: string;
  place: string;
  latitude: number;
  longitude: number;
  missCategory: string;
  sameWindowDistanceFeet: number | null;
  nearestPrediction?: {
    summaryLocation: string;
    distanceFeet: number;
    windowLabel: string;
  } | null;
}

interface ForecastValidationDiagnostics {
  distanceSummary: {
    actualIncidentCount: number;
    exactCellCount: number;
    within1500FeetCount: number;
    within2250FeetCount: number;
    sameBeatSameWindowCount: number;
    sameDistrictSameWindowCount: number;
    noSameWindowPredictionCount: number;
    medianNearestFeet: number | null;
  };
  selectedPredictions: ValidationMapPrediction[];
  actualIncidents: ValidationActualIncident[];
}

interface ForecastValidation {
  forecastRunDate: string;
  forecastWindow: {
    start: string;
    end: string;
  };
  validatedAtEastern?: string;
  actualIncidentCount: number;
  metrics: Record<RiskGroup, {
    model: ForecastValidationMetric;
    baseline: ForecastValidationMetric;
    diagnosticScores?: {
      model: ForecastDiagnosticScores;
      baseline: ForecastDiagnosticScores;
    };
    actualIncidentCount: number;
    selectedPredictionCount: number;
  }>;
  diagnostics?: ForecastValidationDiagnostics;
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
  const [selectedWindowId, setSelectedWindowId] = useState("focus");
  const [selectedPrediction, setSelectedPrediction] = useState<ForecastPrediction | null>(null);
  const [isRefreshingAccuracy, setIsRefreshingAccuracy] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
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

  async function reloadVehicleRiskFiles() {
    const [forecastResponse, validationResponse] = await Promise.all([
      fetch(`/data/vehicle-risk-latest.json?ts=${Date.now()}`),
      fetch(`/data/vehicle-risk-validations-latest.json?ts=${Date.now()}`),
    ]);

    if (!forecastResponse.ok) throw new Error(`Latest forecast unavailable (${forecastResponse.status})`);
    setForecast(await forecastResponse.json());
    setValidationSummary(validationResponse.ok ? await validationResponse.json() : null);
  }

  async function handleRefreshAccuracy() {
    setIsRefreshingAccuracy(true);
    setRefreshMessage("Refreshing forecast and validation data. This may take a minute.");
    try {
      const response = await fetch("/api/vehicle-risk/run", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || result.stderr || `Refresh failed (${response.status})`);
      }
      await reloadVehicleRiskFiles();
      setRefreshMessage("Accuracy report refreshed with the latest public crime data.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refresh failed";
      setRefreshMessage(`${message}. If you are in development mode, make sure the local API server is running with npm run server.`);
    } finally {
      setIsRefreshingAccuracy(false);
    }
  }

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

  const forecastWindows = useMemo(() => {
    if (!forecast) return [];
    return Array.from(new Set(forecast.predictions.map(getWindowId))).sort();
  }, [forecast]);

  const focusedWindowIds = useMemo(() => getFocusedWindowIds(forecastWindows), [forecastWindows]);

  const mappedPredictions = useMemo(() => {
    if (!forecast) return [];
    return forecast.predictions
      .filter((prediction) => prediction.offenseGroup === selectedGroup)
      .filter((prediction) => {
        if (selectedWindowId === "focus") return getFocusedWindowIds(forecastWindows).includes(getWindowId(prediction));
        return selectedWindowId === "all" || prediction.windowLabel.startsWith(selectedWindowId);
      })
      .sort((a, b) => b.probability - a.probability || b.expectedIncidents - a.expectedIncidents)
      .slice(0, 80);
  }, [forecast, forecastWindows, selectedGroup, selectedWindowId]);

  const latestValidation = validationSummary?.validations?.[0];
  const latestCombinedDiagnosticScores = latestValidation?.metrics.combined.diagnosticScores?.model;
  const latestDistanceSummary = latestValidation?.diagnostics?.distanceSummary;
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
              onClick={() => {
                setSelectedGroup(group.value);
                setSelectedPrediction(null);
              }}
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

      <ChartCard title="What The Score Means">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Probability is the estimated chance of at least one matching vehicle-crime incident in one 750-foot grid cell during one 6-hour window.
          </p>
          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border p-3">
              <p className="font-medium text-foreground">Risk score</p>
              <p className="mt-1">Expected incidents multiplied by 1,000, used for ranking cells.</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="font-medium text-foreground">Probability</p>
              <p className="mt-1">Converted from expected incidents with a Poisson event model.</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="font-medium text-foreground">Risk bands</p>
              <p className="mt-1">Low &lt; 1.5%, Elevated 1.5-3.9%, High 4-7.9%, Very High 8%+.</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="font-medium text-foreground">Inputs</p>
              <p className="mt-1">History, recent nearby incidents, time, calendar, weather, parking, transit, and place type.</p>
            </div>
          </div>
        </div>
      </ChartCard>

      <ChartCard
        title="Risk Map"
        subtitle={`${GROUPS.find((group) => group.value === selectedGroup)?.label} forecast cells; default view emphasizes active/upcoming windows`}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedWindowId("focus")}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedWindowId === "focus"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Next active windows
          </button>
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
              {focusedWindowIds.includes(windowId) ? `${windowId} *` : windowId}
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
            {selectedPrediction && (
              <Polygon
                positions={getCellCorners(selectedPrediction)}
                pathOptions={{
                  color: "#38bdf8",
                  weight: 3,
                  fillColor: "#38bdf8",
                  fillOpacity: 0.18,
                }}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold">Selected 750-foot cell</p>
                    <p>{selectedPrediction.summaryLocation || "Forecast cell"}</p>
                    <p>{selectedPrediction.windowLabel}</p>
                  </div>
                </Popup>
              </Polygon>
            )}
          </MapContainer>
        </div>
      </ChartCard>

      <ChartCard title="Top Forecast Cells" subtitle={GROUPS.find((group) => group.value === selectedGroup)?.label}>
        {selectedPrediction && (
          <div className="mb-4 rounded-md border border-border p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Selected 750-Foot Cell</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedPrediction.summaryLocation || "Unknown area"}; {selectedPrediction.windowLabel}; {formatPercent(selectedPrediction.probability)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPrediction(null)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="overflow-hidden rounded-md border border-border" style={{ height: 320 }}>
              <MapContainer
                key={selectedPrediction.id}
                center={[selectedPrediction.cell.centroid.latitude, selectedPrediction.cell.centroid.longitude]}
                zoom={16}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <TileLayer url={tileUrl} attribution='&copy; <a href="https://carto.com">CARTO</a>' />
                <Polygon
                  positions={getCellCorners(selectedPrediction)}
                  pathOptions={{
                    color: "#38bdf8",
                    weight: 3,
                    fillColor: riskColors[selectedPrediction.riskBand] || riskColors.Low,
                    fillOpacity: 0.32,
                  }}
                />
                <CircleMarker
                  center={[selectedPrediction.cell.centroid.latitude, selectedPrediction.cell.centroid.longitude]}
                  radius={8}
                  color="#ffffff"
                  weight={2}
                  fillColor={riskColors[selectedPrediction.riskBand] || riskColors.Low}
                  fillOpacity={0.9}
                />
              </MapContainer>
            </div>
          </div>
        )}
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
                <tr
                  key={prediction.id}
                  className={`border-b border-border/50 hover:bg-secondary/40 ${selectedPrediction?.id === prediction.id ? "bg-primary/10" : ""}`}
                  onClick={() => {
                    setSelectedPrediction(prediction);
                    setSelectedWindowId(getWindowId(prediction));
                  }}
                >
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
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-3">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">
                      Latest validation: {latestValidation.forecastRunDate}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {latestValidation.forecastWindow.start} through {latestValidation.forecastWindow.end}; {latestValidation.actualIncidentCount} actual matching incident(s)
                      {latestValidation.validatedAtEastern ? `; scored ${latestValidation.validatedAtEastern}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshAccuracy}
                    disabled={isRefreshingAccuracy}
                    className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRefreshingAccuracy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Refresh Accuracy
                  </button>
                  <a
                    href="/data/vehicle-risk-validation-report.html"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Open Accuracy Report
                  </a>
                </div>
              </div>
              {refreshMessage && (
                <div className="rounded-md border border-border bg-secondary/25 p-3 text-xs text-muted-foreground">
                  {refreshMessage}
                </div>
              )}
              <div className="rounded-md border border-border bg-secondary/25 p-3 text-xs text-muted-foreground">
                Click <span className="font-medium text-foreground">Open Accuracy Report</span> for a readable page with tables and a print/save-to-PDF button. The JSON file stays available for the dashboard, but the report is the version meant for people.
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
              {latestCombinedDiagnosticScores && (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">Broader Combined Scoring</p>
                    <p className="text-xs text-muted-foreground">
                      Shows whether the same top cells would help if scored as larger patrol areas or longer time windows.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    {[
                      latestCombinedDiagnosticScores.sixHourExact,
                      latestCombinedDiagnosticScores.sixHour1500,
                      latestCombinedDiagnosticScores.sixHour2250,
                      latestCombinedDiagnosticScores.twelveHour1500,
                      latestCombinedDiagnosticScores.twentyFourHour1500,
                    ].filter(Boolean).map((score) => (
                      <div key={score!.label} className="rounded-md border border-border p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{score!.label}</p>
                        <p className="mt-1 text-lg font-bold text-foreground">{formatPercent(score!.hitRate)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {score!.actualHits}/{score!.actualIncidentCount} actuals; {formatPercent(score!.precision)} precision
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {latestDistanceSummary && (
                <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border border-border p-3">
                    <p className="font-medium text-foreground">Within 1,500 ft</p>
                    <p className="mt-1 text-muted-foreground">{latestDistanceSummary.within1500FeetCount}/{latestDistanceSummary.actualIncidentCount} same-window actuals</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="font-medium text-foreground">Within 2,250 ft</p>
                    <p className="mt-1 text-muted-foreground">{latestDistanceSummary.within2250FeetCount}/{latestDistanceSummary.actualIncidentCount} same-window actuals</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="font-medium text-foreground">Same Beat</p>
                    <p className="mt-1 text-muted-foreground">{latestDistanceSummary.sameBeatSameWindowCount}/{latestDistanceSummary.actualIncidentCount} actuals</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="font-medium text-foreground">Median Miss</p>
                    <p className="mt-1 text-muted-foreground">{latestDistanceSummary.medianNearestFeet ? `${latestDistanceSummary.medianNearestFeet.toLocaleString()} ft` : "n/a"}</p>
                  </div>
                </div>
              )}
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
        {latestValidation?.diagnostics && (
          <div className="lg:col-span-2">
            <ChartCard
              title="Validation Miss Map"
              subtitle="Blue boxes are selected combined-risk forecast cells; dots are actual incidents from the validated window."
            >
              <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Exact/near</span>
                <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> Within 2,250 ft</span>
                <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Farther away</span>
                <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500" /> No same-window prediction</span>
              </div>
              <div className="overflow-hidden rounded-md border border-border" style={{ height: 460 }}>
                <MapContainer
                  key={`validation-${latestValidation.forecastRunDate}`}
                  center={validationMapCenter(latestValidation.diagnostics)}
                  zoom={11}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  <TileLayer url={tileUrl} attribution='&copy; <a href="https://carto.com">CARTO</a>' />
                  {latestValidation.diagnostics.selectedPredictions.map((prediction) => (
                    <Polygon
                      key={prediction.id}
                      positions={getValidationCellCorners(prediction)}
                      pathOptions={{
                        color: "#2563eb",
                        weight: 2,
                        fillColor: "#3b82f6",
                        fillOpacity: 0.14,
                      }}
                    >
                      <Popup>
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold">{prediction.summaryLocation}</p>
                          <p><strong>Window:</strong> {prediction.windowLabel}</p>
                          <p><strong>Risk:</strong> {prediction.riskBand} ({formatPercent(prediction.probability)})</p>
                          <p><strong>Beat/District:</strong> {[prediction.beat, prediction.district].filter(Boolean).join(" / ")}</p>
                        </div>
                      </Popup>
                    </Polygon>
                  ))}
                  {latestValidation.diagnostics.actualIncidents.map((incident) => (
                    <CircleMarker
                      key={incident.id}
                      center={[incident.latitude, incident.longitude]}
                      radius={7}
                      color="#ffffff"
                      weight={1.5}
                      fillColor={missCategoryColor(incident.missCategory)}
                      fillOpacity={0.9}
                    >
                      <Popup>
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold">{incident.location}</p>
                          <p><strong>Offense:</strong> {incident.offenseLabel}</p>
                          <p><strong>Time:</strong> {incident.startTimeEastern}</p>
                          <p><strong>Beat/District:</strong> {[incident.beat, incident.district].filter(Boolean).join(" / ")}</p>
                          <p><strong>Nearest same-window forecast:</strong> {incident.nearestPrediction ? `${incident.nearestPrediction.summaryLocation} (${incident.sameWindowDistanceFeet?.toLocaleString()} ft)` : "None in top cells"}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            </ChartCard>
          </div>
        )}
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

      <div className="flex flex-wrap gap-3">
        <a
          href="/data/vehicle-risk-assessment-latest.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline"
        >
          <FileText className="h-3.5 w-3.5" />
          Open readable forecast assessment
        </a>
        <a
          href={`/data/vehicle-risk-latest.json?run=${forecast.metadata.runDate}`}
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
        >
          Raw forecast JSON
        </a>
      </div>
    </div>
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function circleRadius(probability: number) {
  return Math.max(8, Math.min(30, 8 + probability * 360));
}

function getWindowId(prediction: ForecastPrediction) {
  return prediction.windowLabel.slice(0, 16);
}

function getFocusedWindowIds(windowIds: string[]) {
  const now = new Date();
  const active = windowIds.filter((windowId) => {
    const range = parseWindowRange(windowId);
    return range ? range.end >= now : false;
  });

  return (active.length > 0 ? active : windowIds.slice(-8)).slice(0, 8);
}

function parseWindowRange(windowId: string) {
  const match = windowId.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):00-(\d{2}):00$/);
  if (!match) return null;

  const [, date, startHour, endHour] = match;
  const start = new Date(`${date}T${startHour}:00:00`);
  const end = new Date(`${date}T${endHour}:00:00`);
  if (Number(endHour) <= Number(startHour)) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
}

function validationMapCenter(diagnostics: ForecastValidationDiagnostics): [number, number] {
  const points = [
    ...diagnostics.actualIncidents.map((incident) => ({ latitude: incident.latitude, longitude: incident.longitude })),
    ...diagnostics.selectedPredictions.map((prediction) => prediction.cell.centroid),
  ].filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  if (points.length === 0) return [39.08, -77.12];
  return [
    points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
    points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
  ];
}

function getValidationCellCorners(prediction: ValidationMapPrediction): [number, number][] {
  const bounds = prediction.cell.bounds;
  if (bounds) {
    return [
      [bounds.north, bounds.west],
      [bounds.north, bounds.east],
      [bounds.south, bounds.east],
      [bounds.south, bounds.west],
    ];
  }
  return getCellCorners({
    cell: prediction.cell,
  } as ForecastPrediction);
}

function missCategoryColor(category: string) {
  if (category === "Exact cell" || category === "Within 1,500 ft") return "#22c55e";
  if (category === "Within 2,250 ft") return "#f59e0b";
  if (category === "No same-window prediction") return "#64748b";
  return "#ef4444";
}

function getCellCorners(prediction: ForecastPrediction): [number, number][] {
  const halfSideFeet = 375;
  const lat = prediction.cell.centroid.latitude;
  const lng = prediction.cell.centroid.longitude;
  const feetPerDegreeLat = 364000;
  const feetPerDegreeLng = Math.max(1, feetPerDegreeLat * Math.cos((lat * Math.PI) / 180));
  const dLat = halfSideFeet / feetPerDegreeLat;
  const dLng = halfSideFeet / feetPerDegreeLng;

  return [
    [lat + dLat, lng - dLng],
    [lat + dLat, lng + dLng],
    [lat - dLat, lng + dLng],
    [lat - dLat, lng - dLng],
  ];
}
