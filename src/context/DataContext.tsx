import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { defaultConfig } from "@/config/dataset";
import { getDateRangeBounds } from "@/lib/dateRanges";
import { getDisplayCallType, isDetailCallType } from "@/lib/callTypes";
import { FieldMapping, FilterState, NormalizedIncident, SocrataColumn } from "@/types/incident";
import {
  fetchSchema,
  fetchSchemaFallback,
  discoverFieldMappings,
  fetchData,
  normalizeIncident,
} from "@/services/socrata";

interface DataContextType {
  incidents: NormalizedIncident[];
  filteredIncidents: NormalizedIncident[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  fieldMapping: FieldMapping;
  columns: SocrataColumn[];
  isLoading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
  refresh: () => void;
  availableFields: Set<string>;
  loadProgress: number;
}

const defaultFilters: FilterState = {
  dateRange: 28,
  customStartDate: "",
  customEndDate: "",
  district: [],
  beat: "",
  priority: "",
  callType: "",
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [incidents, setIncidents] = useState<NormalizedIncident[]>([]);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [columns, setColumns] = useState<SocrataColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLoadProgress(0);
    try {
      // Step 1: Schema discovery (with fallback)
      let cols: SocrataColumn[];
      try {
        cols = await fetchSchema(defaultConfig);
      } catch {
        console.warn("Metadata API failed, using fallback schema discovery");
        cols = await fetchSchemaFallback(defaultConfig);
      }
      setColumns(cols);
      console.log("Discovered columns:", cols.map((c) => `${c.fieldName} (${c.dataTypeName})`));

      // Step 2: Derive field mappings
      const mapping = discoverFieldMappings(cols, defaultConfig.fieldOverrides);
      setFieldMapping(mapping);
      console.log("Field mapping:", mapping);

      // Step 3: Fetch data for the selected range via OData pagination.
      const raw = await fetchData(
        defaultConfig,
        mapping,
        filters.dateRange,
        (count) => {
          setLoadProgress(count);
        },
        filters.customStartDate,
        filters.customEndDate,
      );
      const normalized = raw
        .map((r, i) => {
          const incident = normalizeIncident(r, mapping, i);
          return {
            ...incident,
            rawCallType: incident.callType,
            callType: getDisplayCallType(incident.callType, incident.priority),
          };
        })
        .filter((incident) => !isDetailCallType(incident.callType));
      setIncidents(normalized);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      console.error("Data load error:", e);
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [filters.customEndDate, filters.customStartDate, filters.dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableFields = useMemo(() => {
    const fields = new Set<string>();
    for (const [key, value] of Object.entries(fieldMapping)) {
      if (value) fields.add(key);
    }
    // Verify sparse fields, such as crime/crash report numbers, across the
    // loaded dataset. The newest calls often have blank report fields, so a
    // tiny head sample can incorrectly hide valid report columns.
    if (incidents.length > 0) {
      for (const key of Array.from(fields)) {
        const k = key as keyof NormalizedIncident;
        const hasValue = incidents.some(
          (inc) => inc[k] !== undefined && inc[k] !== null && inc[k] !== ""
        );
        if (!hasValue) fields.delete(key);
      }
    }
    return fields;
  }, [fieldMapping, incidents]);

  const filteredIncidents = useMemo(() => {
    const range = getDateRangeBounds(filters.dateRange, new Date(), filters.customStartDate, filters.customEndDate);
    return incidents.filter((inc) => {
      if (inc.startTime && inc.startTime < range.start) return false;
      if (inc.startTime && range.end && inc.startTime >= range.end) return false;
      if (filters.district.length > 0 && (!inc.district || !filters.district.includes(inc.district))) return false;
      if (filters.beat && inc.beat !== filters.beat) return false;
      if (filters.priority && inc.priority !== filters.priority) return false;
      if (filters.callType && inc.callType !== filters.callType) return false;
      return true;
    });
  }, [incidents, filters]);

  return (
    <DataContext.Provider
      value={{
        incidents,
        filteredIncidents,
        filters,
        setFilters,
        fieldMapping,
        columns,
        isLoading,
        error,
        lastRefreshed,
        refresh: loadData,
        availableFields,
        loadProgress,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
