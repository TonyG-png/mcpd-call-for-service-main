/**
 * Socrata Data Service Layer
 * 
 * Handles schema discovery, field mapping, data fetching, and normalization
 * for any Socrata-hosted police calls for service dataset.
 * 
 * To adapt for a different dataset:
 * - Update config in src/config/dataset.ts
 * - If auto-discovery fails, provide fieldOverrides in config
 * - Adjust heuristics in discoverFieldMappings() if needed
 */

import { DatasetConfig } from "@/config/dataset";
import { formatSocrataDateTime, getDateRangeBounds } from "@/lib/dateRanges";
import type { DateRangeOption, FieldMapping, NormalizedIncident, SocrataColumn } from "@/types/incident";

interface SocrataMetadataColumn {
  fieldName?: string;
  name?: string;
  dataTypeName?: string;
  description?: string;
}

interface SocrataMetadataResponse {
  columns?: SocrataMetadataColumn[];
}

/** Fetch full schema from Socrata metadata API */
export async function fetchSchema(config: DatasetConfig): Promise<SocrataColumn[]> {
  const url = `https://${config.domain}/api/views/${config.datasetId}.json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Schema fetch failed: ${resp.status}`);
  const meta = (await resp.json()) as SocrataMetadataResponse;
  return (meta.columns || [])
    .filter((c): c is SocrataMetadataColumn & { fieldName: string } => Boolean(c.fieldName && !c.fieldName.startsWith(":")))
    .map((c) => ({
      fieldName: c.fieldName,
      name: c.name || c.fieldName,
      dataTypeName: c.dataTypeName || "text",
      description: c.description,
    }));
}

