import { formatSocrataDateTime, getDateRangeBounds } from "@/lib/dateRanges";
import type { DateRangeOption } from "@/types/incident";

const BASE_URL = "https://data.montgomerycountymd.gov/resource/2x7e-w8x3.json";
const PAGE_SIZE = 5000;
const MAX_RECORDS = 100000;

const SELECT_FIELDS = [
  "reportguid",
  "officerguid",
  "event_date_time",
  "cr_or_event",
  "event_class_description",
  "district_of_occurrence",
  "bureau",
  "reason_counteract",
  "reason_claim_injury",
  "reason_protective_instrument",
  "reason_firearm_discharge",
  "reason_canine",
  "reason_firearm_accidental",
  "reason_officer_assaulted",
  "reason_pointing",
  "reason_physical_efforts",
  "reason_animal_involved",
  "activity_arrest",
  "activity_defend",
  "activity_eep",
  "activity_warrant",
  "activity_transport",
  "activity_stop",
  "activity_investigative",
  "activity_swat_operation",
  "activity_sert_operation",
  "subj_race",
  "subj_gender",
  "subj_age",
  "subject_injury_none",
  "subject_treated_hospital",
  "subject_treated_refused",
  "ofc_injury_none",
  "ofc_asp",
  "ofc_canine",
  "ofc_cew_pointed",
  "ofc_cew_discharged",
  "ofc_feet",
  "ofc_hands_fists",
  "ofc_strike",
  "ofc_control_technique",
  "ofc_non_compliant_escort",
  "ofc_handgun_pointed",
  "ofc_handgun_discharged",
  "ofc_oc_aerosol_pointed",
  "ofc_oc_aerosol_discharged",
  "ofc_shotgun_rifle_pointed",
  "ofc_shotgun_rifle_discharged",
  "ofc_vehicle",
  "ofc_pepperball_pointed",
  "ofc_pepperball_discharged",
].join(",");

export interface UseOfForceRecord {
  reportGuid: string;
  officerGuid: string;
  eventDateTime?: Date;
  crOrEvent: string;
  eventClassDescription: string;
  district: string;
  bureau: string;
  subjectRace: string;
  subjectGender: string;
  subjectAge?: number;
  subjectInjured: boolean;
  subjectHospital: boolean;
  subjectRefusedTreatment: boolean;
  officerInjured: boolean;
  reasons: string[];
  activities: string[];
  forceTypes: string[];
}

export interface UseOfForceAnnualSummaryRow {
  year: number;
  district: string;
  count: number;
}

type ApiRow = Record<string, unknown>;

const REASON_FIELDS: Array<[string, string]> = [
  ["reason_counteract", "Counteract resistance"],
  ["reason_claim_injury", "Claim of injury"],
  ["reason_protective_instrument", "Protective instrument"],
  ["reason_firearm_discharge", "Firearm discharge"],
  ["reason_canine", "Canine"],
  ["reason_firearm_accidental", "Accidental firearm discharge"],
  ["reason_officer_assaulted", "Officer assaulted"],
  ["reason_pointing", "Pointing firearm"],
  ["reason_physical_efforts", "Physical efforts"],
  ["reason_animal_involved", "Animal involved"],
];

const ACTIVITY_FIELDS: Array<[string, string]> = [
  ["activity_arrest", "Arrest"],
  ["activity_defend", "Defense"],
  ["activity_eep", "Emergency evaluation petition"],
  ["activity_warrant", "Warrant"],
  ["activity_transport", "Transport"],
  ["activity_stop", "Stop"],
  ["activity_investigative", "Investigative"],
  ["activity_swat_operation", "SWAT operation"],
  ["activity_sert_operation", "SERT operation"],
];

const FORCE_FIELDS: Array<[string, string]> = [
  ["ofc_asp", "ASP"],
  ["ofc_canine", "Canine"],
  ["ofc_cew_pointed", "CEW pointed"],
  ["ofc_cew_discharged", "CEW discharged"],
  ["ofc_feet", "Feet"],
  ["ofc_hands_fists", "Hands/Fists"],
  ["ofc_strike", "Strike"],
  ["ofc_control_technique", "Control technique"],
  ["ofc_non_compliant_escort", "Non-compliant escort"],
  ["ofc_handgun_pointed", "Handgun pointed"],
  ["ofc_handgun_discharged", "Handgun discharged"],
  ["ofc_oc_aerosol_pointed", "OC spray pointed"],
  ["ofc_oc_aerosol_discharged", "OC spray discharged"],
  ["ofc_shotgun_rifle_pointed", "Shotgun/Rifle pointed"],
  ["ofc_shotgun_rifle_discharged", "Shotgun/Rifle discharged"],
  ["ofc_vehicle", "Vehicle"],
  ["ofc_pepperball_pointed", "Pepperball pointed"],
  ["ofc_pepperball_discharged", "Pepperball discharged"],
];

