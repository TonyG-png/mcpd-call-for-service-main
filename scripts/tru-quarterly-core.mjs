const DAY_MS = 86_400_000;
const TRU_THRESHOLDS = [3600, 7200, 10800, 14400];

export function isTelephoneReportingUnitCallType(callType) {
  const value = String(callType || "").toUpperCase();
  return value.includes("TRS") || value.includes("TELEPHONE REPORTING UNIT");
}

export function getCallTypeCode(callType) {
  return String(callType || "")
    .trim()
    .split(/\s*-\s*|\s+/)[0]
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

export function isDetailCallType(callType) {
  return getCallTypeCode(callType) === "DT";
}

export function normalizeReportNumber(value) {
  return String(value || "").trim().toUpperCase();
}

export function getCompleteQuarterWindow(now = new Date(), quarterCount = 8) {
  const year = now.getUTCFullYear();
  const currentQuarterMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  const end = new Date(Date.UTC(year, currentQuarterMonth, 1));
  const start = new Date(Date.UTC(year, currentQuarterMonth - quarterCount * 3, 1));
  const quarters = [];

  for (let cursor = new Date(start); cursor < end; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 3, 1))) {
    const quarter = Math.floor(cursor.getUTCMonth() / 3) + 1;
    const quarterEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 3, 1));
    quarters.push({
      id: `${cursor.getUTCFullYear()} Q${quarter}`,
      start: formatDate(cursor),
      end: formatDate(quarterEnd),
      days: Math.round((quarterEnd.getTime() - cursor.getTime()) / DAY_MS),
    });
  }

  return {
    start: formatDate(start),
    end: formatDate(end),
    quarters,
  };
}

export function buildQuarterlyAnalysis(rows, now = new Date()) {
  const window = getCompleteQuarterWindow(now, 8);
  const quarterById = new Map(window.quarters.map((quarter) => [quarter.id, quarter]));
  const countywideQuarterAccumulators = new Map(
    window.quarters.map((quarter) => [quarter.id, createAccumulator(quarter.start, quarter.end)]),
  );
  const countywideSummaryAccumulator = createAccumulator(window.start, window.end);
  const districtQuarterAccumulators = new Map();
  const districtSummaryAccumulators = new Map();
  let excludedDetailCalls = 0;
  let excludedOutsideWindow = 0;

  for (const row of rows) {
    const date = getDateParts(row.start_time);
    if (!date) continue;
    const dateKey = `${date.year}-${pad(date.month)}-${pad(date.day)}`;
    if (dateKey < window.start || dateKey >= window.end) {
      excludedOutsideWindow += 1;
      continue;
    }

    const finalType = String(row.close_type || "");
    if (isDetailCallType(finalType)) {
      excludedDetailCalls += 1;
      continue;
    }

    const quarterId = `${date.year} Q${Math.floor((date.month - 1) / 3) + 1}`;
    const quarter = quarterById.get(quarterId);
    if (!quarter) continue;
    const district = normalizeDistrict(row.police_district_number);

    addRow(countywideQuarterAccumulators.get(quarterId), row, date);
    addRow(countywideSummaryAccumulator, row, date);

    if (!districtQuarterAccumulators.has(district)) {
      districtQuarterAccumulators.set(
        district,
        new Map(window.quarters.map((entry) => [entry.id, createAccumulator(entry.start, entry.end)])),
      );
      districtSummaryAccumulators.set(district, createAccumulator(window.start, window.end));
    }
    addRow(districtQuarterAccumulators.get(district).get(quarterId), row, date);
    addRow(districtSummaryAccumulators.get(district), row, date);
  }

  const countywide = {
    summary: finalizeAccumulator(countywideSummaryAccumulator),
    quarters: window.quarters.map((quarter) => ({
      quarter: quarter.id,
      start: quarter.start,
      end: quarter.end,
      days: quarter.days,
      ...finalizeAccumulator(countywideQuarterAccumulators.get(quarter.id)),
    })),
  };

  const byDistrict = Object.fromEntries(
    Array.from(districtSummaryAccumulators.keys())
      .sort(compareDistricts)
      .map((district) => [
        district,
        {
          summary: finalizeAccumulator(districtSummaryAccumulators.get(district)),
          quarters: window.quarters.map((quarter) => ({
            quarter: quarter.id,
            start: quarter.start,
            end: quarter.end,
            days: quarter.days,
            ...finalizeAccumulator(districtQuarterAccumulators.get(district).get(quarter.id)),
          })),
        },
      ]),
  );

  return {
    generated_at: now.toISOString(),
    source: {
      domain: "data.montgomerycountymd.gov",
      dataset_id: "98cc-bc7d",
      dataset_name: "Police Dispatched Incidents",
    },
    analysis_type: "last_eight_complete_quarters",
    period_start: window.start,
    period_end_exclusive: window.end,
    quarters: window.quarters.map((quarter) => quarter.id),
    methodology: {
      tru_definition: "Final close_type contains TRS or Telephone Reporting Unit.",
      event_report_definition: "Unique nonblank cr_number; mixed TRU/non-TRU numbers are attributed to TRU within each scope and period.",
      patrol_estimate_definition: "Non-TRU-coded activity; the public source does not identify the handling unit.",
      duration_definition: "CAD call pickup to last unit cleared using calltime_cleared, restricted to 0 through 23:59:59.",
      excludes_detail_calls: true,
      excludes_crash_reports_from_event_report_comparison: true,
    },
    source_rows: rows.length,
    excluded_detail_calls: excludedDetailCalls,
    excluded_outside_window: excludedOutsideWindow,
    countywide,
    by_district: byDistrict,
    district_comparison: Object.entries(byDistrict).map(([district, value]) => ({
      district,
      ...pickComparisonMetrics(value.summary),
    })),
  };
}

