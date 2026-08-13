type TimingSummary = {
  valid_count: number;
  coverage_share: number;
  average_seconds: number | null;
  median_seconds: number | null;
  p90_seconds: number | null;
  over_1_hour_share: number;
  over_2_hours_share: number;
  over_3_hours_share: number;
  over_4_hours_share: number;
};

type TopType = { type: string; calls: number; share: number };

export interface CurrentTruPdfInput {
  periodLabel: string;
  totalCalls: number;
  callsWithReports: number;
  truCalls: number;
  truReports: number;
  patrolReports: number;
  totalReports: number;
  reportShare: number;
  conversionRate: number;
  averageSeconds: number | null;
  medianSeconds: number | null;
  durationBuckets: { label: string; share: number }[];
  thresholds: { seconds: number; share: number }[];
  topTypes: { type: string; count: number; share: number }[];
  hours: { hour: string; averageCalls: number }[];
  days: { day: string; calls: number }[];
}

export interface QuarterlyTruPdfInput {
  scopeName: string;
  periodLabel: string;
  generatedAt: string;
  summary: {
    total_cfs: number;
    tru_calls: number;
    tru_event_reports: number;
    patrol_estimate_event_reports: number;
    tru_share_of_total_calls: number;
    tru_share_of_event_reports: number;
    tru_event_report_conversion: number;
    tru_calls_without_event_report: number;
    tru_timing: TimingSummary;
    top_tru_call_types: TopType[];
    top_tru_call_types_without_event_report: TopType[];
    routing_outcomes: { remained_tru: number; routed_into_tru: number; routed_away_from_tru: number };
    demand_profile: {
      by_hour: { hour: string; average_calls_per_day: number }[];
      by_weekday: { day: string; average_calls: number }[];
    };
  };
  quarters: Array<{
    quarter?: string;
    total_cfs: number;
    tru_calls: number;
    tru_event_reports: number;
    patrol_estimate_event_reports: number;
    tru_share_of_event_reports: number;
    tru_event_report_conversion: number;
    tru_timing: TimingSummary;
  }>;
  districtComparison: Array<{
    district: string;
    tru_calls: number;
    tru_event_reports: number;
    tru_share_of_event_reports: number;
    tru_event_report_conversion: number;
    median_cad_seconds: number | null;
  }>;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 42;
const NAVY = [15, 25, 42];
const CYAN = [8, 181, 222];
const GOLD = [197, 157, 75];
const INK = [20, 29, 44];
const MUTED = [91, 104, 122];
const PALE = [240, 244, 248];

export async function createCurrentTruPdf(input: CurrentTruPdfInput) {
  const report = new ReportDocument("TRU Current Period Operational Report", input.periodLabel);
  report.addMetricGrid([
    ["Total Calls for Service", formatNumber(input.totalCalls), "Selected filter window"],
    ["TRU Event Report Share", formatPercent(input.reportShare), `${formatNumber(input.truReports)} TRU event reports`],
    ["TRU Report Conversion", formatPercent(input.conversionRate), `${formatNumber(input.truReports)} of ${formatNumber(input.truCalls)} TRS calls`],
    ["Median CAD Time Open", formatDuration(input.medianSeconds), `Average ${formatDuration(input.averageSeconds)}`],
  ]);
  report.addSection("Operational Summary");
  report.addParagraph([
    `${formatNumber(input.truCalls)} TRS-designated calls were identified in the selected period.`,
    `${formatNumber(input.callsWithReports)} calls had an event or crash report.`,
    `TRU accounts for ${formatPercent(input.reportShare)} of ${formatNumber(input.totalReports)} unique event reports, with ${formatNumber(input.patrolReports)} attributed to the patrol estimate.`,
  ]);
  report.addSection("CAD Time to Cleared");
  report.addMetricGrid(input.thresholds.map((item) => [
    `Open ${item.seconds / 3600}+ Hour${item.seconds > 3600 ? "s" : ""}`,
    formatPercent(item.share),
    "of valid TRS timing records",
  ]));
  report.addSection("Top Final TRS Call Types");
  report.addRankedList(input.topTypes.map((item) => ({ label: item.type, value: `${formatNumber(item.count)} calls | ${formatPercent(item.share)}` })));
  report.nextPage("TRU Current Period Operational Report", input.periodLabel);
  report.addSection("Demand Pattern");
  report.addMiniBars("Average TRS Calls by Hour", input.hours.map((item) => ({ label: item.hour, value: item.averageCalls })));
  report.addMiniBars("TRS Calls by Day of Week", input.days.map((item) => ({ label: item.day, value: item.calls })));
  report.addSection("CAD Duration Distribution");
  report.addMiniBars("Share of valid TRS timing records", input.durationBuckets.map((item) => ({ label: item.label, value: item.share, suffix: "%" })));
  report.addMethodology([
    "TRU designation is based on final close type containing TRS or Telephone Reporting Unit.",
    "Event reports are represented by unique nonblank CR numbers. CR Number remains the source reconciliation identifier.",
    "CAD time to cleared is elapsed time from call pickup to last unit cleared; it is not report-writing completion time.",
  ]);
  await report.download("mcpd-tru-current-period-report.pdf");
}

export async function createQuarterlyTruPdf(input: QuarterlyTruPdfInput) {
  const report = new ReportDocument("TRU Eight-Quarter Workload Report", `${input.scopeName} | Assessment Period: ${input.periodLabel}`);
  const summary = input.summary;
  report.addMetricGrid([
    ["TRU Calls", formatNumber(summary.tru_calls), `${formatPercent(summary.tru_share_of_total_calls)} of all CFS`],
    ["TRU Event Reports", formatNumber(summary.tru_event_reports), "Unique CR numbers attributed to TRU"],
    ["TRU Report Share", formatPercent(summary.tru_share_of_event_reports), `${formatNumber(summary.patrol_estimate_event_reports)} patrol-estimated reports`],
    ["Report Conversion", formatPercent(summary.tru_event_report_conversion), `${formatNumber(summary.tru_calls_without_event_report)} calls without CR number`],
  ]);
  report.addSection("Executive Assessment");
  report.addParagraph([
    `TRU-designated activity represented ${formatPercent(summary.tru_share_of_total_calls)} of ${formatNumber(summary.total_cfs)} calls for service in this period.`,
    `TRU is associated with ${formatNumber(summary.tru_event_reports)} unique event reports, or ${formatPercent(summary.tru_share_of_event_reports)} of all event reports.`,
    `Median CAD time open was ${formatDuration(summary.tru_timing.median_seconds)}; the 90th percentile was ${formatDuration(summary.tru_timing.p90_seconds)}.`,
  ]);
  report.addSection("TRU CAD Time to Cleared");
  report.addMetricGrid([
    ["Timing Coverage", formatPercent(summary.tru_timing.coverage_share), `${formatNumber(summary.tru_timing.valid_count)} valid records`],
    ["Open 1+ Hour", formatPercent(summary.tru_timing.over_1_hour_share), "of valid timing records"],
    ["Open 2+ Hours", formatPercent(summary.tru_timing.over_2_hours_share), "of valid timing records"],
    ["Open 4+ Hours", formatPercent(summary.tru_timing.over_4_hours_share), "of valid timing records"],
  ]);
  report.addSection("Initial-to-Final TRU Routing");
  report.addMetricGrid([
    ["Remained TRU", formatNumber(summary.routing_outcomes.remained_tru), "Initial and final type designated TRU"],
    ["Routed Into TRU", formatNumber(summary.routing_outcomes.routed_into_tru), "Final type became TRU"],
    ["Routed Away From TRU", formatNumber(summary.routing_outcomes.routed_away_from_tru), "Initial TRU designation changed"],
  ]);

  report.nextPage("TRU Eight-Quarter Workload Report", "Quarterly workload detail");
  report.addSection("Quarterly Event Report Workload");
  report.addTable(
    ["Quarter", "TRU Calls", "TRU Reports", "Patrol Est.", "TRU Share", "Conversion", "Median"],
    input.quarters.map((quarter) => [
      quarter.quarter || "-",
      formatNumber(quarter.tru_calls),
      formatNumber(quarter.tru_event_reports),
      formatNumber(quarter.patrol_estimate_event_reports),
      formatPercent(quarter.tru_share_of_event_reports),
      formatPercent(quarter.tru_event_report_conversion),
      formatDuration(quarter.tru_timing.median_seconds),
    ]),
    [72, 66, 72, 72, 64, 65, 72],
  );
  report.addSection("Stable Demand Profile");
  report.addMiniBars("Average TRU Calls by Hour", summary.demand_profile.by_hour.map((item) => ({ label: item.hour, value: item.average_calls_per_day })));
  report.addMiniBars("Average TRU Calls by Weekday", summary.demand_profile.by_weekday.map((item) => ({ label: item.day, value: item.average_calls })));

  report.nextPage("TRU Eight-Quarter Workload Report", "District and call-type detail");
  report.addSection("District Comparison");
  report.addTable(
    ["District", "TRU Calls", "TRU Reports", "Report Share", "Conversion", "Median Open"],
    input.districtComparison.filter((item) => item.tru_calls > 0).map((item) => [
      item.district,
      formatNumber(item.tru_calls),
      formatNumber(item.tru_event_reports),
      formatPercent(item.tru_share_of_event_reports),
      formatPercent(item.tru_event_report_conversion),
      formatDuration(item.median_cad_seconds),
    ]),
    [76, 80, 86, 90, 85, 115],
  );
  report.addSection("Top TRU Call Types");
  report.addRankedList(summary.top_tru_call_types.slice(0, 6).map((item) => ({ label: item.type, value: `${formatNumber(item.calls)} calls | ${formatPercent(item.share)}` })));
  report.addSection("Top TRU Types Without an Event Report");
  report.addRankedList(summary.top_tru_call_types_without_event_report.slice(0, 6).map((item) => ({ label: item.type, value: `${formatNumber(item.calls)} calls | ${formatPercent(item.share)}` })));
  report.addMethodology([
    "Patrol estimate means non-TRU-coded activity. The public CFS data does not identify a handling unit, so this estimates workload distribution and does not prove officer-hours saved.",
    "Unique CR numbers appearing on both TRU and non-TRU-coded calls are attributed to TRU for this comparison. Crash reports are excluded from the event-report workload measure.",
    `Cached analysis generated ${formatDate(input.generatedAt)} from the public MCPD Police Dispatched Incidents dataset.`,
  ]);
  await report.download(`mcpd-tru-eight-quarter-${slugify(input.scopeName)}.pdf`);
}

class ReportDocument {
  private pages: string[][] = [];
  private content: string[] = [];
  private y = 0;

