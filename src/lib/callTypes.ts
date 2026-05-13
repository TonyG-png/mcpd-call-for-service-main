export function getCallTypeCode(callType?: string | null) {
  return (callType || "")
    .trim()
    .split(/\s*-\s*|\s+/)[0]
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

export const PERSONAL_INJURY_COLLISION_CALL_TYPE = "Personal Injury Collision";
export const ALARM_CALL_TYPE = "Alarm";
export const ANIMAL_CALL_TYPE = "Animal";
export const ASSAULT_CALL_TYPE = "Assault";
export const DOMESTIC_CALL_TYPE = "Domestic";
export const HARASSMENT_CALL_TYPE = "Harassment / Threats / Stalking";
export const SEX_ASSAULT_CALL_TYPE = "Sex Assault";
export const WEAPONS_CALL_TYPE = "Weapons";
export const VANDALISM_CALL_TYPE = "Vandalism";
export const ROBBERY_CALL_TYPE = "Robbery (including carjacking)";
export const BURGLARY_CALL_TYPE = "Burglary";
export const THEFT_CALL_TYPE = "Theft";
export const VEHICLE_THEFT_CALL_TYPE = "Vehicle Theft";
export const FRAUD_CALL_TYPE = "Fraud";
export const TRESPASSING_CALL_TYPE = "Trespassing / Unwanted";
export const DISTURBANCE_CALL_TYPE = "Disturbance";
export const ABDUCTION_CALL_TYPE = "Abduction / Kidnapping";
export const ABUSE_NEGLECT_CALL_TYPE = "Abuse / Neglect";
export const ADMIN_CALL_TYPE = "Administrative / Lost or Found Property";
export const BOMB_CALL_TYPE = "Bomb / Suspicious Package";
export const CDS_CALL_TYPE = "CDS / Drug Complaint";
export const CHECK_WELFARE_CALL_TYPE = "Check Welfare";
export const DUI_CALL_TYPE = "DUI";
export const FOLLOW_UP_CALL_TYPE = "Follow Up / Supplemental";
export const INDECENCY_CALL_TYPE = "Indecency / Lewdness";
export const NOISE_CALL_TYPE = "Noise";
export const PEDESTRIAN_STRUCK_CALL_TYPE = "Pedestrian Struck";
export const SHOOTING_CALL_TYPE = "Shooting";
export const STABBING_CALL_TYPE = "Stabbing";
export const SUSPICIOUS_CALL_TYPE = "Suspicious Situation";
export const TRAFFIC_TRANSPORTATION_CALL_TYPE = "Traffic / Transportation";
export const TRAFFIC_VIOLATION_CALL_TYPE = "Traffic Violation";

const DISPLAY_CALL_TYPE_GROUPS = new Set([
  PERSONAL_INJURY_COLLISION_CALL_TYPE,
  ALARM_CALL_TYPE,
  ANIMAL_CALL_TYPE,
  ASSAULT_CALL_TYPE,
  DOMESTIC_CALL_TYPE,
  HARASSMENT_CALL_TYPE,
  SEX_ASSAULT_CALL_TYPE,
  WEAPONS_CALL_TYPE,
  VANDALISM_CALL_TYPE,
  ROBBERY_CALL_TYPE,
  BURGLARY_CALL_TYPE,
  THEFT_CALL_TYPE,
  VEHICLE_THEFT_CALL_TYPE,
  FRAUD_CALL_TYPE,
  TRESPASSING_CALL_TYPE,
  DISTURBANCE_CALL_TYPE,
  ABDUCTION_CALL_TYPE,
  ABUSE_NEGLECT_CALL_TYPE,
  ADMIN_CALL_TYPE,
  BOMB_CALL_TYPE,
  CDS_CALL_TYPE,
  CHECK_WELFARE_CALL_TYPE,
  DUI_CALL_TYPE,
  FOLLOW_UP_CALL_TYPE,
  INDECENCY_CALL_TYPE,
  NOISE_CALL_TYPE,
  PEDESTRIAN_STRUCK_CALL_TYPE,
  SHOOTING_CALL_TYPE,
  STABBING_CALL_TYPE,
  SUSPICIOUS_CALL_TYPE,
  TRAFFIC_TRANSPORTATION_CALL_TYPE,
  TRAFFIC_VIOLATION_CALL_TYPE,
]);

export function isTruCallType(callType?: string | null) {
  return getCallTypeCode(callType).endsWith("T");
}

export function isTelephoneReportingUnitCallType(callType?: string | null) {
  const value = String(callType || "").toUpperCase();
  return value.includes("TRS") || value.includes("TELEPHONE REPORTING UNIT");
}

export function isDetailCallType(callType?: string | null) {
  return getCallTypeCode(callType) === "DT";
}

export function isPriorityZero(priority?: string | number | null) {
  return String(priority ?? "").trim() === "0";
}

export function isTrafficTransportationCallType(callType?: string | null) {
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

export function isVehicleTheftCallType(callType?: string | null) {
  const value = String(callType || "").toUpperCase();
  const code = getCallTypeCode(callType);
  return (
    code.startsWith("STLVEH") ||
    code.startsWith("STOLENVEH") ||
    code.startsWith("AUTOTHEFT") ||
    value.includes("STOLEN VEHICLE") ||
    value.includes("AUTO THEFT") ||
    value.includes("VEHICLE THEFT")
  );
}

export function isAlarmCallType(callType?: string | null) {
  const value = String(callType || "").toUpperCase();
  if (value.includes("BOX ALARM")) return false;

  const code = getCallTypeCode(callType);
  return code.startsWith("ALARM") || code === "ALRM";
}

function getBundledCallType(callType?: string | null) {
  const value = String(callType || "").toUpperCase();
  const code = getCallTypeCode(callType);

  if (
    code === "ANI" ||
    code === "DEERP" ||
    code === "HUNT" ||
    code.startsWith("ANIMAL")
  ) {
    return ANIMAL_CALL_TYPE;
  }

  if (code.startsWith("ASLT") || code === "ASSAULT" || code === "ASSAULTTRS") {
    return ASSAULT_CALL_TYPE;
  }

  if (code.startsWith("DOM")) {
    return DOMESTIC_CALL_TYPE;
  }

  if (
    code.startsWith("HARASS") ||
    code.startsWith("STALK") ||
    code.startsWith("THREAT") ||
    value.includes("HARASSMENT") ||
    value.includes("STALKING") ||
    value.includes("THREATS")
  ) {
    return HARASSMENT_CALL_TYPE;
  }

  if (
    code.startsWith("RAPE") ||
    code.startsWith("SEXASLT") ||
    value.includes("SEX ASSAULT") ||
    value.includes("SEXUAL ASSAULT")
  ) {
    return SEX_ASSAULT_CALL_TYPE;
  }

  if (code.startsWith("WEAP")) {
    return WEAPONS_CALL_TYPE;
  }

  if (value.includes("VANDALISM")) {
    return VANDALISM_CALL_TYPE;
  }

  if (code.startsWith("ROB") || value.includes("CAR JACKING") || value.includes("CARJACKING")) {
    return ROBBERY_CALL_TYPE;
  }

  if (code.startsWith("BURG")) {
    return BURGLARY_CALL_TYPE;
  }

  if (isVehicleTheftCallType(callType)) {
    return VEHICLE_THEFT_CALL_TYPE;
  }

  if (code.startsWith("THEFT")) {
    return THEFT_CALL_TYPE;
  }

  if (code.startsWith("FRAUD")) {
    return FRAUD_CALL_TYPE;
  }

  if (code.startsWith("TRESP") || code === "TRE") {
    return TRESPASSING_CALL_TYPE;
  }

  if (code.startsWith("DISP") || value.includes("DISTURBANCE/NUISANCE")) {
    return DISTURBANCE_CALL_TYPE;
  }

  if (value.includes("ABDUCTION") || value.includes("KIDNAPPING")) {
    return ABDUCTION_CALL_TYPE;
  }

  if (
    code.startsWith("ABUSE") ||
    code.startsWith("NEGLECT") ||
    value.includes("ABUSE, ABANDONMENT, NEGLECT")
  ) {
    return ABUSE_NEGLECT_CALL_TYPE;
  }

  if (
    value.includes("ADMINISTRATIVE") ||
    value.includes("MISC-ADMIN") ||
    code.startsWith("LOSTT")
  ) {
    return ADMIN_CALL_TYPE;
  }

  if (value.includes("BOMB DEVICE") || value.includes("BOMB THREAT")) {
    return BOMB_CALL_TYPE;
  }

  if (code === "CDS") {
    return CDS_CALL_TYPE;
  }

  if (value.includes("CHECK WELFARE") || value.includes("CHECK THE WELFARE")) {
    return CHECK_WELFARE_CALL_TYPE;
  }

  if (value.includes("DRIVING UNDER THE INFLUENCE")) {
    return DUI_CALL_TYPE;
  }

  if (value.includes("FOLLOW UP/SUPPLEMENTAL") || code.startsWith("FOLLOWT")) {
    return FOLLOW_UP_CALL_TYPE;
  }

  if (value.includes("INDECENCY/LEWDNESS")) {
    return INDECENCY_CALL_TYPE;
  }

  if (code.startsWith("NOISE")) {
    return NOISE_CALL_TYPE;
  }

  if (value.includes("PEDESTRIAN STRUCK")) {
    return PEDESTRIAN_STRUCK_CALL_TYPE;
  }

  if (code.startsWith("SHOOT") || code.startsWith("SHOTS")) {
    return SHOOTING_CALL_TYPE;
  }

  if (code.startsWith("STAB")) {
    return STABBING_CALL_TYPE;
  }

  if (
    code === "S" ||
    value.includes("SUSPICIOUS CIRC") ||
    value.includes("SUSICIOUS CIRCUMSTANCE")
  ) {
    return SUSPICIOUS_CALL_TYPE;
  }

  if (value.includes("TRAFFIC VIOLATION")) {
    return TRAFFIC_VIOLATION_CALL_TYPE;
  }

  if (isTrafficTransportationCallType(callType)) {
    return TRAFFIC_TRANSPORTATION_CALL_TYPE;
  }

  return "";
}

export function getDisplayCallType(callType?: string | null, priority?: string | number | null) {
  if (isPriorityZero(priority) && isTrafficTransportationCallType(callType)) {
    return PERSONAL_INJURY_COLLISION_CALL_TYPE;
  }
  if (isAlarmCallType(callType)) {
    return ALARM_CALL_TYPE;
  }
  const bundledCallType = getBundledCallType(callType);
  if (bundledCallType) {
    return bundledCallType;
  }
  return callType || "";
}

export function getCallTypeGroupLabel(callType?: string | null) {
  if (DISPLAY_CALL_TYPE_GROUPS.has(String(callType || ""))) {
    return String(callType || "");
  }
  return getCallTypeCode(callType);
}
