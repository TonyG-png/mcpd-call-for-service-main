/**
 * Response Time Data Service
 * Fetches from Montgomery County dataset 98cc-bc7d via SODA API
 * with pagination to bypass 5,000-row limit.
 */

import { formatSocrataDateTime, getDateRangeBounds } from "@/lib/dateRanges";
import { isDetailCallType, isTruCallType } from "@/lib/callTypes";
import type { DateRangeOption } from "@/types/incident";

export interface ResponseTimeRecord {
  dispatch_date_time: string;
  calltime_dispatch: number | null;
  dispatch_arrive: number | null;
  priority: string | null;
  district: string | null;
  beat: string | null;
  callType: string | null;
}

interface ResponseTimeApiRow {
  start_time?: string;
  calltime_dispatch?: string | number | null;
  dispatch_arrive?: string | number | null;
  priority?: string | number | null;
  police_district_number?: string | number | null;
  sector?: string | number | null;
  initial_type?: string | number | null;
}

const BASE_URL = "https://data.montgomerycountymd.gov/resource/98cc-bc7d.json";
const PAGE_SIZE = 5000;
const MAX_RECORDS = 250000;

export async function fetchResponseTimeData(
  dateRange: DateRangeOption,
  onProgress?: (count: number) => void
): Promise<ResponseTimeRecord[]> {
  const bounds = getDateRangeBounds(dateRange);
  const startISO = formatSocrataDateTime(bounds.start);
  const clauses = [`start_time >= '${startISO}'`];

  if (bounds.end) {
    clauses.push(`start_time < '${formatSocrataDateTime(bounds.end)}'`);
  }

  const whereClause = clauses.join(" AND ");
  const selectFields = "start_time,calltime_dispatch,dispatch_arrive,priority,police_district_number,sector,initial_type";
  const allRecords: ResponseTimeRecord[] = [];
  let offset = 0;

  while (true) {
    const url = `${BASE_URL}?$select=${selectFields}&$where=${encodeURIComponent(whereClause)}&$order=start_time DESC&$limit=${PAGE_SIZE}&$offset=${offset}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    const rows = (await resp.json()) as ResponseTimeApiRow[];

    for (const r of rows) {
      const callType = r.initial_type != null ? String(r.initial_type) : null;
      if (isTruCallType(callType) || isDetailCallType(callType)) continue;

      allRecords.push({
        dispatch_date_time: r.start_time,
        calltime_dispatch: r.calltime_dispatch != null ? Number(r.calltime_dispatch) : null,
        dispatch_arrive: r.dispatch_arrive != null ? Number(r.dispatch_arrive) : null,
        priority: r.priority != null ? String(r.priority) : null,
        district: r.police_district_number != null ? String(r.police_district_number) : null,
        beat: r.sector != null ? String(r.sector) : null,
        callType,
      });
    }

    onProgress?.(allRecords.length);

    if (allRecords.length > MAX_RECORDS) {
      throw new Error(`Response time sync stopped: exceeded ${MAX_RECORDS.toLocaleString()} records to protect browser performance.`);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Response time fetch: ${allRecords.length} records for selected range`);
  return allRecords;
}

/** Format seconds to mm:ss */
export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