  constructor(title: string, subtitle: string) {
    this.beginPage(title, subtitle);
  }

  nextPage(title: string, subtitle: string) {
    this.pages.push(this.content);
    this.beginPage(title, subtitle);
  }

  addSection(title: string) {
    this.ensureSpace(32);
    this.text(title, MARGIN, this.y, 12, "F2", INK);
    this.rect(MARGIN, this.y - 6, 32, 3, CYAN);
    this.y -= 22;
  }

  addParagraph(lines: string[]) {
    for (const line of lines) {
      for (const wrapped of wrap(line, 76)) {
        this.ensureSpace(15);
        this.text(wrapped, MARGIN, this.y, 9, "F1", MUTED);
        this.y -= 13;
      }
      this.y -= 4;
    }
  }

  addMetricGrid(metrics: string[][]) {
    const columns = metrics.length === 3 ? 3 : 4;
    const gap = 8;
    const width = (PAGE_WIDTH - MARGIN * 2 - gap * (columns - 1)) / columns;
    const height = 68;
    this.ensureSpace(height + 12);
    metrics.forEach((metric, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = MARGIN + col * (width + gap);
      const y = this.y - row * (height + gap);
      this.rect(x, y - height, width, height, PALE);
      this.text(metric[0], x + 9, y - 14, 7.5, "F2", MUTED);
      this.text(metric[1], x + 9, y - 35, metric[1].length > 12 ? 15 : 19, "F2", INK);
      for (const line of wrap(metric[2], Math.max(18, Math.floor(width / 5)))) {
        this.text(line, x + 9, y - 51 - wrap(metric[2], Math.max(18, Math.floor(width / 5))).indexOf(line) * 8, 6.8, "F1", MUTED);
      }
    });
    this.y -= Math.ceil(metrics.length / columns) * (height + gap) + 8;
  }

