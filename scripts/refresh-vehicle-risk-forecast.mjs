import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

loadEnv(path.join(rootDir, ".env"));

const EASTERN_TIME_ZONE = "America/New_York";
const CRIME_DOMAIN = "data.montgomerycountymd.gov";
const CRIME_DATASET_ID = "icn6-v9z3";
const GRID_SIZE_FEET = 750;
const GRID_ORIGIN = { latitude: 38.8, longitude: -77.6 };
const LAT_FEET_PER_DEGREE = 364000;
const LON_FEET_PER_DEGREE = LAT_FEET_PER_DEGREE * Math.cos((39.1 * Math.PI) / 180);
const TRAINING_DAYS = 1095;
const PAGE_SIZE = 5000;
const MAX_HISTORY_ROWS = 120000;
const TOP_PREDICTIONS_PER_GROUP = 140;
const TOP_ASSESSMENT_ROWS = 25;
const VALIDATION_TOP_N = 25;
const VALIDATION_START_YMD = "2026-05-27";
const VALIDATION_REFRESH_DAYS = Number(process.env.VEHICLE_RISK_VALIDATION_REFRESH_DAYS || 14);
const FORCE_REFRESH_VALIDATIONS =
  process.argv.includes("--refresh-validations") || process.env.VEHICLE_RISK_REFRESH_VALIDATIONS === "1";
const NWS_POINT = { latitude: 39.1, longitude: -77.2 };
const CAVEAT =
  "These predictions are place/time risk indicators only. They are not reasonable suspicion, probable cause, or a basis to target any person, vehicle, or specific address.";

const OFFENSE_GROUPS = {
  theft_from_auto: {
    label: "Theft From Auto",
    nibrsCodes: new Set(["23F"]),
  },
  stolen_vehicle: {
    label: "Stolen Vehicle",
    nibrsCodes: new Set(["240"]),
  },
};

const forecastDir = path.join(rootDir, "data", "vehicle-risk", "forecasts");
const assessmentDir = path.join(rootDir, "data", "vehicle-risk", "assessments");
const validationDir = path.join(rootDir, "data", "vehicle-risk", "validations");
const publicDataDir = path.join(rootDir, "public", "data");

async function main() {
  const now = getRunDate();
  const runYmd = easternYmd(now);
  const forecastStartYmd = runYmd;
  const forecastEndYmd = addLocalDays(forecastStartYmd, 3);
  const trainingStartYmd = addLocalDays(forecastStartYmd, -TRAINING_DAYS);

  await ensureDirectories();

  console.log(`Generating vehicle-risk forecast for ${runYmd}`);
  console.log(`Training window: ${trainingStartYmd} through ${forecastStartYmd}`);

  const [historyRows, auxiliarySignals, weatherWindows] = await Promise.all([
    fetchCrimeRows(trainingStartYmd, forecastStartYmd),
    fetchAuxiliarySignals(),
    fetchWeatherWindows(forecastStartYmd),
  ]);

  const history = historyRows.map(normalizeCrimeRow).filter(Boolean);
  if (history.length === 0) {
    throw new Error("No vehicle-related crime history was returned for the training window.");
  }

  const model = buildForecastModel(history, auxiliarySignals, forecastStartYmd, forecastEndYmd);
  const forecast = generateForecast({
    model,
    history,
    auxiliarySignals,
    weatherWindows,
    generatedAt: now,
    runYmd,
    forecastStartYmd,
    forecastEndYmd,
    trainingStartYmd,
  });

  const validations = await validateEligibleForecasts(now);
  await saveForecastArtifacts(forecast, validations);

  console.log(`Saved forecast: ${path.relative(rootDir, forecast.forecastPath)}`);
  console.log(`Saved assessment: ${path.relative(rootDir, forecast.assessmentPath)}`);
  console.log(`Saved latest dashboard data: ${path.relative(rootDir, forecast.latestPath)}`);
  if (validations.length > 0) {
    console.log(`Validated ${validations.length} prior forecast(s).`);
  }
}

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsAt = trimmed.indexOf("=");
    if (equalsAt === -1) continue;
    const key = trimmed.slice(0, equalsAt).trim();
    const value = trimmed.slice(equalsAt + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

async function ensureDirectories() {
  await Promise.all([
    mkdir(forecastDir, { recursive: true }),
    mkdir(assessmentDir, { recursive: true }),
    mkdir(validationDir, { recursive: true }),
    mkdir(publicDataDir, { recursive: true }),
  ]);
}

function getRunDate() {
  const override = process.env.VEHICLE_RISK_RUN_AT || process.env.VEHICLE_RISK_RUN_DATE;
  if (!override) return new Date();
  const parsed = new Date(override);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid VEHICLE_RISK_RUN_AT value: ${override}`);
  }
  return parsed;
}

function easternParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function easternYmd(date) {
  const parts = easternParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function addLocalDays(ymd, days) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0));
  return date.toISOString().slice(0, 10);
}

function easternDateTimeToUtc(ymd, hour = 0, minute = 0, second = 0) {
  const [year, month, day] = ymd.split("-").map(Number);
  const targetUtcMillis = Date.UTC(year, month - 1, day, hour, minute, second);
  const guess = new Date(targetUtcMillis);
  const observed = easternParts(guess);
  const observedUtcMillis = Date.UTC(
    observed.year,
    observed.month - 1,
    observed.day,
    observed.hour,
    observed.minute,
    observed.second,
  );
  return new Date(targetUtcMillis - (observedUtcMillis - targetUtcMillis));
}

function parseEasternFloatingDate(value) {
  const match = String(value || "").match(
    /^(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?:?(\d{2})?/,
  );
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  return easternDateTimeToUtc(`${year}-${month}-${day}`, Number(hour), Number(minute), Number(second));
}

function formatEastern(date) {
  const parts = easternParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function localHourBlock(date) {
  return Math.floor(easternParts(date).hour / 6);
}

function localDayOfWeek(date) {
  const ymd = easternYmd(date);
  const noonUtc = easternDateTimeToUtc(ymd, 12, 0, 0);
  return noonUtc.getUTCDay();
}

function localMonth(date) {
  return easternParts(date).month;
}

function localWindowLabel(window) {
  return `${formatEastern(new Date(window.startUtc))} to ${formatEastern(new Date(window.endUtc))}`;
}

async function fetchCrimeRows(startYmd, endYmd) {
  const select = [
    "incident_id",
    "case_number",
    "start_date",
    "nibrs_code",
    "crimename3",
    "district",
    "location",
    "city",
    "place",
    "sector",
    "beat",
    "pra",
    "latitude",
    "longitude",
    "police_district_number",
  ].join(",");
  const where = `start_date >= '${startYmd}T00:00:00' AND start_date < '${endYmd}T00:00:00' AND nibrs_code in('23F','240')`;

  if (process.env.SOCRATA_APP_TOKEN) {
    try {
      return await fetchCrimeRowsSoda3(select, where);
    } catch (error) {
      console.warn(`SODA3 query failed, falling back to SODA2: ${error.message}`);
    }
  }

  return fetchCrimeRowsSoda2(select, where);
}

async function fetchCrimeRowsSoda3(select, where) {
  const url = `https://${CRIME_DOMAIN}/api/v3/views/${CRIME_DATASET_ID}/query.json`;
  const query = `SELECT ${select} WHERE ${where} ORDER BY start_date DESC`;
  const rows = [];
  let pageNumber = 1;

  while (true) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Token": process.env.SOCRATA_APP_TOKEN,
      },
      body: JSON.stringify({
        query,
        page: { pageNumber, pageSize: PAGE_SIZE },
      }),
    });

    if (!response.ok) {
      throw new Error(`SODA3 HTTP ${response.status}`);
    }

    const payload = await response.json();
    const pageRows = normalizeSoda3Payload(payload);
    rows.push(...pageRows);
    if (rows.length > MAX_HISTORY_ROWS) {
      throw new Error(`Crime history exceeded ${MAX_HISTORY_ROWS.toLocaleString()} rows.`);
    }
    if (pageRows.length < PAGE_SIZE) break;
    pageNumber += 1;
  }

  return rows;
}