export function flattenQuarterlyCsv(analysis) {
  const rows = analysis.countywide.quarters.map((quarter) => csvRow("Countywide", "Countywide", quarter));
  for (const [district, value] of Object.entries(analysis.by_district)) {
    for (const quarter of value.quarters) rows.push(csvRow("District", district, quarter));
  }
  return rows;
}

function createAccumulator(start, end) {
  return {
    start,
    end,
    dayCount: daysBetween(start, end),
    totalCalls: 0,
    truCalls: 0,
    truCallsWithoutReport: 0,
    patrolCalls: 0,
    reportNumbers: new Map(),
    truDurations: [],
    patrolReportDurations: [],
    routing: { remained_tru: 0, routed_into_tru: 0, routed_away_from_tru: 0 },
    typeCounts: new Map(),
    noReportTypeCounts: new Map(),
    hourCounts: Array(24).fill(0),
    weekdayCounts: Array(7).fill(0),
  };
}

function addRow(accumulator, row, date) {
  const finalType = String(row.close_type || "");
  const initialType = String(row.initial_type || "");
  const finalTru = isTelephoneReportingUnitCallType(finalType);
  const initialTru = isTelephoneReportingUnitCallType(initialType);
  const reportNumber = normalizeReportNumber(row.cr_number);

  accumulator.totalCalls += 1;
  if (finalTru) accumulator.truCalls += 1;
  else accumulator.patrolCalls += 1;

  if (reportNumber) {
    const report = accumulator.reportNumbers.get(reportNumber) || { hasTru: false };
    report.hasTru ||= finalTru;
    accumulator.reportNumbers.set(reportNumber, report);
  }

  if (initialTru && finalTru) accumulator.routing.remained_tru += 1;
  else if (!initialTru && finalTru) accumulator.routing.routed_into_tru += 1;
  else if (initialTru && !finalTru) accumulator.routing.routed_away_from_tru += 1;

  const duration = getValidDuration(row.calltime_cleared);
  if (finalTru) {
    if (!reportNumber) accumulator.truCallsWithoutReport += 1;
    if (duration !== null) accumulator.truDurations.push(duration);
    const type = normalizeTruCallType(finalType);
    accumulator.typeCounts.set(type, (accumulator.typeCounts.get(type) || 0) + 1);
    if (!reportNumber) accumulator.noReportTypeCounts.set(type, (accumulator.noReportTypeCounts.get(type) || 0) + 1);
    accumulator.hourCounts[date.hour] += 1;
    accumulator.weekdayCounts[getWeekday(date)] += 1;
  } else if (reportNumber && duration !== null) {
    accumulator.patrolReportDurations.push(duration);
  }
}