  addRankedList(items: { label: string; value: string }[]) {
    for (const [index, item] of items.slice(0, 10).entries()) {
      this.ensureSpace(19);
      this.rect(MARGIN, this.y - 12, 15, 15, CYAN);
      this.text(String(index + 1), MARGIN + 5, this.y - 7, 7.5, "F2", [255, 255, 255]);
      this.text(trimText(item.label, 55), MARGIN + 23, this.y - 7, 8.5, "F2", INK);
      this.text(item.value, 450, this.y - 7, 8, "F1", MUTED, "right");
      this.line(MARGIN, this.y - 17, PAGE_WIDTH - MARGIN, this.y - 17, [218, 225, 232]);
      this.y -= 20;
    }
    this.y -= 6;
  }

  addMiniBars(title: string, items: { label: string; value: number; suffix?: string }[]) {
    this.ensureSpace(48 + items.length * 10);
    this.text(title, MARGIN, this.y, 9, "F2", INK);
    this.y -= 14;
    const maximum = Math.max(...items.map((item) => item.value), 1);
    const rows = items.length > 12 ? items.filter((_, index) => index % 2 === 0) : items;
    rows.forEach((item) => {
      const labelX = MARGIN;
      const barX = MARGIN + 44;
      const width = 420 * (item.value / maximum);
      this.text(item.label, labelX, this.y - 2, 7, "F1", MUTED);
      this.rect(barX, this.y - 7, 420, 6, [230, 235, 240]);
      this.rect(barX, this.y - 7, width, 6, CYAN);
      this.text(`${item.value.toFixed(item.value < 10 ? 1 : 0)}${item.suffix || ""}`, 510, this.y - 2, 7, "F2", INK, "right");
      this.y -= 10;
    });
    this.y -= 8;
  }