function normalizeSoda3Payload(payload) {
  if (Array.isArray(payload)) return payload;
  const rows =
    payload.rows ||
    payload.data ||
    payload.results ||
    payload.result ||
    payload?.data?.rows ||
    [];
  if (!Array.isArray(rows)) return [];
  if (rows.length === 0 || typeof rows[0] === "object" && !Array.isArray(rows[0])) return rows;

  const columns =
    payload.columns ||
    payload?.schema?.columns ||
    payload?.metadata?.columns ||
    payload?.meta?.view?.columns ||
    [];
  const names = columns.map((column) => column.fieldName || column.name).filter(Boolean);
  return rows.map((row) => Object.fromEntries(row.map((value, index) => [names[index] || `col_${index}`, value])));
}

async function fetchCrimeRowsSoda2(select, where) {
  const rows = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      $select: select,
      $where: where,
      $order: "start_date DESC",
      $limit: String(PAGE_SIZE),
      $offset: String(offset),
    });
    const url = `https://${CRIME_DOMAIN}/resource/${CRIME_DATASET_ID}.json?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`SODA2 HTTP ${response.status}`);
    const pageRows = await response.json();
    rows.push(...pageRows);
    if (rows.length > MAX_HISTORY_ROWS) {
      throw new Error(`Crime history exceeded ${MAX_HISTORY_ROWS.toLocaleString()} rows.`);
    }
    if (pageRows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

function normalizeCrimeRow(row) {
  const date = parseEasternFloatingDate(row.start_date);
  const latitude = Number(row.latitude ?? row.geolocation?.latitude);
  const longitude = Number(row.longitude ?? row.geolocation?.longitude);
  const offenseGroup = offenseGroupFor(row);
  if (!date || !offenseGroup || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!isPlausibleCountyCoordinate(latitude, longitude)) return null;

  const cell = gridCell(latitude, longitude);
  return {
    id: String(row.incident_id || row.case_number || `${row.start_date}-${latitude}-${longitude}`),
    caseNumber: row.case_number ? String(row.case_number) : "",
    startTimeUtc: date.toISOString(),
    startDate: date,
    offenseGroup,
    nibrsCode: String(row.nibrs_code || ""),
    crimeName: String(row.crimename3 || ""),
    district: cleanText(row.district),
    policeDistrictNumber: cleanText(row.police_district_number),
    location: cleanText(row.location),
    city: cleanText(row.city),
    place: cleanText(row.place),
    sector: cleanText(row.sector),
    beat: cleanText(row.beat),
    pra: cleanText(row.pra),
    latitude,
    longitude,
    cell,
  };
}

function isPlausibleCountyCoordinate(latitude, longitude) {
  return latitude >= 38.85 && latitude <= 39.4 && longitude >= -77.55 && longitude <= -76.85;
}

function offenseGroupFor(row) {
  const nibrs = String(row.nibrs_code || "").toUpperCase();
  if (OFFENSE_GROUPS.theft_from_auto.nibrsCodes.has(nibrs)) return "theft_from_auto";
  if (OFFENSE_GROUPS.stolen_vehicle.nibrsCodes.has(nibrs)) return "stolen_vehicle";
  const label = String(row.crimename3 || "").toUpperCase();
  if (label.includes("LARCENY") && label.includes("AUTO")) return "theft_from_auto";
  if (label.includes("AUTO THEFT") || label.includes("STOLEN VEHICLE") || label.includes("VEHICLE THEFT")) {
    return "stolen_vehicle";
  }
  return "";
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function gridCell(latitude, longitude) {
  const x = Math.floor(((longitude - GRID_ORIGIN.longitude) * LON_FEET_PER_DEGREE) / GRID_SIZE_FEET);
  const y = Math.floor(((latitude - GRID_ORIGIN.latitude) * LAT_FEET_PER_DEGREE) / GRID_SIZE_FEET);
  const centroid = gridCentroid(x, y);
  const halfLat = (GRID_SIZE_FEET / LAT_FEET_PER_DEGREE) / 2;
  const halfLon = (GRID_SIZE_FEET / LON_FEET_PER_DEGREE) / 2;
  return {
    id: `${x}:${y}`,
    x,
    y,
    centroid,
    bounds: {
      north: roundCoord(centroid.latitude + halfLat),
      south: roundCoord(centroid.latitude - halfLat),
      east: roundCoord(centroid.longitude + halfLon),
      west: roundCoord(centroid.longitude - halfLon),
    },
  };
}

function gridCentroid(x, y) {
  return {
    latitude: roundCoord(GRID_ORIGIN.latitude + ((y + 0.5) * GRID_SIZE_FEET) / LAT_FEET_PER_DEGREE),
    longitude: roundCoord(GRID_ORIGIN.longitude + ((x + 0.5) * GRID_SIZE_FEET) / LON_FEET_PER_DEGREE),
  };
}

function roundCoord(value) {
  return Number(value.toFixed(6));
}

async function fetchAuxiliarySignals() {
  const [publicParking, commercialParking, transitStops] = await Promise.allSettled([
    fetchAuxiliaryDataset("rd7s-ntxu", ["centroid_lat", "centroid_lng", "total_capacity", "car_spaces", "facility_name"]),
    fetchAuxiliaryDataset("weic-kzbi", ["geolocation", "number_of_spaces", "entity_name"]),
    fetchAuxiliaryDataset("sfeg-dbzu", ["the_geom", "stopid", "stopname"]),
  ]);

  const parkingPoints = [
    ...settledRows(publicParking).map((row) => pointFromRow(row, ["centroid_lat"], ["centroid_lng"], "parking")),
    ...settledRows(commercialParking).map((row) => pointFromRow(row, [], [], "parking")),
  ].filter(Boolean);
  const transitPoints = settledRows(transitStops).map((row) => pointFromRow(row, [], [], "transit")).filter(Boolean);

  const cellSignals = new Map();
  for (const point of parkingPoints) {
    addAuxiliaryInfluence(cellSignals, point, "parkingWeight", point.weight, 2);
  }
  for (const point of transitPoints) {
    addAuxiliaryInfluence(cellSignals, point, "transitWeight", 1, 2);
  }

  return {
    parkingPointCount: parkingPoints.length,
    transitPointCount: transitPoints.length,
    cellSignals,
  };
}

async function fetchAuxiliaryDataset(datasetId, fields) {
  const params = new URLSearchParams({
    $select: fields.join(","),
    $limit: "50000",
  });
  const url = `https://${CRIME_DOMAIN}/resource/${datasetId}.json?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${datasetId} HTTP ${response.status}`);
  return response.json();
}