function finalizeAccumulator(accumulator) {
  let truReports = 0;
  for (const value of accumulator.reportNumbers.values()) if (value.hasTru) truReports += 1;
  const totalReports = accumulator.reportNumbers.size;
  const patrolReports = totalReports - truReports;
  const truTiming = finalizeTiming(accumulator.truDurations, accumulator.truCalls);
  const weekdayOccurrences = countWeekdayOccurrences(accumulator.start, accumulator.end);

  return {
    total_cfs: accumulator.totalCalls,
    tru_calls: accumulator.truCalls,
    patrol_estimate_calls: accumulator.patrolCalls,
    tru_calls_per_day: divide(accumulator.truCalls, accumulator.dayCount),
    patrol_estimate_calls_per_day: divide(accumulator.patrolCalls, accumulator.dayCount),
    event_reports_total: totalReports,
    tru_event_reports: truReports,
    patrol_estimate_event_reports: patrolReports,
    tru_share_of_total_calls: percent(accumulator.truCalls, accumulator.totalCalls),
    tru_share_of_event_reports: percent(truReports, totalReports),
    tru_event_report_conversion: percent(truReports, accumulator.truCalls),
    patrol_estimate_event_report_conversion: percent(patrolReports, accumulator.patrolCalls),
    tru_calls_without_event_report: accumulator.truCallsWithoutReport,
    tru_calls_without_event_report_share: percent(accumulator.truCallsWithoutReport, accumulator.truCalls),
    tru_timing: truTiming,
    patrol_estimate_report_call_timing: finalizeTiming(accumulator.patrolReportDurations, accumulator.patrolReportDurations.length),
    routing_outcomes: { ...accumulator.routing },
    top_tru_call_types: topEntries(accumulator.typeCounts, accumulator.truCalls),
    top_tru_call_types_without_event_report: topEntries(
      accumulator.noReportTypeCounts,
      accumulator.truCallsWithoutReport,
    ),
    demand_profile: {
      by_hour: accumulator.hourCounts.map((calls, hour) => ({
        hour: String(hour).padStart(2, "0"),
        calls,
        average_calls_per_day: divide(calls, accumulator.dayCount),
      })),
      by_weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => ({
        day,
        calls: accumulator.weekdayCounts[index],
        average_calls: divide(accumulator.weekdayCounts[index], weekdayOccurrences[index]),
      })),
    },
  };
}

function finalizeTiming(values, eligibleCount) {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    valid_count: sorted.length,
    coverage_share: percent(sorted.length, eligibleCount),
    average_seconds: sorted.length ? total / sorted.length : null,
    median_seconds: percentile(sorted, 0.5),
    p90_seconds: percentile(sorted, 0.9),
    over_1_hour_share: thresholdShare(sorted, TRU_THRESHOLDS[0]),
    over_2_hours_share: thresholdShare(sorted, TRU_THRESHOLDS[1]),
    over_3_hours_share: thresholdShare(sorted, TRU_THRESHOLDS[2]),
    over_4_hours_share: thresholdShare(sorted, TRU_THRESHOLDS[3]),
  };
}