  addTable(headers: string[], rows: string[][], widths: number[]) {
    const height = 18;
    this.ensureSpace(height * (Math.min(rows.length, 15) + 2));
    let x = MARGIN;
    headers.forEach((header, index) => {
      this.rect(x, this.y - height, widths[index], height, NAVY);
      this.text(trimText(header, Math.floor(widths[index] / 4.5)), x + 4, this.y - 12, 6.8, "F2", [255, 255, 255]);
      x += widths[index];
    });
    this.y -= height;
    rows.slice(0, 15).forEach((row, rowIndex) => {
      x = MARGIN;
      row.forEach((value, index) => {
        this.rect(x, this.y - height, widths[index], height, rowIndex % 2 ? [247, 249, 251] : [255, 255, 255]);
        this.text(trimText(value, Math.floor(widths[index] / 4.6)), x + 4, this.y - 12, 6.8, "F1", INK);
        x += widths[index];
      });
      this.y -= height;
    });
    this.y -= 12;
  }

  addMethodology(lines: string[]) {
    this.ensureSpace(90);
    this.rect(MARGIN, this.y - 72, PAGE_WIDTH - MARGIN * 2, 72, [248, 250, 252]);
    this.text("Methodology and Limitations", MARGIN + 10, this.y - 15, 8.5, "F2", INK);
    let y = this.y - 29;
    lines.forEach((line) => {
      wrap(line, 82).forEach((wrapped) => {
        this.text(wrapped, MARGIN + 12, y, 7, "F1", MUTED);
        y -= 9;
      });
    });
    this.y -= 84;
  }

