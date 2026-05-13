import fs from "node:fs/promises";
import path from "node:path";

const DOMAIN = "data.montgomerycountymd.gov";
const DATASET_ID = "98cc-bc7d";
const PAGE_SIZE = 5000;
const OUT_FILE = path.resolve("public/data/top-location-monthly-summary.json");
const TOP_OVERALL_LOCATIONS = 1000;
const TOP_LOCATIONS_PER_DISTRICT = 100;
const TOP_LOCATIONS_PER_BEAT = 50;

function normalizeLocationPart(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function getNormalizedLocationKey(address, city) {
  const normalizedAddress = normalizeLocationPart(address);
  const normalizedCity = normalizeLocationPart(city) || "UNKNOWN";
  return normalizedAddress ? `${normalizedAddress}|${normalizedCity}` : "";
}

function formatSocrataDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function getWindowBounds(now = new Date()) {
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(currentMonthStart);
  start.setMonth(start.getMonth() - 12);
  return { start, end: currentMonthStart };
}

function getTopCallTypes(callTypes) {
  return Array.from(callTypes.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));
}

function getCallTypeCode(callType) {
  return String(callType || "")
    .trim()
    .split(/\s*-\s*|\s+/)[0]
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

function isDetailCallType(callType) {
  return getCallTypeCode(callType) === "DT";
}

function addTopKeysByScope(locationTotals, getScope, limit, retainedKeys) {
  const scoped = new Map();

  for (const entry of locationTotals.values()) {
    const scope = getScope(entry);
    if (!scope) continue;
    const list = scoped.get(scope) || [];
    list.push(entry);
    scoped.set(scope, list);
  }

  for (const list of scoped.values()) {
    list
      .sort((a, b) => b.total - a.total || a.location.localeCompare(b.location))
      .slice(0, limit)
      .forEach((entry) => retainedKeys.add(entry.normalized_location));
  }
}

async function fetchRows(start, end) {
  const baseUrl = `https://${DOMAIN}/resource/${DATASET_ID}.json`;
  const selectFields = [
    "address",
    "city",
    "police_district_number",
    "sector",
    "start_time",
    "initial_type",
    "priority",
  ].join(",");
  const whereClause = [
    `start_time >= '${formatSocrataDateTime(start)}'`,
    `start_time < '${formatSocrataDateTime(end)}'`,
    "address IS NOT NULL",
  ].join(" AND ");

  const allRows = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      "$select": selectFields,
      "$where": whereClause,
      "$order": "start_time ASC",
      "$limit": String(PAGE_SIZE),
      "$offset": String(offset),
    });
    const url = `${baseUrl}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Socrata fetch failed: ${response.status} ${response.statusText}`);
    }

    const rows = await response.json();
    allRows.push(...rows);
    console.log(`Loaded ${allRows.length.toLocaleString()} rows...`);

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allRows;
}

async function main() {
  const { start, end } = getWindowBounds();
  console.log(`Refreshing location summary from ${formatSocrataDateTime(start)} to ${formatSocrataDateTime(end)}`);

  const rows = await fetchRows(start, end);
  const groups = new Map();

  for (const row of rows) {
    if (isDetailCallType(row.initial_type)) continue;

    const normalizedLocation = getNormalizedLocationKey(row.address, row.city);
    if (!normalizedLocation) continue;

    const startTime = row.start_time ? new Date(row.start_time) : null;
    if (!startTime || Number.isNaN(startTime.getTime())) continue;

    const year = startTime.getFullYear();
    const month = startTime.getMonth() + 1;
    const groupKey = `${normalizedLocation}|${getMonthKey(startTime)}`;
    const existing = groups.get(groupKey) || {
      location: normalizeLocationPart(row.address),
      normalized_location: normalizedLocation,
      district: row.police_district_number != null ? String(row.police_district_number) : "",
      beat: row.sector != null ? String(row.sector) : "",
      year,
      month,
      month_label: getMonthLabel(year, month),
      call_count: 0,
      callTypes: new Map(),
    };

    existing.call_count += 1;
    if (!existing.district && row.police_district_number != null) existing.district = String(row.police_district_number);
    if (!existing.beat && row.sector != null) existing.beat = String(row.sector);
    if (row.initial_type) {
      const callType = String(row.initial_type);
      existing.callTypes.set(callType, (existing.callTypes.get(callType) || 0) + 1);
    }
    groups.set(groupKey, existing);
  }

  const lastUpdated = new Date().toISOString();
  const locationTotals = new Map();

  for (const entry of groups.values()) {
    const total = locationTotals.get(entry.normalized_location) || {
      normalized_location: entry.normalized_location,
      location: entry.location,
      district: entry.district,
      beat: entry.beat,
      total: 0,
    };
    total.total += entry.call_count;
    if (!total.district && entry.district) total.district = entry.district;
    if (!total.beat && entry.beat) total.beat = entry.beat;
    locationTotals.set(entry.normalized_location, total);
  }

  const retainedKeys = new Set(
    Array.from(locationTotals.values())
      .sort((a, b) => b.total - a.total || a.location.localeCompare(b.location))
      .slice(0, TOP_OVERALL_LOCATIONS)
      .map((entry) => entry.normalized_location)
  );
  addTopKeysByScope(locationTotals, (entry) => entry.district, TOP_LOCATIONS_PER_DISTRICT, retainedKeys);
  addTopKeysByScope(locationTotals, (entry) => entry.beat, TOP_LOCATIONS_PER_BEAT, retainedKeys);

  const summary = Array.from(groups.values())
    .filter((entry) => retainedKeys.has(entry.normalized_location))
    .map((entry) => ({
      location: entry.location,
      normalized_location: entry.normalized_location,
      district: entry.district,
      beat: entry.beat,
      year: entry.year,
      month: entry.month,
      month_label: entry.month_label,
      call_count: entry.call_count,
      top_call_types: getTopCallTypes(entry.callTypes),
      last_updated: lastUpdated,
    }))
    .sort((a, b) =>
      a.normalized_location.localeCompare(b.normalized_location) ||
      a.year - b.year ||
      a.month - b.month
    );

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(summary)}\n`, "utf8");
  console.log(`Retained ${retainedKeys.size.toLocaleString()} high-interest locations`);
  console.log(`Wrote ${summary.length.toLocaleString()} monthly summary rows to ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