/** Fallback: infer columns from a sample data row */
export async function fetchSchemaFallback(config: DatasetConfig): Promise<SocrataColumn[]> {
  const url = `https://${config.domain}/resource/${config.datasetId}.json?$limit=1`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fallback schema fetch failed: ${resp.status}`);
  const rows = await resp.json();
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((key) => ({
    fieldName: key,
    name: key.replace(/_/g, " "),
    dataTypeName: inferType(rows[0][key]),
  }));
}

function inferType(value: unknown): string {
  if (value === null || value === undefined) return "text";
  if (typeof value === "number") return "number";
  if (typeof value === "object") return "point";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return "calendar_date";
  if (/^-?\d+\.?\d*$/.test(s)) return "number";
  return "text";
}

/**
 * Automatically discover field mappings by analyzing column names and types.
 * 
 * Heuristics match common Socrata column naming patterns for police CFS data.
 * To customize: either provide fieldOverrides in config, or adjust patterns below.
 */
export function discoverFieldMappings(
  columns: SocrataColumn[],
  overrides?: Record<string, string>
): FieldMapping {
  const mapping: FieldMapping = {};

  for (const col of columns) {
    const fn = col.fieldName.toLowerCase();
    const nm = (col.name || "").toLowerCase();
    const isDate = col.dataTypeName === "calendar_date" || col.dataTypeName === "floating_timestamp";
    const isText = col.dataTypeName === "text";
    const isNum = col.dataTypeName === "number";

    // Incident ID: fields containing "incident" + "id"/"number", or "cad", "case"
    if (!mapping.incidentId && (
      (fn.includes("incident") && (fn.includes("id") || fn.includes("number") || fn.includes("no"))) ||
      fn === "cad_number" || fn === "case_number" || fn === "ccn" ||
      (nm.includes("incident") && (nm.includes("id") || nm.includes("number")))
    )) {
      mapping.incidentId = col.fieldName;
    }

    // Crime report / case report number (written report)
    if (!mapping.crNumber && (
      fn === "cr_number" || fn === "cr_no" || fn === "report_number" ||
      (fn.includes("cr") && fn.includes("number")) ||
      nm.includes("crime report") || nm.includes("case report")
    )) {
      mapping.crNumber = col.fieldName;
    }

    // Crash / collision report number
    if (!mapping.crashReport && (
      fn.includes("crash") || fn.includes("collision") ||
      nm.includes("crash") || nm.includes("collision")
    )) {
      mapping.crashReport = col.fieldName;
    }

    // Start time: dispatch/start/received + date/time
    if (!mapping.startTime && isDate && (
      fn.includes("start") || fn.includes("dispatch") || fn.includes("received") ||
      fn.includes("open") || fn.includes("call") ||
      nm.includes("start") || nm.includes("dispatch")
    )) {
      mapping.startTime = col.fieldName;
    }

    // End time: end/close/clear + date/time
    if (!mapping.endTime && isDate && (
      fn.includes("end") || fn.includes("close") || fn.includes("clear") ||
      nm.includes("end") || nm.includes("close") || nm.includes("clear")
    )) {
      mapping.endTime = col.fieldName;
    }

    // Call type / incident type
    if (!mapping.callType && isText && (
      fn.includes("type") || fn.includes("description") || fn.includes("nature") ||
      fn.includes("initial_type") || fn.includes("call_type") ||
      nm.includes("type") || nm.includes("nature") || nm.includes("description")
    ) && !fn.includes("priority") && !fn.includes("address") && !fn.includes("city") &&
      !fn.includes("district") && !fn.includes("beat") && !fn.includes("sector") &&
      !fn.includes("location") && !fn.includes("status")
    ) {
      mapping.callType = col.fieldName;
    }

    // Priority
    if (!mapping.priority && (
      fn.includes("priority") || fn.includes("severity") ||
      nm.includes("priority")
    )) {
      mapping.priority = col.fieldName;
    }

    // District / sector / PSA
    if (!mapping.district && isText && (
      fn.includes("district") || fn.includes("sector") || fn.includes("psa") ||
      nm.includes("district") || nm.includes("police district")
    ) && !fn.includes("beat") && !fn.includes("address")) {
      mapping.district = col.fieldName;
    }

    // Beat / reporting area
    if (!mapping.beat && (
      fn.includes("beat") || fn.includes("sector") || fn.includes("reporting_area") ||
      fn === "ra" || nm.includes("beat")
    ) && !fn.includes("district") && fn !== "created_at") {
      mapping.beat = col.fieldName;
    }

    // Address / block / location (text)
    if (!mapping.address && isText && (
      fn.includes("address") || fn.includes("block") ||
      (fn.includes("location") && !fn.includes("type"))
    ) && !fn.includes("city") && !fn.includes("state") && !fn.includes("zip")) {
      mapping.address = col.fieldName;
    }

    // City
    if (!mapping.city && isText && (fn.includes("city") || fn === "city")) {
      mapping.city = col.fieldName;
    }

    // Latitude
    if (!mapping.latitude && (
      fn.includes("latitude") || fn === "lat" || fn === "y"
    ) && (isNum || col.dataTypeName === "text")) {
      mapping.latitude = col.fieldName;
    }

    // Longitude
    if (!mapping.longitude && (
      fn.includes("longitude") || fn === "lon" || fn === "lng" || fn === "long" || fn === "x"
    ) && (isNum || col.dataTypeName === "text")) {
      mapping.longitude = col.fieldName;
    }

    // Service category
    if (!mapping.serviceCategory && isText && (
      fn.includes("category") || fn.includes("service") ||
      nm.includes("category")
    ) && !fn.includes("type") && !fn.includes("address")) {
      mapping.serviceCategory = col.fieldName;
    }
  }

  // Fallback: if no start time found, use the first calendar_date field
  if (!mapping.startTime) {
    const dateCol = columns.find(
      (c) => c.dataTypeName === "calendar_date" || c.dataTypeName === "floating_timestamp"
    );
    if (dateCol) mapping.startTime = dateCol.fieldName;
  }

  // Handle Socrata point type for lat/lng
  if (!mapping.latitude || !mapping.longitude) {
    const pointCol = columns.find((c) => c.dataTypeName === "point");
    if (pointCol) {
      if (!mapping.latitude) mapping.latitude = `${pointCol.fieldName}.latitude`;
      if (!mapping.longitude) mapping.longitude = `${pointCol.fieldName}.longitude`;
    }
  }

  return { ...mapping, ...overrides };
}

const MAX_RECORDS = 250000;
const PAGE_SIZE = 5000;

/**
 * Fetch all data for the selected date range using the SODA API with $limit/$offset pagination.
 * Uses the mapped startTime field for date filtering.
 * Reports progress via onProgress callback.
 * Stops if total records exceed MAX_RECORDS safeguard.
 */
export async function fetchData(
  config: DatasetConfig,
  fieldMapping: FieldMapping,
  dateRange: DateRangeOption = 28,
  onProgress?: (loaded: number) => void
): Promise<Record<string, unknown>[]> {
  const timeField = fieldMapping.startTime || "start_time";
  const baseUrl = `https://${config.domain}/resource/${config.datasetId}.json`;
  const bounds = getDateRangeBounds(dateRange);
  const startDateISO = formatSocrataDateTime(bounds.start);
  const clauses = [`${timeField} >= '${startDateISO}'`];

  if (bounds.end) {
    clauses.push(`${timeField} < '${formatSocrataDateTime(bounds.end)}'`);
  }

  const whereClause = clauses.join(" AND ");

  const allRecords: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const url = `${baseUrl}?$where=${encodeURIComponent(whereClause)}&$order=${timeField} DESC&$limit=${PAGE_SIZE}&$offset=${offset}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`SODA fetch failed: ${resp.status}`);
    const rows: Record<string, unknown>[] = await resp.json();
    allRecords.push(...rows);
    onProgress?.(allRecords.length);

    if (allRecords.length > MAX_RECORDS) {
      throw new Error(`Sync stopped: exceeded ${MAX_RECORDS.toLocaleString()} records to protect browser performance.`);
    }

    // If we got fewer rows than PAGE_SIZE, we've reached the end
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`SODA fetch complete: ${allRecords.length} records for selected range`);
  return allRecords;
}

/** Normalize a raw Socrata row into our internal model */
export function normalizeIncident(
  raw: Record<string, unknown>,
  mapping: FieldMapping,
  index: number
): NormalizedIncident {
  const getValue = (field?: string): unknown => {
    if (!field) return undefined;
    if (field.includes(".")) {
      const parts = field.split(".");
      let val: unknown = raw;
      for (const part of parts) {
        val = typeof val === "object" && val !== null ? (val as Record<string, unknown>)[part] : undefined;
      }
      return val;
    }
    return raw[field];
  };

  const parseDate = (val: unknown): Date | undefined => {
    if (!val) return undefined;
    const d = new Date(String(val));
    return isNaN(d.getTime()) ? undefined : d;
  };

  const parseNum = (val: unknown): number | undefined => {
    if (val === null || val === undefined || val === "") return undefined;
    const n = Number(val);
    return isNaN(n) ? undefined : n;
  };

  return {
    id: String(getValue(mapping.incidentId) || `row-${index}`),
    incidentId: getValue(mapping.incidentId) as string | undefined,
    crNumber: getValue(mapping.crNumber) as string | undefined,
    crashReport: getValue(mapping.crashReport) as string | undefined,
    startTime: parseDate(getValue(mapping.startTime)),
    endTime: parseDate(getValue(mapping.endTime)),
    callType: getValue(mapping.callType) as string | undefined,
    priority: getValue(mapping.priority) as string | undefined,
    district: getValue(mapping.district) as string | undefined,
    beat: getValue(mapping.beat) as string | undefined,
    address: getValue(mapping.address) as string | undefined,
    city: getValue(mapping.city) as string | undefined,
    latitude: parseNum(getValue(mapping.latitude)),
    longitude: parseNum(getValue(mapping.longitude)),
    serviceCategory: getValue(mapping.serviceCategory) as string | undefined,
    raw,
  };
}