function percentile(sorted, value) {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * value;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function thresholdShare(values, threshold) {
  return percent(values.filter((value) => value >= threshold).length, values.length);
}

function topEntries(values, denominator) {
  return Array.from(values.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([type, calls]) => ({ type, calls, share: percent(calls, denominator) }));
}

function normalizeTruCallType(callType) {
  const value = String(callType || "").toUpperCase();
  const code = getCallTypeCode(callType);
  if (code.startsWith("STLVEH") || value.includes("STOLEN VEHICLE")) return "Vehicle Theft";
  if (code.startsWith("THEFT") && !code.startsWith("THEFTFA")) return "Theft";
  if (code.startsWith("FRAUD")) return "Fraud";
  if (code.startsWith("LOST") || value.includes("LOST OR FOUND")) return "Administrative / Lost or Found Property";
  if (value.includes("VANDAL") || value.includes("DAMAGE") || value.includes("MISCHIEF")) return "Vandalism";
  if (code.startsWith("FOLLOW") || code.startsWith("THEFTFA") || value.includes("SUPPLEMENTAL")) return "Follow Up / Supplemental";
  if (code.startsWith("HARASS") || code.startsWith("THREAT")) return "Harassment / Threats / Stalking";
  if (code.startsWith("ASSAULT")) return "Assault";
  if (code.startsWith("TRESPASS")) return "Trespassing / Unwanted";
  return String(callType || "Unknown").trim() || "Unknown";
}

function csvRow(scopeType, scopeValue, quarter) {
  return {
    scope_type: scopeType,
    scope_value: scopeValue,
    quarter: quarter.quarter,
    start: quarter.start,
    end_exclusive: quarter.end,
    days: quarter.days,
    total_cfs: quarter.total_cfs,
    tru_calls: quarter.tru_calls,
    patrol_estimate_calls: quarter.patrol_estimate_calls,
    tru_calls_per_day: quarter.tru_calls_per_day,
    patrol_estimate_calls_per_day: quarter.patrol_estimate_calls_per_day,
    event_reports_total: quarter.event_reports_total,
    tru_event_reports: quarter.tru_event_reports,
    patrol_estimate_event_reports: quarter.patrol_estimate_event_reports,
    tru_share_of_total_calls: quarter.tru_share_of_total_calls,
    tru_share_of_event_reports: quarter.tru_share_of_event_reports,
    tru_event_report_conversion: quarter.tru_event_report_conversion,
    patrol_estimate_event_report_conversion: quarter.patrol_estimate_event_report_conversion,
    tru_calls_without_event_report: quarter.tru_calls_without_event_report,
    tru_calls_without_event_report_share: quarter.tru_calls_without_event_report_share,
    tru_timing_valid_count: quarter.tru_timing.valid_count,
    tru_timing_coverage_share: quarter.tru_timing.coverage_share,
    tru_average_seconds: quarter.tru_timing.average_seconds,
    tru_median_seconds: quarter.tru_timing.median_seconds,
    tru_p90_seconds: quarter.tru_timing.p90_seconds,
    tru_over_1_hour_share: quarter.tru_timing.over_1_hour_share,
    tru_over_2_hours_share: quarter.tru_timing.over_2_hours_share,
    tru_over_3_hours_share: quarter.tru_timing.over_3_hours_share,
    tru_over_4_hours_share: quarter.tru_timing.over_4_hours_share,
    remained_tru: quarter.routing_outcomes.remained_tru,
    routed_into_tru: quarter.routing_outcomes.routed_into_tru,
    routed_away_from_tru: quarter.routing_outcomes.routed_away_from_tru,
  };
}

function pickComparisonMetrics(summary) {
  return {
    total_cfs: summary.total_cfs,
    tru_calls: summary.tru_calls,
    tru_calls_per_day: summary.tru_calls_per_day,
    tru_event_reports: summary.tru_event_reports,
    tru_share_of_event_reports: summary.tru_share_of_event_reports,
    tru_event_report_conversion: summary.tru_event_report_conversion,
    median_cad_seconds: summary.tru_timing.median_seconds,
    p90_cad_seconds: summary.tru_timing.p90_seconds,
  };
}

function getValidDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 && duration < 86400 ? duration : null;
}

function getDateParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]) };
}

function getWeekday(parts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function countWeekdayOccurrences(start, end) {
  const counts = Array(7).fill(0);
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  for (let cursor = startDate; cursor < endDate; cursor = new Date(cursor.getTime() + DAY_MS)) {
    counts[cursor.getUTCDay()] += 1;
  }
  return counts;
}

function normalizeDistrict(value) {
  return String(value || "").trim() || "Unknown";
}

function compareDistricts(a, b) {
  if (a === "Unknown") return 1;
  if (b === "Unknown") return -1;
  return a.localeCompare(b, undefined, { numeric: true });
}

function daysBetween(start, end) {
  return Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / DAY_MS);
}

function percent(numerator, denominator) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function divide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function formatDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
