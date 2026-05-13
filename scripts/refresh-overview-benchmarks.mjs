const DOMAIN = "data.montgomerycountymd.gov";
const DATASET_ID = "98cc-bc7d";
const PAGE_SIZE = 5000;
const OUT_FILE = "public/data/overview-annual-benchmarks.json";

function formatSocrataDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getCallTypeCode(callType) {
  return String(callType || "")
    .trim()
    .split(/\s*-\s*|\s+/)[0]
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

function isPriorityZero(priority) {
  return String(priority ?? "").trim() === "0";
}

function isTrafficTransportationCallType(callType) {
  const value = String(callType || "").toUpperCase();
  const code = getCallTypeCode(callType);
  return (
    value.includes("TRAFFIC/TRANSPORTATION") ||
    value.includes("TRAFFIC TRANSPORTATION") ||
    (value.includes("TRAFFIC") && value.includes("TRANSPORTATION")) ||
    code === "TRAFFIC" ||
    code === "TRAF" ||
    code === "TRAFF" ||
    code === "TRF"
  );
}

function isAlarmCallType(callType) {
  const value = String(callType || "").toUpperCase();
  if (value.includes("BOX ALARM")) return false;

  const code = getCallTypeCode(callType);
  return code.startsWith("ALARM") || code === "ALRM";
}

function getBundledCallType(callType) {
  const value = String(callType || "").toUpperCase();
  const code = getCallTypeCode(callType);

  if (code === "ANI" || code === "DEERP" || code === "HUNT" || code.startsWith("ANIMAL")) return "Animal";
  if (code.startsWith("ASLT") || code === "ASSAULT" || code === "ASSAULTTRS") return "Assault";
  if (code.startsWith("DOM")) return "Domestic";
  if (
    code.startsWith("HARASS") ||
    code.startsWith("STALK") ||
    code.startsWith("THREAT") ||
    value.includes("HARASSMENT") ||
    value.includes("STALKING") ||
    value.includes("THREATS")
  ) return "Harassment / Threats / Stalking";
  if (
    code.startsWith("RAPE") ||
    code.startsWith("SEXASLT") ||
    value.includes("SEX ASSAULT") ||
    value.includes("SEXUAL ASSAULT")
  ) return "Sex Assault";
  if (code.startsWith("WEAP")) return "Weapons";
  if (value.includes("VANDALISM")) return "Vandalism";
  if (code.startsWith("ROB") || value.includes("CAR JACKING") || value.includes("CARJACKING")) return "Robbery (including carjacking)";
  if (code.startsWith("BURG")) return "Burglary";
  if (code.startsWith("THEFT")) return "Theft";
  if (code.startsWith("FRAUD")) return "Fraud";
  if (code.startsWith("TRESP") || code === "TRE") return "Trespassing / Unwanted";
  if (code.startsWith("DISP") || value.includes("DISTURBANCE/NUISANCE")) return "Disturbance";
  if (value.includes("ABDUCTION") || value.includes("KIDNAPPING")) return "Abduction / Kidnapping";
  if (code.startsWith("ABUSE") || code.startsWith("NEGLECT") || value.includes("ABUSE, ABANDONMENT, NEGLECT")) return "Abuse / Neglect";
  if (value.includes("ADMINISTRATIVE") || value.includes("MISC-ADMIN") || code.startsWith("LOSTT")) return "Administrative / Lost or Found Property";
  if (value.includes("BOMB DEVICE") || value.includes("BOMB THREAT")) return "Bomb / Suspicious Package";
  if (code === "CDS") return "CDS / Drug Complaint";
  if (value.includes("CHECK WELFARE") || value.includes("CHECK THE WELFARE")) return "Check Welfare";
  if (value.includes("DRIVING UNDER THE INFLUENCE")) return "DUI";
  if (value.includes("FOLLOW UP/SUPPLEMENTAL") || code.startsWith("FOLLOWT")) return "Follow Up / Supplemental";
  if (value.includes("INDECENCY/LEWDNESS")) return "Indecency / Lewdness";
  if (code.startsWith("NOISE")) return "Noise";
  if (value.includes("PEDESTRIAN STRUCK")) return "Pedestrian Struck";
  if (code.startsWith("SHOOT") || code.startsWith("SHOTS")) return "Shooting";
  if (code.startsWith("STAB")) return "Stabbing";
  if (code === "S" || value.includes("SUSPICIOUS CIRC") || value.includes("SUSICIOUS CIRCUMSTANCE")) return "Suspicious Situation";
  if (value.includes("TRAFFIC VIOLATION")) return "Traffic Violation";

  return "";
}

function getDisplayCallType(callType, priority) {
  if (isPriorityZero(priority) && isTrafficTransportationCallType(callType)) {
    return "Personal Injury Collision";
  }
  if (isAlarmCallType(callType)) {
    return "Alarm";
  }
  const bundledCallType = getBundledCallType(callType);
  if (bundledCallType) {
    return bundledCallType;
  }
  return String(callType || "");
}

function getCallTypeGroupLabel(callType) {
  const groupedLabels = new Set([
    "Personal Injury Collision",
    "Alarm",
    "Animal",
    "Assault",
    "Domestic",
    "Harassment / Threats / Stalking",
    "Sex Assault",
    "Weapons",
    "Vandalism",
    "Robbery (including carjacking)",
    "Burglary",
    "Theft",
    "Fraud",
    "Trespassing / Unwanted",
    "Disturbance",
    "Abduction / Kidnapping",
    "Abuse / Neglect",
    "Administrative / Lost or Found Property",
    "Bomb / Suspicious Package",
    "CDS / Drug Complaint",
    "Check Welfare",
    "DUI",
    "Follow Up / Supplemental",
    "Indecency / Lewdness",
    "Noise",
    "Pedestrian Struck",
    "Shooting",
    "Stabbing",
    "Suspicious Situation",
    "Traffic Violation",
  ]);
  if (groupedLabels.has(callType)) {
    return callType;
  }
  return getCallTypeCode(callType);
}

function isDetailCallType(callType) {
  return getCallTypeCode(callType) === "DT";
}

function daysInYear(year) {
  return Math.round((new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime()) / 86400000);
}

function getShiftKey(date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 360 && minutes < 870) return "daywork";
  if (minutes >= 870 && minutes < 1320) return "evening";
  return "midnight";
}