function settledRows(result) {
  if (result.status === "fulfilled") return Array.isArray(result.value) ? result.value : [];
  console.warn(`Auxiliary dataset skipped: ${result.reason.message}`);
  return [];
}

function pointFromRow(row, latKeys, lonKeys, type) {
  const latitude = firstNumber(row, latKeys) ?? pointLatitude(row.geolocation) ?? pointLatitude(row.the_geom);
  const longitude = firstNumber(row, lonKeys) ?? pointLongitude(row.geolocation) ?? pointLongitude(row.the_geom);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const capacity = firstNumber(row, ["total_capacity", "car_spaces", "number_of_spaces"]) ?? 10;
  return {
    type,
    latitude,
    longitude,
    weight: Math.max(1, Math.log10(capacity + 1)),
  };
}

function firstNumber(row, keys) {
  for (const key of keys) {
    const value = parseNumeric(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function pointLatitude(point) {
  if (!point) return null;
  if (point.latitude !== undefined) return parseNumeric(point.latitude);
  if (Array.isArray(point.coordinates)) return parseNumeric(point.coordinates[1]);
  return null;
}

function pointLongitude(point) {
  if (!point) return null;
  if (point.longitude !== undefined) return parseNumeric(point.longitude);
  if (Array.isArray(point.coordinates)) return parseNumeric(point.coordinates[0]);
  return null;
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === "") return NaN;
  return Number(String(value).replace(/,/g, ""));
}

function addAuxiliaryInfluence(cellSignals, point, key, weight, radius) {
  const center = gridCell(point.latitude, point.longitude);
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius) continue;
      const id = `${center.x + dx}:${center.y + dy}`;
      const current = cellSignals.get(id) || { parkingWeight: 0, transitWeight: 0 };
      current[key] += weight / (1 + distance);
      cellSignals.set(id, current);
    }
  }
}

async function fetchWeatherWindows(forecastStartYmd) {
  try {
    const pointUrl = `https://api.weather.gov/points/${NWS_POINT.latitude},${NWS_POINT.longitude}`;
    const pointResponse = await fetch(pointUrl, { headers: nwsHeaders() });
    if (!pointResponse.ok) throw new Error(`NWS point HTTP ${pointResponse.status}`);
    const pointPayload = await pointResponse.json();
    const hourlyUrl = pointPayload?.properties?.forecastHourly;
    if (!hourlyUrl) throw new Error("NWS hourly forecast URL missing.");

    const hourlyResponse = await fetch(hourlyUrl, { headers: nwsHeaders() });
    if (!hourlyResponse.ok) throw new Error(`NWS hourly HTTP ${hourlyResponse.status}`);
    const hourlyPayload = await hourlyResponse.json();
    const periods = hourlyPayload?.properties?.periods || [];
    return summarizeWeatherByWindow(periods, buildWindows(forecastStartYmd, addLocalDays(forecastStartYmd, 3)));
  } catch (error) {
    console.warn(`Weather forecast skipped: ${error.message}`);
    return buildWindows(forecastStartYmd, addLocalDays(forecastStartYmd, 3)).map((window) => ({
      ...window,
      shortForecast: "Weather unavailable",
      precipitationProbability: null,
      temperature: null,
      weatherFactor: 1,
      drivers: ["weather forecast unavailable"],
    }));
  }
}

function nwsHeaders() {
  return {
    "User-Agent": process.env.NWS_USER_AGENT || "mcpd-call-for-service-dashboard/vehicle-risk local-analysis",
    Accept: "application/geo+json, application/json",
  };
}

function summarizeWeatherByWindow(periods, windows) {
  return windows.map((window) => {
    const start = new Date(window.startUtc).getTime();
    const end = new Date(window.endUtc).getTime();
    const matching = periods.filter((period) => {
      const periodStart = new Date(period.startTime).getTime();
      return Number.isFinite(periodStart) && periodStart >= start && periodStart < end;
    });
    if (matching.length === 0) {
      return {
        ...window,
        shortForecast: "Weather unavailable",
        precipitationProbability: null,
        temperature: null,
        weatherFactor: 1,
        drivers: ["weather forecast unavailable"],
      };
    }

    const precipitationValues = matching
      .map((period) => Number(period.probabilityOfPrecipitation?.value))
      .filter(Number.isFinite);
    const temperatures = matching.map((period) => Number(period.temperature)).filter(Number.isFinite);
    const precip = precipitationValues.length > 0 ? average(precipitationValues) : null;
    const temp = temperatures.length > 0 ? average(temperatures) : null;
    const forecastCounts = countBy(matching, (period) => period.shortForecast || "Forecast unavailable");
    const shortForecast = topEntries(forecastCounts, 1)[0]?.value || "Forecast unavailable";
    const hasRain = /rain|showers|thunder|snow|sleet|ice/i.test(shortForecast);
    const factor = hasRain || (precip ?? 0) >= 60 ? 0.9 : temp !== null && temp >= 45 && temp <= 80 ? 1.05 : 1;
    const drivers = [];
    if (hasRain || (precip ?? 0) >= 60) drivers.push("wet weather may reduce outdoor vehicle activity");
    if (temp !== null && temp >= 45 && temp <= 80 && factor > 1) drivers.push("mild weather may increase parked-vehicle activity");
    return {
      ...window,
      shortForecast,
      precipitationProbability: precip === null ? null : Math.round(precip),
      temperature: temp === null ? null : Math.round(temp),
      weatherFactor: factor,
      drivers,
    };
  });
}

function buildWindows(startYmd, endYmd) {
  const windows = [];
  let day = startYmd;
  while (day < endYmd) {
    for (const hour of [0, 6, 12, 18]) {
      const start = easternDateTimeToUtc(day, hour, 0, 0);
      const end = hour === 18 ? easternDateTimeToUtc(addLocalDays(day, 1), 0, 0, 0) : easternDateTimeToUtc(day, hour + 6, 0, 0);
      windows.push({
        id: `${day}T${pad2(hour)}`,
        startUtc: start.toISOString(),
        endUtc: end.toISOString(),
        localDate: day,
        hourBlock: hour / 6,
        localLabel: `${day} ${pad2(hour)}:00-${pad2((hour + 6) % 24)}:00`,
      });
    }
    day = addLocalDays(day, 1);
  }
  return windows;
}

