import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Activity, ShieldAlert, Users, Cross, Building2 } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import MetricCard from "@/components/dashboard/MetricCard";
import ChartCard from "@/components/dashboard/ChartCard";
import { useData } from "@/context/DataContext";
import { getDateRangeBounds } from "@/lib/dateRanges";
import { fetchUseOfForceData, UseOfForceRecord } from "@/services/useOfForceService";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--card-foreground))",
  borderRadius: "6px",
  fontSize: "12px",
};

export default function UseOfForcePage() {
  const { incidents, filters } = useData();
  const [records, setRecords] = useState<UseOfForceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bureau, setBureau] = useState("");
  const [eventType, setEventType] = useState("");
  const [forceType, setForceType] = useState("");
  const [reason, setReason] = useState("");
  const [injuryFilter, setInjuryFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUseOfForce() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchUseOfForceData(
          filters.dateRange,
          filters.customStartDate,
          filters.customEndDate,
        );
        if (!cancelled) setRecords(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load Use of Force data");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadUseOfForce();
    return () => {
      cancelled = true;
    };
  }, [filters.customEndDate, filters.customStartDate, filters.dateRange]);

  const districtScopedRecords = useMemo(
    () => records.filter((record) => filters.district.length === 0 || filters.district.includes(record.district)),
    [filters.district, records],
  );

  const filterOptions = useMemo(() => ({
    bureaus: uniqueSorted(districtScopedRecords.map((record) => record.bureau)),
    eventTypes: uniqueSorted(districtScopedRecords.map((record) => record.eventClassDescription)),
    forceTypes: uniqueSorted(districtScopedRecords.flatMap((record) => record.forceTypes)),
    reasons: uniqueSorted(districtScopedRecords.flatMap((record) => record.reasons)),
  }), [districtScopedRecords]);

  const visibleRecords = useMemo(() => {
    return districtScopedRecords.filter((record) => {
      if (bureau && record.bureau !== bureau) return false;
      if (eventType && record.eventClassDescription !== eventType) return false;
      if (forceType && !record.forceTypes.includes(forceType)) return false;
      if (reason && !record.reasons.includes(reason)) return false;
      if (injuryFilter === "subject" && !record.subjectInjured) return false;
      if (injuryFilter === "officer" && !record.officerInjured) return false;
      if (injuryFilter === "none" && (record.subjectInjured || record.officerInjured)) return false;
      return true;
    });
  }, [bureau, districtScopedRecords, eventType, forceType, injuryFilter, reason]);

  const cfsDenominator = useMemo(() => {
    const bounds = getDateRangeBounds(
      filters.dateRange,
      new Date(),
      filters.customStartDate,
      filters.customEndDate,
    );
    return incidents.filter((incident) => {
      if (incident.startTime && incident.startTime < bounds.start) return false;
      if (incident.startTime && bounds.end && incident.startTime >= bounds.end) return false;
      if (filters.district.length > 0 && (!incident.district || !filters.district.includes(incident.district))) return false;
      return true;
    }).length;
  }, [filters.customEndDate, filters.customStartDate, filters.dateRange, filters.district, incidents]);

  const stats = useMemo(() => {
    const uniqueEvents = new Set(visibleRecords.map((record) => record.crOrEvent || record.reportGuid)).size;
    const uniqueOfficers = new Set(visibleRecords.map((record) => record.officerGuid).filter(Boolean)).size;
    const subjectInjuries = visibleRecords.filter((record) => record.subjectInjured).length;
    const officerInjuries = visibleRecords.filter((record) => record.officerInjured).length;
    const ratePerThousand = cfsDenominator > 0 ? (uniqueEvents / cfsDenominator) * 1000 : 0;
    return {
      totalRecords: visibleRecords.length,
      uniqueEvents,
      uniqueOfficers,
      subjectInjuries,
      officerInjuries,
      ratePerThousand,
    };
  }, [cfsDenominator, visibleRecords]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { month: string; records: number; events: Set<string> }>();
    for (const record of visibleRecords) {
      if (!record.eventDateTime) continue;
      const key = `${record.eventDateTime.getFullYear()}-${String(record.eventDateTime.getMonth() + 1).padStart(2, "0")}`;
      const entry = map.get(key) || {
        month: record.eventDateTime.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        records: 0,
        events: new Set<string>(),
      };
      entry.records += 1;
      entry.events.add(record.crOrEvent || record.reportGuid);
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => ({ month: value.month, records: value.records, events: value.events.size }));
  }, [visibleRecords]);

  const byDistrict = useMemo(() => topCounts(visibleRecords.map((record) => record.district), "district", 10), [visibleRecords]);
  const byEventType = useMemo(() => topCounts(visibleRecords.map((record) => record.eventClassDescription), "type", 10), [visibleRecords]);
  const byReason = useMemo(() => topCounts(visibleRecords.flatMap((record) => record.reasons), "reason", 10), [visibleRecords]);
  const byForceType = useMemo(() => topCounts(visibleRecords.flatMap((record) => record.forceTypes), "forceType", 10), [visibleRecords]);
  const bySubjectRace = useMemo(() => topCounts(visibleRecords.map((record) => record.subjectRace), "race", 8), [visibleRecords]);

  const clearLocalFilters = () => {
    setBureau("");
    setEventType("");
    setForceType("");
    setReason("");
    setInjuryFilter("");
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2 text-destructive">
          <AlertTriangle className="h-8 w-8 mx-auto" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold font-display">Use of Force</h2>
          <p className="text-xs text-muted-foreground">
            Public MCPD Use of Force records. Rates compare unique force events to calls for service in the same date and district scope.
          </p>
        </div>
        {isLoading && <div className="text-xs text-muted-foreground">Loading Use of Force data...</div>}
      </div>

      <div className="rounded-md border border-border bg-card/50 p-3">
        <div className="mb-3 text-xs font-semibold font-display">Use of Force Filters</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect label="All Bureaus" value={bureau} values={filterOptions.bureaus} onChange={setBureau} />
          <FilterSelect label="All Event Types" value={eventType} values={filterOptions.eventTypes} onChange={setEventType} />
          <FilterSelect label="All Force Types" value={forceType} values={filterOptions.forceTypes} onChange={setForceType} />
          <FilterSelect label="All Reasons" value={reason} values={filterOptions.reasons} onChange={setReason} />
          <select value={injuryFilter} onChange={(event) => setInjuryFilter(event.target.value)} className="filter-select h-10 w-full">
            <option value="">All Injury Outcomes</option>
            <option value="subject">Subject injury</option>
            <option value="officer">Officer injury</option>
            <option value="none">No subject/officer injury</option>
          </select>
        </div>
        {(bureau || eventType || forceType || reason || injuryFilter) && (
          <button type="button" onClick={clearLocalFilters} className="mt-3 text-xs text-muted-foreground hover:text-foreground">
            Clear Use of Force filters
          </button>
        )}
      </div>

      <div className="rounded-md border border-border bg-card/40 p-3 text-xs text-muted-foreground">
        Rate denominator uses calls for service filtered by date and district only. Beat, priority, and CFS call type are not applied because they are not available in the Use of Force dataset.
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
        Animal-related Use of Force records are excluded from this dashboard, including deer and injured-animal event types.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title="Force Records" value={stats.totalRecords.toLocaleString()} subtitle="Rows in selected force data" icon={<ShieldAlert className="h-4 w-4" />} />
        <MetricCard title="Unique Events" value={stats.uniqueEvents.toLocaleString()} subtitle="Unique CR/event numbers" icon={<Activity className="h-4 w-4" />} />
        <MetricCard title="Per 1,000 CFS" value={stats.ratePerThousand.toFixed(2)} subtitle={`${cfsDenominator.toLocaleString()} CFS denominator`} icon={<Building2 className="h-4 w-4" />} />
        <MetricCard title="Officers Listed" value={stats.uniqueOfficers.toLocaleString()} subtitle="Unique officer records" icon={<Users className="h-4 w-4" />} />
        <MetricCard title="Injury Records" value={(stats.subjectInjuries + stats.officerInjuries).toLocaleString()} subtitle={`${stats.subjectInjuries} subject / ${stats.officerInjuries} officer`} icon={<Cross className="h-4 w-4" />} />
      </div>

      <ChartCard title="Use of Force Trend" subtitle="Monthly force records and unique events" visible={monthlyTrend.length > 0}>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="records" stroke="#06b6d4" strokeWidth={2} dot={false} name="Records" />
              <Line type="monotone" dataKey="events" stroke="#f59e0b" strokeWidth={2} dot={false} name="Unique Events" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HorizontalBar title="Use of Force by District" data={byDistrict} dataKey="district" />
        <HorizontalBar title="Top Event Types" data={byEventType} dataKey="type" />
        <HorizontalBar title="Reasons for Force" data={byReason} dataKey="reason" />
        <HorizontalBar title="Force Types Used" data={byForceType} dataKey="forceType" />
        <HorizontalBar title="Subject Race" data={bySubjectRace} dataKey="race" />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="filter-select h-10 w-full">
      <option value="">{label}</option>
      {values.map((item) => (
        <option key={item} value={item}>{item}</option>
      ))}
    </select>
  );
}

function HorizontalBar({ title, data, dataKey }: { title: string; data: Array<Record<string, string | number>>; dataKey: string }) {
  return (
    <ChartCard title={title} visible={data.length > 0}>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 24, left: 110, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis dataKey={dataKey} type="category" width={105} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="#06b6d4" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function topCounts(values: string[], key: string, limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = value || "Unknown";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ [key]: label, count }))
    .sort((a, b) => Number(b.count) - Number(a.count) || String(a[key]).localeCompare(String(b[key])))
    .slice(0, limit);
}
