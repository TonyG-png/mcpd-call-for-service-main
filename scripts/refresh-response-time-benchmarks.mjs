const DOMAIN = "data.montgomerycountymd.gov";
const DATASET_ID = "98cc-bc7d";
const PAGE_SIZE = 5000;
const OUT_FILE = "public/data/response-time-annual-benchmarks.json";

function formatSocrataDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getCallTypeCode(callType) {
  return String(callType || "")
    .trim()
    .split(/\s*-\s*|\s+/)[0]
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

function isTelephoneReportingUnitCallType(callType) {
  const value = String(callType || "").toUpperCase();
  return value.includes("TRS") || value.includes("TELEPHONE REPORTING UNIT");
}

function isDetailCallType(callType) {
  return getCallTypeCode(callType) === "DT";
}

function createAccumulator() {
  return {
    record_count: 0,
    call_to_dispatch_sum: 0,
    call_to_dispatch_count: 0,
    dispatch_to_arrival_sum: 0,
    dispatch_to_arrival_count: 0,
    call_to_arrival_sum: 0,
    call_to_arrival_count: 0,
  };
}

function addRow(acc, row) {
  const callToDispatch = row.calltime_dispatch != null ? Number(row.calltime_dispatch) : null;
  const dispatchToArrival = row.dispatch_arrive != null ? Number(row.dispatch_arrive) : null;

  acc.record_count += 1;

  if (callToDispatch != null && Number.isFinite(callToDispatch) && callToDispatch > 0) {
    acc.call_to_dispatch_sum += callToDispatch;
    acc.call_to_dispatch_count += 1;
  }

  if (dispatchToArrival != null && Number.isFinite(dispatchToArrival) && dispatchToArrival > 0) {
    acc.dispatch_to_arrival_sum += dispatchToArrival;
    acc.dispatch_to_arrival_count += 1;
  }

  if (
    callToDispatch != null &&
    dispatchToArrival != null &&
    Number.isFinite(callToDispatch) &&
    Number.isFinite(dispatchToArrival) &&
    callToDispatch > 0 &&
    dispatchToArrival > 0
  ) {
    acc.call_to_arrival_sum += callToDispatch + dispatchToArrival;
    acc.call_to_arrival_count += 1;
  }
}

function metric(sum, count) {
  return {
    average_seconds: count > 0 ? sum / count : null,
    valid_count: count,
  };
}

function finalizeAccumulator(acc) {
  return {
    record_count: acc.record_count,
    call_to_dispatch: metric(acc.call_to_dispatch_sum, acc.call_to_dispatch_count),
    dispatch_to_arrival: metric(acc.dispatch_to_arrival_sum, acc.dispatch_to_arrival_count),
    call_to_arrival: metric(acc.call_to_arrival_sum, acc.call_to_arrival_count),
  };
}

async function fetchYear(year) {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const baseUrl = `https://${DOMAIN}/resource/${DATASET_ID}.json`;
  const selectFields = "start_time,calltime_dispatch,dispatch_arrive,initial_type";
  const whereClause = [
    `start_time >= '${formatSocrataDateTime(start)}'`,
    `start_time < '${formatSocrataDateTime(end)}'`,
  ].join(" AND ");
  const acc = createAccumulator();
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      "$select": selectFields,
      "$where": whereClause,
      "$order": "start_time ASC",
      "$limit": String(PAGE_SIZE),
      "$offset": String(offset),
    });
    const response = await fetch(`${baseUrl}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Socrata fetch failed for ${year}: ${response.status} ${response.statusText}`);
    }

    const rows = await response.json();
    for (const row of rows) {
      if (isTelephoneReportingUnitCallType(row.initial_type) || isDetailCallType(row.initial_type)) continue;
      addRow(acc, row);
    }

    console.log(`${year}: loaded ${(offset + rows.length).toLocaleString()} raw rows, retained ${acc.record_count.toLocaleString()} non-TRU, non-detail rows`);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return {
    year,
    ...finalizeAccumulator(acc),
  };
}

function weightedAverage(annual, metricKey) {
  let sum = 0;
  let count = 0;

  for (const year of annual) {
    const metricValue = year[metricKey];
    if (metricValue.average_seconds == null) continue;
    sum += metricValue.average_seconds * metricValue.valid_count;
    count += metricValue.valid_count;
  }

  return metric(sum, count);
}

async function main() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 3, currentYear - 2, currentYear - 1];
  const annual = [];

  for (const year of years) {
    annual.push(await fetchYear(year));
  }

  const output = {
    generated_at: new Date().toISOString(),
    benchmark_type: "last_three_full_calendar_years",
    excludes_tru_calls: true,
    excludes_detail_calls: true,
    years,
    annual,
    three_year_average: {
      call_to_dispatch: weightedAverage(annual, "call_to_dispatch"),
      dispatch_to_arrival: weightedAverage(annual, "dispatch_to_arrival"),
      call_to_arrival: weightedAverage(annual, "call_to_arrival"),
    },
  };

  const fs = await import("node:fs/promises");
  await fs.mkdir("public/data", { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote response time benchmarks for ${years.join(", ")} to ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