function createAnnual(year) {
  return {
    year,
    days: daysInYear(year),
    total_calls: 0,
    daywork_calls: 0,
    evening_calls: 0,
    midnight_calls: 0,
    overnight_calls: 0,
    priority_zero_calls: 0,
    priority_counts: new Map(),
    call_type_counts: new Map(),
  };
}

function createDaily(date) {
  return {
    date: getDateKey(date),
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    call_count: 0,
    daywork_count: 0,
    evening_count: 0,
    midnight_count: 0,
    overnight_count: 0,
    priority_zero_count: 0,
  };
}

function topEntries(map, limit) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function addCallToAnnual(annual, startTime, priority, callTypeCode) {
  const hour = startTime.getHours();
  const shiftKey = getShiftKey(startTime);
  const isOvernight = hour >= 22 || hour < 6;

  annual.total_calls += 1;
  annual[`${shiftKey}_calls`] += 1;

  if (isOvernight) {
    annual.overnight_calls += 1;
  }

  if (priority === "0") {
    annual.priority_zero_calls += 1;
  }

  if (priority) annual.priority_counts.set(priority, (annual.priority_counts.get(priority) || 0) + 1);
  if (callTypeCode) annual.call_type_counts.set(callTypeCode, (annual.call_type_counts.get(callTypeCode) || 0) + 1);
}

function finalizeAnnual(annual) {
  return {
    year: annual.year,
    days: annual.days,
    total_calls: annual.total_calls,
    average_calls_per_day: annual.total_calls / annual.days,
    daywork_calls: annual.daywork_calls,
    daywork_share: annual.total_calls > 0 ? annual.daywork_calls / annual.total_calls : 0,
    evening_calls: annual.evening_calls,
    evening_share: annual.total_calls > 0 ? annual.evening_calls / annual.total_calls : 0,
    midnight_calls: annual.midnight_calls,
    midnight_share: annual.total_calls > 0 ? annual.midnight_calls / annual.total_calls : 0,
    overnight_calls: annual.overnight_calls,
    overnight_share: annual.total_calls > 0 ? annual.overnight_calls / annual.total_calls : 0,
    priority_zero_calls: annual.priority_zero_calls,
    priority_zero_share: annual.total_calls > 0 ? annual.priority_zero_calls / annual.total_calls : 0,
    priority_counts: topEntries(annual.priority_counts, 10),
    top_call_types: topEntries(annual.call_type_counts, 20),
  };
}