function buildForecastModel(history, auxiliarySignals, forecastStartYmd, forecastEndYmd) {
  const trainingStart = history.reduce((earliest, incident) => Math.min(earliest, incident.startDate.getTime()), Infinity);
  const trainingEnd = easternDateTimeToUtc(forecastStartYmd, 0, 0, 0).getTime();
  const trainingDays = Math.max(1, Math.ceil((trainingEnd - trainingStart) / 86400000));
  const candidateCells = new Map();
  const global = {};

  for (const offenseGroup of Object.keys(OFFENSE_GROUPS)) {
    global[offenseGroup] = {
      total: 0,
      monthCounts: new Map(),
      dayBlockCounts: new Map(),
    };
  }

  for (const incident of history) {
    const cellStats = candidateCells.get(incident.cell.id) || createCellStats(incident.cell);
    const offenseStats = cellStats.offenses[incident.offenseGroup] || createOffenseStats();
    offenseStats.total += 1;
    increment(offenseStats.monthCounts, String(localMonth(incident.startDate)));
    increment(offenseStats.dayBlockCounts, `${localDayOfWeek(incident.startDate)}:${localHourBlock(incident.startDate)}`);
    increment(offenseStats.placeCounts, incident.place || "Unknown");
    increment(offenseStats.locationCounts, incident.location || "Unknown location");
    increment(offenseStats.districtCounts, incident.district || incident.policeDistrictNumber || "Unknown district");
    increment(offenseStats.beatCounts, incident.beat || incident.sector || "Unknown beat");
    offenseStats.recentIncidents.push({
      date: incident.startDate,
      offenseGroup: incident.offenseGroup,
      location: incident.location,
      place: incident.place,
    });
    cellStats.offenses[incident.offenseGroup] = offenseStats;
    candidateCells.set(incident.cell.id, cellStats);

    const globalStats = global[incident.offenseGroup];
    globalStats.total += 1;
    increment(globalStats.monthCounts, String(localMonth(incident.startDate)));
    increment(globalStats.dayBlockCounts, `${localDayOfWeek(incident.startDate)}:${localHourBlock(incident.startDate)}`);
  }

  for (const [cellId, signals] of auxiliarySignals.cellSignals) {
    const cellStats = candidateCells.get(cellId);
    if (cellStats) {
      cellStats.parkingWeight = signals.parkingWeight;
      cellStats.transitWeight = signals.transitWeight;
    }
  }

  return {
    trainingDays,
    forecastWindows: buildWindows(forecastStartYmd, forecastEndYmd),
    candidateCells,
    global,
  };
}

function createCellStats(cell) {
  return {
    cell,
    offenses: {},
    parkingWeight: 0,
    transitWeight: 0,
  };
}