  async download(filename: string) {
    this.pages.push(this.content);
    const logo = await getSealImage();
    const bytes = createPdf(this.pages, logo);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  private beginPage(title: string, subtitle: string) {
    this.content = [];
    // Place the provisional watermark first so every report element remains legible above it.
    this.content.push("q 0.920 0.920 0.920 rg BT /F2 68 Tf 0.707 0.707 -0.707 0.707 118 282 Tm (DRAFT) Tj ET Q");
    this.rect(0, PAGE_HEIGHT - 100, PAGE_WIDTH, 100, NAVY);
    this.text("MONTGOMERY COUNTY DEPARTMENT OF POLICE", MARGIN, PAGE_HEIGHT - 37, 9, "F2", [255, 255, 255]);
    this.text("OPERATIONAL INTELLIGENCE DIVISION", MARGIN, PAGE_HEIGHT - 53, 7.5, "F1", [181, 212, 230]);
    this.text(title, MARGIN, PAGE_HEIGHT - 76, 17, "F2", [255, 255, 255]);
    this.text(subtitle, MARGIN, PAGE_HEIGHT - 91, 8, "F1", [220, 230, 239]);
    // The seal image is flattened to JPEG for broad PDF-reader support, so clip it to its circular edge.
    this.content.push("q 542 782 m 555.255 782 566 771.255 566 758 c 566 744.745 555.255 734 542 734 c 528.745 734 518 744.745 518 758 c 518 771.255 528.745 782 542 782 c W n 48 0 0 48 518 734 cm /Seal Do Q");
    this.text("Public calls-for-service analysis", MARGIN, 25, 7, "F1", MUTED);
    this.text(`Generated ${formatDate(new Date().toISOString())}`, PAGE_WIDTH - MARGIN, 25, 7, "F1", MUTED, "right");
    this.y = PAGE_HEIGHT - 124;
  }

  private ensureSpace(required: number) {
    if (this.y - required < 48) this.nextPage("TRU Operational Intelligence Report", "Continued");
  }

  private text(value: string, x: number, y: number, size: number, font: "F1" | "F2", color: number[], align: "left" | "right" = "left") {
    const safe = escapePdf(value);
    const adjustedX = align === "right" ? x - Math.min(value.length * size * 0.49, 230) : x;
    this.content.push(`BT /${font} ${size} Tf ${pdfColor(color)} rg 1 0 0 1 ${adjustedX.toFixed(2)} ${y.toFixed(2)} Tm (${safe}) Tj ET`);
  }

  private rect(x: number, y: number, width: number, height: number, color: number[]) {
    this.content.push(`${pdfColor(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  }

  private line(x1: number, y1: number, x2: number, y2: number, color: number[]) {
    this.content.push(`${pdfColor(color)} RG 0.5 w ${x1} ${y1} m ${x2} ${y2} l S`);
  }
}

async function getSealImage() {
  try {
    const response = await fetch("/mcpd-seal.png");
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const buffer = await (await fetch(canvas.toDataURL("image/jpeg", 0.92))).arrayBuffer();
    return { bytes: new Uint8Array(buffer), width: 128, height: 128 };
  } catch {
    return null;
  }
}

function createPdf(pages: string[][], logo: { bytes: Uint8Array; width: number; height: number } | null) {
  const objects: Array<string | Uint8Array> = [];
  const add = (object: string | Uint8Array) => { objects.push(object); return objects.length; };
  const catalog = add("");
  const pagesRoot = add("");
  const regularFont = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFont = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const image = logo ? add(concatBytes(
    textBytes(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`),
    logo.bytes,
    textBytes("\nendstream"),
  )) : 0;
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  for (const commands of pages) {
    const content = (logo ? commands : commands.filter((command) => !command.includes("/Seal Do"))).join("\n");
    contentIds.push(add(`<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`));
    pageIds.push(add(""));
  }
  pageIds.forEach((pageId, index) => {
    const imageResources = image ? ` /XObject << /Seal ${image} 0 R >>` : "";
    objects[pageId - 1] = `<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFont} 0 R /F2 ${boldFont} 0 R >>${imageResources} >> /Contents ${contentIds[index]} 0 R >>`;
  });
  objects[pagesRoot - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;

  const chunks: Uint8Array[] = [textBytes("%PDF-1.4\n%âãÏÓ\n")];
  const offsets = [0];
  let offset = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const start = textBytes(`${index + 1} 0 obj\n`);
    const body = typeof object === "string" ? textBytes(object) : object;
    const end = textBytes("\nendobj\n");
    chunks.push(start, body, end);
    offset += start.length + body.length + end.length;
  });
  const xref = `${offset}\n`;
  const table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((entry) => `${String(entry).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}%%EOF`;
  chunks.push(textBytes(table));
  return concatBytes(...chunks);
}

function concatBytes(...arrays: Uint8Array[]) {
  const size = arrays.reduce((sum, array) => sum + array.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  arrays.forEach((array) => { output.set(array, offset); offset += array.length; });
  return output;
}

function textBytes(value: string) { return new TextEncoder().encode(value); }
function byteLength(value: string) { return textBytes(value).length; }
function formatNumber(value: number) { return value.toLocaleString("en-US"); }
function formatPercent(value: number) { return `${value.toFixed(1)}%`; }
function formatDuration(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  const minutes = Math.round(value / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}
function formatDate(value: string) { return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "countywide"; }
function pdfColor(values: number[]) { return values.map((value) => (value / 255).toFixed(3)).join(" "); }
function escapePdf(value: string) { return value.replace(/[^\x20-\x7E]/g, "?").replace(/([\\()])/g, "\\$1"); }
function trimText(value: string, length: number) { return value.length > length ? `${value.slice(0, Math.max(1, length - 3))}...` : value; }
function wrap(value: string, length: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    if (`${line} ${word}`.trim().length > length && line) { lines.push(line); line = word; }
    else line = `${line} ${word}`.trim();
  });
  if (line) lines.push(line);
  return lines;
}
