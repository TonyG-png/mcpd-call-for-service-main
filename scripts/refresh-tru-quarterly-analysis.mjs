import fs from "node:fs/promises";
import {
  buildQuarterlyAnalysis,
  flattenQuarterlyCsv,
  getCompleteQuarterWindow,
} from "./tru-quarterly-core.mjs";

const DOMAIN = "data.montgomerycountymd.gov";
const DATASET_ID = "98cc-bc7d";
const PAGE_SIZE = 50_000;
const JSON_OUT = "public/data/tru-quarterly-analysis.json";
const CSV_OUT = "public/data/tru-quarterly-analysis.csv";

async function fetchRows(now = new Date()) {
  const window = getCompleteQuarterWindow(now, 8);
  const baseUrl = `https://${DOMAIN}/resource/${DATASET_ID}.json`;
  const fields = [
    "incident_id",
    "start_time",
    "cr_number",
    "priority",
    "initial_type",
    "close_type",
    "police_district_number",
    "calltime_cleared",
  ].join(",");
  const where = `start_time >= '${window.start}T00:00:00' AND start_time < '${window.end}T00:00:00'`;
  const rows = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      "$select": fields,
      "$where": where,
      "$order": "start_time ASC, incident_id ASC",
      "$limit": String(PAGE_SIZE),
      "$offset": String(offset),
    });
    const response = await fetch(`${baseUrl}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Socrata fetch failed: ${response.status} ${response.statusText}`);
    }

    const page = await response.json();
    rows.push(...page);
    console.log(`Loaded ${rows.length.toLocaleString()} rows through offset ${offset.toLocaleString()}`);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n") + "\n";
}

async function main() {
  const now = new Date();
  const rows = await fetchRows(now);
  const analysis = buildQuarterlyAnalysis(rows, now);
  const csvRows = flattenQuarterlyCsv(analysis);

  await fs.mkdir("public/data", { recursive: true });
  await Promise.all([
    fs.writeFile(JSON_OUT, `${JSON.stringify(analysis, null, 2)}\n`, "utf8"),
    fs.writeFile(CSV_OUT, toCsv(csvRows), "utf8"),
  ]);

  console.log(`Wrote ${analysis.quarters.join(", ")} to ${JSON_OUT} and ${CSV_OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
