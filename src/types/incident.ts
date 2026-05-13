/**
 * Semantic field mapping from internal concept → actual Socrata column name.
 * Updated automatically by schema discovery or manually via config overrides.
 */
export interface FieldMapping {
  incidentId?: string;
  crNumber?: string;
  crashReport?: string;
  startTime?: string;
  endTime?: string;
  callType?: string;
  priority?: string;
  district?: string;
  beat?: string;
  address?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
  serviceCategory?: string;
  [key: string]: string | undefined;
}

/** Normalized internal representation of a police call for service */
export interface NormalizedIncident {
  id: string;
  incidentId?: string;
  crNumber?: string;
  crashReport?: string;
  startTime?: Date;
  endTime?: Date;
  callType?: string;
  rawCallType?: string;
  priority?: string;
  district?: string;
  beat?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  serviceCategory?: string;
  raw: Record<string, unknown>;
}

export type DateRangeOption = 7 | 14 | 28 | "ytd" | "custom";

export interface FilterState {
  dateRange: DateRangeOption;
  customStartDate: string;
  customEndDate: string;
  district: string[];
  beat: string;
  priority: string;
  callType: string;
}

export interface SocrataColumn {
  fieldName: string;
  name: string;
  dataTypeName: string;
  description?: string;
}