function createOffenseStats() {
  return {
    total: 0,
    monthCounts: new Map(),
    dayBlockCounts: new Map(),
    placeCounts: new Map(),
    locationCounts: new Map(),
    districtCounts: new Map(),
    beatCounts: new Map(),
    recentIncidents: [],
  };
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function generateForecast({
  model,
  history,
  auxiliarySignals,
  weatherWindows,
  generatedAt,
  runYmd,
  forecastStartYmd,
  forecastEndYmd,
  trainingStartYmd,
}) {
  const forecastWindowById = new Map(weatherWindows.map((window) => [window.id, window]));
  const offensePredictions = [];

  for (const [, cellStats] of model.candidateCells) {
    for (const window of model.forecastWindows) {
      for (const offenseGroup of Object.keys(OFFENSE_GROUPS)) {
        const prediction = predictCellWindow({
          cellStats,
          offenseGroup,
          window,
          weather: forecastWindowById.get(window.id) || window,
          model,
          forecastStartYmd,
        });
        offensePredictions.push(prediction);
      }
    }
  }

  const combinedPredictions = combineOffensePredictions(offensePredictions);
  const predictions = [...offensePredictions, ...combinedPredictions];
  const selectedPredictions = selectTopPredictions(predictions);
  const windows = weatherWindows.map((window) => ({
    id: window.id,
    startUtc: window.startUtc,
    endUtc: window.endUtc,
    localLabel: window.localLabel,
    shortForecast: window.shortForecast,
    precipitationProbability: window.precipitationProbability,
    temperature: window.temperature,
  }));

  const forecast = {
    metadata: {
      generatedAt: generatedAt.toISOString(),
      generatedAtEastern: formatEastern(generatedAt),
      runDate: runYmd,
      forecastStart: forecastStartYmd,
      forecastEnd: forecastEndYmd,
      trainingStart: trainingStartYmd,
      trainingEnd: forecastStartYmd,
      trainingDays: model.trainingDays,
      gridSizeFeet: GRID_SIZE_FEET,
      timeZone: EASTERN_TIME_ZONE,
      forecastWindowHours: 6,
      candidateCellCount: model.candidateCells.size,
      historyIncidentCount: history.length,
      dataSources: [
        `Montgomery County Crime ${CRIME_DATASET_ID}`,
        "NWS hourly forecast",
        "Parking garage and lot inventory",
        "Commercial parking lots",
        "Ride On bus stops",
      ],
      auxiliary: {
        parkingPointCount: auxiliarySignals.parkingPointCount,
        transitPointCount: auxiliarySignals.transitPointCount,
      },
      caveat: CAVEAT,
      modelVersion: "vehicle-risk-place-time-v1",
    },
    windows,
    topPredictions: {
      combined: topForGroup(selectedPredictions, "combined", TOP_ASSESSMENT_ROWS),
      theft_from_auto: topForGroup(selectedPredictions, "theft_from_auto", TOP_ASSESSMENT_ROWS),
      stolen_vehicle: topForGroup(selectedPredictions, "stolen_vehicle", TOP_ASSESSMENT_ROWS),
    },
    predictions: selectedPredictions,
  };

  return forecast;
}

function predictCellWindow({ cellStats, offenseGroup, window, weather, model, forecastStartYmd }) {
  const offenseStats = cellStats.offenses[offenseGroup] || createOffenseStats();
  const globalStats = model.global[offenseGroup];
  const month = String(Number(window.localDate.slice(5, 7)));
  const dayBlock = `${localDayOfWeek(easternDateTimeToUtc(window.localDate, window.hourBlock * 6, 0, 0))}:${window.hourBlock}`;
  const baseExpected = (offenseStats.total + 0.25) / (model.trainingDays * 4);
  const monthFactor = smoothedFactor(globalStats.monthCounts.get(month) || 0, globalStats.total / 12, 0.75, 1.3);
  const dayBlockFactor = smoothedFactor(globalStats.dayBlockCounts.get(dayBlock) || 0, globalStats.total / 28, 0.7, 1.35);
  const recent = nearbyRecentCounts(cellStats.cell, offenseGroup, model.candidateCells, forecastStartYmd);
  const recentFactor = 1 + Math.min(3.25, recent.oneDay * 1.25 + recent.threeDay * 0.55 + recent.sevenDay * 0.22 + recent.fourteenDay * 0.1);
  const parkingWeight = Number.isFinite(cellStats.parkingWeight) ? cellStats.parkingWeight : 0;
  const transitWeight = Number.isFinite(cellStats.transitWeight) ? cellStats.transitWeight : 0;
  const auxFactor = 1 + Math.min(0.3, Math.log1p(parkingWeight) * 0.035 + Math.log1p(transitWeight) * 0.025);
  const calendarFactor = calendarRiskFactor(window);
  const weatherFactor = Number.isFinite(weather.weatherFactor) ? weather.weatherFactor : 1;
  const lambda = Math.max(
    0.0001,
    baseExpected * monthFactor * dayBlockFactor * recentFactor * auxFactor * calendarFactor * weatherFactor,
  );
  const probability = 1 - Math.exp(-lambda);
  const riskScore = lambda * 1000;
  const topLocations = topEntries(offenseStats.locationCounts, 3).map((entry) => entry.value);
  const meaningfulLocations = topLocations.filter((location) => !/^unknown/i.test(location));
  const district = topEntries(offenseStats.districtCounts, 1)[0]?.value || "";
  const beat = topEntries(offenseStats.beatCounts, 1)[0]?.value || "";
  const place = topEntries(offenseStats.placeCounts, 1)[0]?.value || "";
  const summaryLocation = meaningfulLocations[0] || [beat, district].filter(Boolean).join(" / ") || "Unknown area";

  return {
    id: `${offenseGroup}|${window.id}|${cellStats.cell.id}`,
    offenseGroup,
    offenseLabel: OFFENSE_GROUPS[offenseGroup].label,
    windowId: window.id,
    windowStart: window.startUtc,
    windowEnd: window.endUtc,
    windowLabel: window.localLabel,
    cell: cellStats.cell,
    probability: roundProbability(probability),
    expectedIncidents: Number(lambda.toFixed(5)),
    riskScore: Number(riskScore.toFixed(3)),
    riskBand: riskBand(probability),
    confidence: confidenceBand(offenseStats.total, recent),
    baselineScore: Number((baseExpected * recentFactor * 1000).toFixed(3)),
    recentIncidentCount: recent.fourteenDay,
    recentCounts: recent,
    historicalCount: offenseStats.total,
    district,
    beat,
    place,
    nearbyLocations: topLocations,
    summaryLocation,
    topDrivers: topDrivers({
      offenseStats,
      recent,
      monthFactor,
      dayBlockFactor,
      auxFactor,
      calendarFactor,
      weather,
      place,
      cellStats,
    }),
  };
}

function nearbyRecentCounts(cell, offenseGroup, candidateCells, forecastStartYmd) {
  const forecastStart = easternDateTimeToUtc(forecastStartYmd, 0, 0, 0).getTime();
  const counts = { oneDay: 0, threeDay: 0, sevenDay: 0, fourteenDay: 0 };
  for (let dx = -3; dx <= 3; dx += 1) {
    for (let dy = -3; dy <= 3; dy += 1) {
      if (Math.sqrt(dx * dx + dy * dy) > 3) continue;
      const neighbor = candidateCells.get(`${cell.x + dx}:${cell.y + dy}`);
      const incidents = neighbor?.offenses?.[offenseGroup]?.recentIncidents || [];
      for (const incident of incidents) {
        const ageDays = (forecastStart - incident.date.getTime()) / 86400000;
        if (ageDays < 0 || ageDays > 14) continue;
        const distanceWeight = 1 / (1 + Math.sqrt(dx * dx + dy * dy));
        if (ageDays <= 1) counts.oneDay += distanceWeight;
        if (ageDays <= 3) counts.threeDay += distanceWeight;
        if (ageDays <= 7) counts.sevenDay += distanceWeight;
        counts.fourteenDay += distanceWeight;
      }
    }
  }
  return {
    oneDay: Number(counts.oneDay.toFixed(2)),
    threeDay: Number(counts.threeDay.toFixed(2)),
    sevenDay: Number(counts.sevenDay.toFixed(2)),
    fourteenDay: Number(counts.fourteenDay.toFixed(2)),
  };
}

function smoothedFactor(observed, expected, min, max) {
  const factor = (observed + 8) / (expected + 8);
  return Math.max(min, Math.min(max, factor));
}

function calendarRiskFactor(window) {
  const start = easternDateTimeToUtc(window.localDate, window.hourBlock * 6, 0, 0);
  const dow = localDayOfWeek(start);
  const isWeekend = dow === 0 || dow === 6;
  const isOvernight = window.hourBlock === 0 || window.hourBlock === 3;
  const isHoliday = isUsHoliday(window.localDate);
  return (isWeekend ? 1.08 : 1) * (isOvernight ? 1.1 : 1) * (isHoliday ? 1.08 : 1);
}

function isUsHoliday(ymd) {
  const [, month, day] = ymd.split("-").map(Number);
  return (
    (month === 1 && day === 1) ||
    (month === 6 && day === 19) ||
    (month === 7 && day === 4) ||
    (month === 11 && day === 11) ||
    (month === 12 && day === 25)
  );
}

function topDrivers({ offenseStats, recent, monthFactor, dayBlockFactor, auxFactor, calendarFactor, weather, place, cellStats }) {
  const drivers = [];
  if (recent.oneDay >= 1) drivers.push(`${recent.oneDay.toFixed(1)} nearby relevant incident(s) in the last 24 hours`);
  else if (recent.threeDay >= 1) drivers.push(`${recent.threeDay.toFixed(1)} nearby relevant incident(s) in the last 3 days`);
  else if (recent.sevenDay >= 1) drivers.push(`${recent.sevenDay.toFixed(1)} nearby relevant incident(s) in the last 7 days`);
  if (offenseStats.total >= 10) drivers.push(`${offenseStats.total} historical incident(s) in this grid cell`);
  if (monthFactor >= 1.12) drivers.push("month/season is above this offense group's baseline");
  if (dayBlockFactor >= 1.12) drivers.push("day/time block is above this offense group's baseline");
  if (calendarFactor >= 1.15) drivers.push("weekend/overnight/holiday calendar pattern raises risk");
  if (cellStats.parkingWeight > 0) drivers.push("near public or commercial parking");
  if (cellStats.transitWeight > 0) drivers.push("near Ride On transit stops");
  if (place && place !== "Unknown") drivers.push(`common place type: ${place}`);
  drivers.push(...(weather.drivers || []));
  if (auxFactor >= 1.08) drivers.push("near vehicle-density activity nodes");
  return [...new Set(drivers)].slice(0, 5);
}

function combineOffensePredictions(offensePredictions) {
  const byCellWindow = new Map();
  for (const prediction of offensePredictions) {
    const key = `${prediction.windowId}|${prediction.cell.id}`;
    const existing = byCellWindow.get(key) || [];
    existing.push(prediction);
    byCellWindow.set(key, existing);
  }

  return Array.from(byCellWindow.values()).map((items) => {
    const first = items[0];
    const probability = 1 - items.reduce((product, item) => product * (1 - item.probability), 1);
    const expectedIncidents = items.reduce((sum, item) => sum + item.expectedIncidents, 0);
    const topDriversList = [...new Set(items.flatMap((item) => item.topDrivers))].slice(0, 5);
    return {
      ...first,
      id: `combined|${first.windowId}|${first.cell.id}`,
      offenseGroup: "combined",
      offenseLabel: "Combined Vehicle Risk",
      probability: roundProbability(probability),
      expectedIncidents: Number(expectedIncidents.toFixed(5)),
      riskScore: Number((expectedIncidents * 1000).toFixed(3)),
      riskBand: riskBand(probability),
      confidence: items.some((item) => item.confidence === "Higher") ? "Higher" : items.some((item) => item.confidence === "Moderate") ? "Moderate" : "Lower",
      baselineScore: Number(items.reduce((sum, item) => sum + item.baselineScore, 0).toFixed(3)),
      recentIncidentCount: Number(items.reduce((sum, item) => sum + item.recentIncidentCount, 0).toFixed(2)),
      recentCounts: {
        oneDay: Number(items.reduce((sum, item) => sum + item.recentCounts.oneDay, 0).toFixed(2)),
        threeDay: Number(items.reduce((sum, item) => sum + item.recentCounts.threeDay, 0).toFixed(2)),
        sevenDay: Number(items.reduce((sum, item) => sum + item.recentCounts.sevenDay, 0).toFixed(2)),
        fourteenDay: Number(items.reduce((sum, item) => sum + item.recentCounts.fourteenDay, 0).toFixed(2)),
      },
      historicalCount: items.reduce((sum, item) => sum + item.historicalCount, 0),
      topDrivers: topDriversList,
    };
  });
}

function roundProbability(value) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(4));
}