async function fetchYear(year) {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const baseUrl = `https://${DOMAIN}/resource/${DATASET_ID}.json`;
  const selectFields = "start_time,initial_type,priority,police_district_number";
  const whereClause = [
    `start_time >= '${formatSocrataDateTime(start)}'`,
    `start_time < '${formatSocrataDateTime(end)}'`,
  ].join(" AND ");
  const annual = createAnnual(year);
  const annualByDistrict = new Map();
  const daily = new Map();
  const dailyByDistrict = new Map();
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
      const priority = row.priority != null ? String(row.priority) : "";
      const callType = getDisplayCallType(row.initial_type, priority);
      if (isDetailCallType(callType)) continue;
      if (!row.start_time) continue;
      const startTime = new Date(row.start_time);
      if (Number.isNaN(startTime.getTime())) continue;
      const dateKey = getDateKey(startTime);
      const dailyEntry = daily.get(dateKey) || createDaily(startTime);
      const hour = startTime.getHours();
      const shiftKey = getShiftKey(startTime);
      const isOvernight = hour >= 22 || hour < 6;
      const callTypeCode = getCallTypeGroupLabel(callType);
      const district = row.police_district_number != null ? String(row.police_district_number).trim() : "";

      addCallToAnnual(annual, startTime, priority, callTypeCode);
      if (district) {
        const districtAnnual = annualByDistrict.get(district) || createAnnual(year);
        addCallToAnnual(districtAnnual, startTime, priority, callTypeCode);
        annualByDistrict.set(district, districtAnnual);
      }

      dailyEntry.call_count += 1;
      dailyEntry[`${shiftKey}_count`] += 1;
      let districtDailyEntry = null;
      if (district) {
        const districtDaily = dailyByDistrict.get(district) || new Map();
        districtDailyEntry = districtDaily.get(dateKey) || createDaily(startTime);
        districtDailyEntry.call_count += 1;
        districtDailyEntry[`${shiftKey}_count`] += 1;
        districtDaily.set(dateKey, districtDailyEntry);
        dailyByDistrict.set(district, districtDaily);
      }

      if (isOvernight) {
        dailyEntry.overnight_count += 1;
        if (districtDailyEntry) districtDailyEntry.overnight_count += 1;
      }

      if (priority === "0") {
        dailyEntry.priority_zero_count += 1;
        if (districtDailyEntry) districtDailyEntry.priority_zero_count += 1;
      }

      daily.set(dateKey, dailyEntry);
    }

    console.log(`${year}: loaded ${(offset + rows.length).toLocaleString()} rows`);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return {
    annual: finalizeAnnual(annual),
    annual_by_district: Object.fromEntries(
      Array.from(annualByDistrict.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([district, value]) => [district, finalizeAnnual(value)])
    ),
    daily_by_district: Object.fromEntries(
      Array.from(dailyByDistrict.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([district, values]) => [
          district,
          Array.from(values.values()).sort((a, b) => a.date.localeCompare(b.date)),
        ])
    ),
    daily: Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function weightedAnnualAverage(annual) {
  const totalCalls = annual.reduce((sum, row) => sum + row.total_calls, 0);
  const totalDays = annual.reduce((sum, row) => sum + row.days, 0);
  const daywork = annual.reduce((sum, row) => sum + row.daywork_calls, 0);
  const evening = annual.reduce((sum, row) => sum + row.evening_calls, 0);
  const midnight = annual.reduce((sum, row) => sum + row.midnight_calls, 0);
  const overnight = annual.reduce((sum, row) => sum + row.overnight_calls, 0);
  const priorityZero = annual.reduce((sum, row) => sum + row.priority_zero_calls, 0);

  return {
    average_calls_per_day: totalDays > 0 ? totalCalls / totalDays : 0,
    daywork_share: totalCalls > 0 ? daywork / totalCalls : 0,
    evening_share: totalCalls > 0 ? evening / totalCalls : 0,
    midnight_share: totalCalls > 0 ? midnight / totalCalls : 0,
    overnight_share: totalCalls > 0 ? overnight / totalCalls : 0,
    priority_zero_share: totalCalls > 0 ? priorityZero / totalCalls : 0,
  };
}

async function main() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 3, currentYear - 2, currentYear - 1];
  const annual = [];
  const annualByDistrict = {};
  const daily = [];
  const dailyByDistrict = {};

  for (const year of years) {
    const result = await fetchYear(year);
    annual.push(result.annual);
    for (const [district, row] of Object.entries(result.annual_by_district)) {
      if (!annualByDistrict[district]) annualByDistrict[district] = [];
      annualByDistrict[district].push(row);
    }
    daily.push(...result.daily);
    for (const [district, rows] of Object.entries(result.daily_by_district)) {
      if (!dailyByDistrict[district]) dailyByDistrict[district] = [];
      dailyByDistrict[district].push(...rows);
    }
  }

  const output = {
    generated_at: new Date().toISOString(),
    benchmark_type: "last_three_full_calendar_years_with_daily_seasonal_windows",
    excludes_detail_calls: true,
    years,
    annual,
    annual_by_district: annualByDistrict,
    three_year_average: weightedAnnualAverage(annual),
    daily,
    daily_by_district: dailyByDistrict,
  };

  const fs = await import("node:fs/promises");
  await fs.mkdir("public/data", { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(output)}\n`, "utf8");
  console.log(`Wrote overview benchmarks for ${years.join(", ")} to ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