function isTrue(value: unknown) {
  return value === true || String(value).toLowerCase() === "true";
}

function getSelectedLabels(row: ApiRow, fields: Array<[string, string]>) {
  return fields.filter(([field]) => isTrue(row[field])).map(([, label]) => label);
}

function normalizeUseOfForceRow(row: ApiRow): UseOfForceRecord {
  const eventDateTime = row.event_date_time ? new Date(String(row.event_date_time)) : undefined;
  return {
    reportGuid: String(row.reportguid || ""),
    officerGuid: String(row.officerguid || ""),
    eventDateTime: eventDateTime && !Number.isNaN(eventDateTime.getTime()) ? eventDateTime : undefined,
    crOrEvent: String(row.cr_or_event || ""),
    eventClassDescription: String(row.event_class_description || "Unknown"),
    district: String(row.district_of_occurrence || "Unknown"),
    bureau: String(row.bureau || "Unknown"),
    subjectRace: String(row.subj_race || "Unknown"),
    subjectGender: String(row.subj_gender || "Unknown"),
    subjectAge: row.subj_age != null && row.subj_age !== "" ? Number(row.subj_age) : undefined,
    subjectInjured: !isTrue(row.subject_injury_none),
    subjectHospital: isTrue(row.subject_treated_hospital),
    subjectRefusedTreatment: isTrue(row.subject_treated_refused),
    officerInjured: !isTrue(row.ofc_injury_none),
    reasons: getSelectedLabels(row, REASON_FIELDS),
    activities: getSelectedLabels(row, ACTIVITY_FIELDS),
    forceTypes: getSelectedLabels(row, FORCE_FIELDS),
  };
}

function isAnimalRelatedUseOfForce(row: ApiRow) {
  const eventDescription = String(row.event_class_description || "").toUpperCase();
  return (
    eventDescription.includes("ANIMAL") ||
    eventDescription.includes("DEER") ||
    isTrue(row.reason_animal_involved)
  );
}

export async function fetchUseOfForceData(
  dateRange: DateRangeOption,
  customStartDate?: string,
  customEndDate?: string,
  includeAnimalRelated = false,
): Promise<UseOfForceRecord[]> {
  const bounds = getDateRangeBounds(dateRange, new Date(), customStartDate, customEndDate);
  const clauses = [`event_date_time >= '${formatSocrataDateTime(bounds.start)}'`];

  if (bounds.end) {
    clauses.push(`event_date_time < '${formatSocrataDateTime(bounds.end)}'`);
  }

  const whereClause = clauses.join(" AND ");
  const allRecords: UseOfForceRecord[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      "$select": SELECT_FIELDS,
      "$where": whereClause,
      "$order": "event_date_time DESC",
      "$limit": String(PAGE_SIZE),
      "$offset": String(offset),
    });
    const response = await fetch(`${BASE_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Use of Force fetch failed: ${response.status}`);
    }

    const rows = (await response.json()) as ApiRow[];
    allRecords.push(
      ...rows
        .filter((row) => includeAnimalRelated || !isAnimalRelatedUseOfForce(row))
        .map(normalizeUseOfForceRow),
    );

    if (allRecords.length > MAX_RECORDS) {
      throw new Error(`Use of Force sync stopped: exceeded ${MAX_RECORDS.toLocaleString()} records.`);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allRecords;
}

export async function fetchUseOfForceAnnualSummary(includeAnimalRelated = false): Promise<UseOfForceAnnualSummaryRow[]> {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 3;
  const start = `${startYear}-01-01T00:00:00`;
  const end = `${currentYear + 1}-01-01T00:00:00`;
  const whereClauses = [
    `event_date_time >= '${start}'`,
    `event_date_time < '${end}'`,
  ];

  if (!includeAnimalRelated) {
    whereClauses.push(
      "NOT (upper(event_class_description) like '%ANIMAL%' OR upper(event_class_description) like '%DEER%' OR reason_animal_involved = true)",
    );
  }

  const params = new URLSearchParams({
    "$select": "substring(event_date_time,1,4) as year,district_of_occurrence,count(*) as count",
    "$where": whereClauses.join(" AND "),
    "$group": "year,district_of_occurrence",
    "$order": "year ASC,district_of_occurrence ASC",
    "$limit": "50000",
  });

  const response = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Use of Force annual summary fetch failed: ${response.status}`);
  }

  const rows = (await response.json()) as ApiRow[];
  return rows.map((row) => ({
    year: Number(row.year),
    district: String(row.district_of_occurrence || "Unknown"),
    count: Number(row.count || 0),
  }));
}