function riskBand(probability) {
  if (!Number.isFinite(probability)) return "Low";
  if (probability >= 0.08) return "Very High";
  if (probability >= 0.04) return "High";
  if (probability >= 0.015) return "Elevated";
  return "Low";
}

function confidenceBand(historicalCount, recent) {
  if (historicalCount >= 20 || recent.fourteenDay >= 3) return "Higher";
  if (historicalCount >= 8 || recent.fourteenDay >= 1.5) return "Moderate";
  return "Lower";
}

function selectTopPredictions(predictions) {
  const selected = [];
  for (const group of ["combined", "theft_from_auto", "stolen_vehicle"]) {
    selected.push(...topForGroup(predictions, group, TOP_PREDICTIONS_PER_GROUP));
  }
  const byId = new Map(selected.map((prediction) => [prediction.id, prediction]));
  return Array.from(byId.values()).sort((a, b) => b.probability - a.probability || b.riskScore - a.riskScore);
}

function topForGroup(predictions, group, limit) {
  return predictions
    .filter((prediction) => (
      prediction.offenseGroup === group &&
      (group === "combined" || prediction.historicalCount > 0 || prediction.recentIncidentCount > 0)
    ))
    .sort((a, b) => safeNumber(b.probability) - safeNumber(a.probability) || safeNumber(b.riskScore) - safeNumber(a.riskScore))
    .slice(0, limit);
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

async function validateEligibleForecasts(now) {
  const nowYmd = easternYmd(now);
  if (nowYmd < VALIDATION_START_YMD || !existsSync(forecastDir)) return [];
  const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
  const files = (await readdir(forecastDir)).filter((file) => file.endsWith(".json")).sort();
  const validations = [];

  for (const file of files) {
    const forecastPath = path.join(forecastDir, file);
    const forecast = JSON.parse(await readFile(forecastPath, "utf8"));
    const forecastYmd = forecast.metadata?.runDate || file.replace(".json", "");
    const outputPath = path.join(validationDir, `${forecastYmd}.json`);
    const horizonEnd = easternDateTimeToUtc(forecast.metadata.forecastEnd, 0, 0, 0).getTime();
    if (horizonEnd > cutoff) continue;
    if (existsSync(outputPath) && !FORCE_REFRESH_VALIDATIONS) {
      const refreshCutoff = now.getTime() - VALIDATION_REFRESH_DAYS * 24 * 60 * 60 * 1000;
      if (horizonEnd < refreshCutoff) continue;
    }

    const actualRows = await fetchCrimeRows(forecast.metadata.forecastStart, forecast.metadata.forecastEnd);
    const actuals = actualRows.map(normalizeCrimeRow).filter(Boolean);
    const validation = validateForecast(forecast, actuals, now);
    await writeFile(outputPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
    validations.push(validation);
  }

  return validations;
}

function validateForecast(forecast, actuals, validatedAt) {
  const windows = forecast.windows || [];
  const actualIndex = new Map();
  const totals = { combined: 0, theft_from_auto: 0, stolen_vehicle: 0 };

  for (const actual of actuals) {
    const window = windows.find((candidate) => {
      const start = new Date(candidate.startUtc).getTime();
      const end = new Date(candidate.endUtc).getTime();
      const actualTime = actual.startDate.getTime();
      return actualTime >= start && actualTime < end;
    });
    if (!window) continue;
    const groupKey = validationKey(actual.offenseGroup, window.id, actual.cell.id);
    const combinedKey = validationKey("combined", window.id, actual.cell.id);
    increment(actualIndex, groupKey);
    increment(actualIndex, combinedKey);
    totals[actual.offenseGroup] += 1;
    totals.combined += 1;
  }

  const groupMetrics = {};
  for (const group of ["combined", "theft_from_auto", "stolen_vehicle"]) {
    const modelSelected = topForGroup(forecast.predictions || [], group, VALIDATION_TOP_N);
    const baselineSelected = [...(forecast.predictions || [])]
      .filter((prediction) => prediction.offenseGroup === group)
      .sort((a, b) => b.baselineScore - a.baselineScore)
      .slice(0, VALIDATION_TOP_N);
    groupMetrics[group] = {
      model: scoreSelectedPredictions(modelSelected, actualIndex, totals[group], forecast.metadata?.candidateCellCount || 1),
      baseline: scoreSelectedPredictions(baselineSelected, actualIndex, totals[group], forecast.metadata?.candidateCellCount || 1),
      actualIncidentCount: totals[group],
      selectedPredictionCount: modelSelected.length,
    };
  }

  return {
    forecastRunDate: forecast.metadata.runDate,
    forecastWindow: {
      start: forecast.metadata.forecastStart,
      end: forecast.metadata.forecastEnd,
    },
    validatedAt: validatedAt.toISOString(),
    validatedAtEastern: formatEastern(validatedAt),
    actualIncidentCount: actuals.length,
    metrics: groupMetrics,
    caveat: CAVEAT,
  };
}

function validationKey(group, windowId, cellId) {
  return `${group}|${windowId}|${cellId}`;
}

function scoreSelectedPredictions(selected, actualIndex, actualTotal, candidateCellCount) {
  let selectedWithActual = 0;
  let actualHits = 0;
  let brierSum = 0;
  const uniqueCells = new Set();

  for (const prediction of selected) {
    const key = validationKey(prediction.offenseGroup, prediction.windowId, prediction.cell.id);
    const actualCount = actualIndex.get(key) || 0;
    const outcome = actualCount > 0 ? 1 : 0;
    if (outcome) selectedWithActual += 1;
    actualHits += actualCount;
    brierSum += Math.pow(prediction.probability - outcome, 2);
    uniqueCells.add(prediction.cell.id);
  }

  const hitRate = actualTotal > 0 ? actualHits / actualTotal : 0;
  const areaShare = Math.max(1 / candidateCellCount, uniqueCells.size / candidateCellCount);
  return {
    hitRate: roundMetric(hitRate),
    precision: selected.length > 0 ? roundMetric(selectedWithActual / selected.length) : 0,
    falsePositiveBurden: selected.length - selectedWithActual,
    brierScore: selected.length > 0 ? roundMetric(brierSum / selected.length) : 0,
    predictiveAccuracyIndex: roundMetric(hitRate / areaShare),
    actualHits,
    selectedWithActual,
  };
}

async function saveForecastArtifacts(forecast, validations) {
  const forecastPath = path.join(forecastDir, `${forecast.metadata.runDate}.json`);
  const assessmentPath = path.join(assessmentDir, `${forecast.metadata.runDate}.md`);
  const latestPath = path.join(publicDataDir, "vehicle-risk-latest.json");
  const latestAssessmentMarkdownPath = path.join(publicDataDir, "vehicle-risk-assessment-latest.md");
  const latestAssessmentHtmlPath = path.join(publicDataDir, "vehicle-risk-assessment-latest.html");

  forecast.forecastPath = forecastPath;
  forecast.assessmentPath = assessmentPath;
  forecast.latestPath = latestPath;

  const publicForecast = {
    ...forecast,
    forecastPath: undefined,
    assessmentPath: undefined,
    latestPath: undefined,
  };

  await writeFile(forecastPath, `${JSON.stringify(publicForecast, null, 2)}\n`, "utf8");
  await writeFile(latestPath, `${JSON.stringify(publicForecast, null, 2)}\n`, "utf8");
  await writeValidationSummary(validations);
  const assessmentMarkdown = buildAssessmentMarkdown(publicForecast, validations);
  await writeFile(assessmentPath, assessmentMarkdown, "utf8");
  await writeFile(latestAssessmentMarkdownPath, assessmentMarkdown, "utf8");
  await writeFile(
    latestAssessmentHtmlPath,
    buildHtmlDocument(`Vehicle Risk Forecast - ${forecast.metadata.runDate}`, assessmentMarkdown),
    "utf8",
  );
}

async function writeValidationSummary(currentRunValidations) {
  const latestPath = path.join(publicDataDir, "vehicle-risk-validations-latest.json");
  const latestMarkdownPath = path.join(publicDataDir, "vehicle-risk-validation-report.md");
  const latestHtmlPath = path.join(publicDataDir, "vehicle-risk-validation-report.html");
  const allValidations = [];

  if (existsSync(validationDir)) {
    const files = (await readdir(validationDir)).filter((file) => file.endsWith(".json")).sort();
    for (const file of files) {
      try {
        allValidations.push(JSON.parse(await readFile(path.join(validationDir, file), "utf8")));
      } catch (error) {
        console.warn(`Skipping unreadable validation ${file}: ${error.message}`);
      }
    }
  }

  for (const validation of currentRunValidations) {
    if (!allValidations.some((item) => item.forecastRunDate === validation.forecastRunDate)) {
      allValidations.push(validation);
    }
  }

  allValidations.sort((a, b) => String(b.forecastRunDate).localeCompare(String(a.forecastRunDate)));
  const summary = {
    generatedAt: new Date().toISOString(),
    validationStartDate: VALIDATION_START_YMD,
    caveat: CAVEAT,
    validations: allValidations.slice(0, 30),
  };

  await writeFile(latestPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  const validationMarkdown = buildValidationMarkdown(summary);
  await writeFile(latestMarkdownPath, validationMarkdown, "utf8");
  await writeFile(latestHtmlPath, buildHtmlDocument("Vehicle Risk Prediction Accuracy", validationMarkdown), "utf8");
}

function buildAssessmentMarkdown(forecast, validations) {
  const lines = [];
  lines.push(`# Vehicle Risk Forecast - ${forecast.metadata.runDate}`);
  lines.push("");
  lines.push(`Generated: ${forecast.metadata.generatedAtEastern} ${EASTERN_TIME_ZONE}`);
  lines.push(`Forecast window: ${forecast.metadata.forecastStart} through ${forecast.metadata.forecastEnd}`);
  lines.push(`Training window: ${forecast.metadata.trainingStart} through ${forecast.metadata.trainingEnd}`);
  lines.push("");
  lines.push(`**Caveat:** ${CAVEAT}`);
  lines.push("");
  lines.push("## Run Summary");
  lines.push("");
  lines.push(`- Historical vehicle-related incidents used: ${forecast.metadata.historyIncidentCount.toLocaleString()}`);
  lines.push(`- Candidate grid cells: ${forecast.metadata.candidateCellCount.toLocaleString()}`);
  lines.push(`- Grid size: ${forecast.metadata.gridSizeFeet} feet`);
  lines.push(`- Parking points loaded: ${forecast.metadata.auxiliary.parkingPointCount.toLocaleString()}`);
  lines.push(`- Transit stops loaded: ${forecast.metadata.auxiliary.transitPointCount.toLocaleString()}`);
  lines.push("");
  lines.push("## Weather Windows");
  lines.push("");
  lines.push("| Window | Forecast | Temp | Precip |");
  lines.push("| --- | --- | ---: | ---: |");
  for (const window of forecast.windows) {
    lines.push(
      `| ${window.localLabel} | ${window.shortForecast || "Unavailable"} | ${window.temperature ?? "n/a"} | ${window.precipitationProbability ?? "n/a"} |`,
    );
  }
  lines.push("");
  appendPredictionTable(lines, "Combined Vehicle Risk", forecast.topPredictions.combined);
  appendPredictionTable(lines, "Theft From Auto", forecast.topPredictions.theft_from_auto);
  appendPredictionTable(lines, "Stolen Vehicle", forecast.topPredictions.stolen_vehicle);

  lines.push("## Validation");
  lines.push("");
  if (validations.length === 0) {
    lines.push("No prior forecasts were old enough to validate during this run.");
  } else {
    for (const validation of validations) {
      lines.push(`### Forecast ${validation.forecastRunDate}`);
      lines.push("");
      lines.push(`Actual matching incidents: ${validation.actualIncidentCount}`);
      lines.push("");
      lines.push("| Group | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |");
      lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
      for (const group of ["combined", "theft_from_auto", "stolen_vehicle"]) {
        const metrics = validation.metrics[group];
        lines.push(
          `| ${groupLabel(group)} | ${formatPct(metrics.model.hitRate)} | ${formatPct(metrics.baseline.hitRate)} | ${formatPct(metrics.model.precision)} | ${metrics.model.brierScore.toFixed(3)} | ${metrics.model.predictiveAccuracyIndex.toFixed(2)} | ${metrics.model.falsePositiveBurden} |`,
        );
      }
      lines.push("");
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildValidationMarkdown(summary) {
  const lines = [];
  lines.push("# Vehicle Risk Prediction Accuracy");
  lines.push("");
  lines.push(`Generated: ${formatEastern(new Date())} ${EASTERN_TIME_ZONE}`);
  lines.push("");
  lines.push(`**Caveat:** ${CAVEAT}`);
  lines.push("");

  if (!summary.validations?.length) {
    lines.push("No forecast windows are old enough to validate yet.");
    lines.push("");
    lines.push(
      `Validation begins after ${summary.validationStartDate}, once a 72-hour forecast window has ended and at least 48 hours have passed for public records to settle.`,
    );
    lines.push("");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Latest Results");
  lines.push("");
  lines.push("| Forecast | Window | Actual Incidents | Combined Hit Rate | Combined Precision | Combined PAI |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: |");
  for (const validation of summary.validations) {
    const combined = validation.metrics.combined.model;
    lines.push(
      `| ${validation.forecastRunDate} | ${validation.forecastWindow.start} through ${validation.forecastWindow.end} | ${validation.actualIncidentCount} | ${formatPct(combined.hitRate)} | ${formatPct(combined.precision)} | ${combined.predictiveAccuracyIndex.toFixed(2)} |`,
    );
  }
  lines.push("");

  for (const validation of summary.validations) {
    lines.push(`## Forecast ${validation.forecastRunDate}`);
    lines.push("");
    lines.push(`Forecast window: ${validation.forecastWindow.start} through ${validation.forecastWindow.end}`);
    lines.push(`Actual matching incidents: ${validation.actualIncidentCount}`);
    lines.push("");
    lines.push("| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const group of ["combined", "theft_from_auto", "stolen_vehicle"]) {
      const metrics = validation.metrics[group];
      lines.push(
        `| ${groupLabel(group)} | ${metrics.actualIncidentCount} | ${metrics.selectedPredictionCount} | ${formatPct(metrics.model.hitRate)} | ${formatPct(metrics.baseline.hitRate)} | ${formatPct(metrics.model.precision)} | ${metrics.model.brierScore.toFixed(3)} | ${metrics.model.predictiveAccuracyIndex.toFixed(2)} | ${metrics.model.falsePositiveBurden} |`,
      );
    }
    lines.push("");
  }

  lines.push("## How To Read This");
  lines.push("");
  lines.push("- Hit rate is the share of actual incidents captured by the selected forecast cells.");
  lines.push("- Precision is the share of selected forecast cells that had at least one actual incident.");
  lines.push("- Baseline compares the model to a simple recent-hot-spots approach.");
  lines.push("- Brier score is probability error; lower is better.");
  lines.push("- PAI is concentration efficiency; higher is better.");
  lines.push("- False positives are selected forecast cells with no matching incident.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildHtmlDocument(title, markdown) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f8fafc; color: #0f172a; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 22px 56px; }
    h1, h2, h3 { letter-spacing: 0; line-height: 1.15; }
    h1 { margin: 0 0 18px; font-size: 30px; }
    h2 { margin-top: 34px; border-top: 1px solid #dbe3ef; padding-top: 22px; font-size: 21px; }
    h3 { margin-top: 24px; font-size: 17px; }
    p, li { color: #334155; line-height: 1.55; }
    strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0 24px; background: white; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08); }
    th, td { border: 1px solid #dbe3ef; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #edf2f7; color: #334155; font-weight: 700; }
    td:nth-child(1), th:nth-child(1) { white-space: nowrap; }
    ul { padding-left: 22px; }
    .toolbar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 18px; }
    button { border: 1px solid #cbd5e1; background: white; border-radius: 6px; padding: 8px 12px; color: #0f172a; font-weight: 600; cursor: pointer; }
    @media print { body { background: white; } main { max-width: none; padding: 0; } .toolbar { display: none; } table { box-shadow: none; break-inside: auto; } tr { break-inside: avoid; } }
  </style>
</head>
<body>
  <main>
    <div class="toolbar"><button onclick="window.print()">Print or Save PDF</button></div>
    ${markdownToHtml(markdown)}
  </main>
</body>
</html>
`;
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      html.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      list = [];
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }
    if (line.startsWith("| ")) {
      flushParagraph();
      flushList();
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith("| ")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      i -= 1;
      html.push(markdownTableToHtml(tableLines));
      continue;
    }
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return html.join("\n");
}

function markdownTableToHtml(lines) {
  const rows = lines
    .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
    .map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
  if (rows.length === 0) return "";
  const [header, ...body] = rows;
  return `<table><thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${body
    .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function inlineMarkdown(value) {
  return escapeHtml(value).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function appendPredictionTable(lines, title, predictions) {
  lines.push(`## ${title}`);
  lines.push("");
  lines.push("| Rank | Window | Risk | Probability | Area | Beat/District | Main Drivers |");
  lines.push("| ---: | --- | --- | ---: | --- | --- | --- |");
  predictions.slice(0, TOP_ASSESSMENT_ROWS).forEach((prediction, index) => {
    lines.push(
      `| ${index + 1} | ${prediction.windowLabel} | ${prediction.riskBand} | ${formatPct(prediction.probability)} | ${escapePipe(prediction.summaryLocation)} | ${escapePipe([prediction.beat, prediction.district].filter(Boolean).join(" / ") || "Unknown")} | ${escapePipe(prediction.topDrivers.join("; "))} |`,
    );
  });
  lines.push("");
}

function groupLabel(group) {
  if (group === "combined") return "Combined";
  return OFFENSE_GROUPS[group]?.label || group;
}

function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function escapePipe(value) {
  return String(value || "").replace(/\|/g, "/");
}

function topEntries(map, limit) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) increment(counts, getKey(item));
  return counts;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMetric(value) {
  return Number(value.toFixed(4));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
