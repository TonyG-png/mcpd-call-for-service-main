import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuarterlyAnalysis,
  flattenQuarterlyCsv,
  getCompleteQuarterWindow,
  isDetailCallType,
  isTelephoneReportingUnitCallType,
} from "./tru-quarterly-core.mjs";

test("uses the last eight complete quarters", () => {
  const window = getCompleteQuarterWindow(new Date("2026-08-12T12:00:00Z"));
  assert.equal(window.start, "2024-07-01");
  assert.equal(window.end, "2026-07-01");
  assert.deepEqual(window.quarters.map((quarter) => quarter.id), [
    "2024 Q3", "2024 Q4", "2025 Q1", "2025 Q2", "2025 Q3", "2025 Q4", "2026 Q1", "2026 Q2",
  ]);
});

test("classifies strict TRS values and detail calls", () => {
  assert.equal(isTelephoneReportingUnitCallType("THEFTT - TRS THEFT/LARCENY"), true);
  assert.equal(isTelephoneReportingUnitCallType("THEFT - THEFT/LARCENY"), false);
  assert.equal(isDetailCallType("DT-Detail"), true);
});

test("deduplicates reports, attributes mixed reports to TRU, and isolates districts", () => {
  const rows = [
    row({ incident_id: "1", cr_number: "ABC", close_type: "THEFT - THEFT", police_district_number: "1D", calltime_cleared: "3600" }),
    row({ incident_id: "2", cr_number: " abc ", close_type: "THEFTT - TRS THEFT", police_district_number: "1D", calltime_cleared: "7200" }),
    row({ incident_id: "3", cr_number: "DEF", close_type: "FRAUD - FRAUD", police_district_number: "2D", calltime_cleared: "1800" }),
    row({ incident_id: "4", cr_number: "", close_type: "FRAUDT-TRS FRAUD", police_district_number: "2D", calltime_cleared: "90000" }),
    row({ incident_id: "5", cr_number: "GHI", close_type: "DT-Detail", police_district_number: "2D", calltime_cleared: "100" }),
  ];
  const result = buildQuarterlyAnalysis(rows, new Date("2026-08-12T12:00:00Z"));
  const quarter = result.countywide.quarters.find((entry) => entry.quarter === "2026 Q2");

  assert.equal(quarter.total_cfs, 4);
  assert.equal(quarter.event_reports_total, 2);
  assert.equal(quarter.tru_event_reports, 1);
  assert.equal(quarter.patrol_estimate_event_reports, 1);
  assert.equal(quarter.tru_calls, 2);
  assert.equal(quarter.tru_timing.valid_count, 1);
  assert.equal(quarter.tru_timing.median_seconds, 7200);
  assert.equal(result.by_district["1D"].summary.tru_event_reports, 1);
  assert.equal(result.by_district["2D"].summary.tru_event_reports, 0);
  assert.equal(result.excluded_detail_calls, 1);
});

test("tracks initial-to-final TRU routing outcomes", () => {
  const rows = [
    row({ incident_id: "1", initial_type: "THEFTT-TRS", close_type: "THEFTT-TRS" }),
    row({ incident_id: "2", initial_type: "THEFT", close_type: "THEFTT-TRS" }),
    row({ incident_id: "3", initial_type: "THEFTT-TRS", close_type: "THEFT" }),
  ];
  const result = buildQuarterlyAnalysis(rows, new Date("2026-08-12T12:00:00Z"));
  assert.deepEqual(result.countywide.summary.routing_outcomes, {
    remained_tru: 1,
    routed_into_tru: 1,
    routed_away_from_tru: 1,
  });
});

test("counts blank-CR TRU calls directly instead of inferring them from unique reports", () => {
  const rows = [
    row({ incident_id: "1", cr_number: "ABC", close_type: "THEFTT-TRS" }),
    row({ incident_id: "2", cr_number: "ABC", close_type: "THEFTT-TRS" }),
    row({ incident_id: "3", cr_number: "", close_type: "THEFTT-TRS" }),
  ];
  const result = buildQuarterlyAnalysis(rows, new Date("2026-08-12T12:00:00Z"));
  assert.equal(result.countywide.summary.tru_event_reports, 1);
  assert.equal(result.countywide.summary.tru_calls_without_event_report, 1);
  assert.ok(Math.abs(result.countywide.summary.tru_calls_without_event_report_share - (100 / 3)) < 0.000001);
});

test("CSV rows reconcile to the JSON quarter metrics", () => {
  const result = buildQuarterlyAnalysis([
    row({ incident_id: "1", cr_number: "ABC", close_type: "THEFTT-TRS" }),
  ], new Date("2026-08-12T12:00:00Z"));
  const csv = flattenQuarterlyCsv(result);
  const jsonQuarter = result.countywide.quarters.find((entry) => entry.quarter === "2026 Q2");
  const csvQuarter = csv.find((entry) => entry.scope_type === "Countywide" && entry.quarter === "2026 Q2");
  assert.equal(csvQuarter.tru_calls, jsonQuarter.tru_calls);
  assert.equal(csvQuarter.tru_event_reports, jsonQuarter.tru_event_reports);
  assert.equal(csvQuarter.tru_median_seconds, jsonQuarter.tru_timing.median_seconds);
});

function row(overrides) {
  return {
    incident_id: "x",
    start_time: "2026-04-15T13:00:00.000",
    cr_number: "",
    initial_type: "THEFT",
    close_type: "THEFT",
    police_district_number: "1D",
    calltime_cleared: "600",
    ...overrides,
  };
}
