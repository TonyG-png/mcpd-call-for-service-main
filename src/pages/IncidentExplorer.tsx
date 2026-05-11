import { useState, useMemo } from "react";
import { useData } from "@/context/DataContext";
import { exportToCSV } from "@/lib/export";
import { Download, ChevronUp, ChevronDown } from "lucide-react";

type SortKey = "startTime" | "callType" | "priority" | "district" | "address";

export default function IncidentExplorer() {
  const { filteredIncidents, availableFields, isLoading } = useData();
  const [sortKey, setSortKey] = useState<SortKey>("startTime");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const sorted = useMemo(() => {
    const arr = [...filteredIncidents];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      if (av instanceof Date && bv instanceof Date) return sortAsc ? av.getTime() - bv.getTime() : bv.getTime() - av.getTime();
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [filteredIncidents, sortKey, sortAsc]);

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (sortAsc ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />) : null;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-display font-bold">Incident Explorer</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{sorted.length} incidents</span>
          <button
            onClick={() => exportToCSV(filteredIncidents, "mcpd-incidents.csv")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="dashboard-card overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {availableFields.has("incidentId") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground">ID</th>}
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("startTime")}>Start Time <SortIcon col="startTime" /></th>
              {availableFields.has("endTime") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground">End Time</th>}
              {availableFields.has("callType") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("callType")}>Type <SortIcon col="callType" /></th>}
              {availableFields.has("priority") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("priority")}>Priority <SortIcon col="priority" /></th>}
              {availableFields.has("district") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("district")}>District <SortIcon col="district" /></th>}
              {availableFields.has("beat") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Beat</th>}
              {availableFields.has("address") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("address")}>Address <SortIcon col="address" /></th>}
              {availableFields.has("city") && <th className="px-3 py-2 text-xs font-medium text-muted-foreground">City</th>}
            </tr>
          </thead>
          <tbody>
            {paged.map((inc) => (
              <tr key={inc.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                {availableFields.has("incidentId") && <td className="px-3 py-2 font-mono text-xs">{inc.incidentId}</td>}
                <td className="px-3 py-2 text-xs whitespace-nowrap">{inc.startTime?.toLocaleString() || "—"}</td>
                {availableFields.has("endTime") && <td className="px-3 py-2 text-xs whitespace-nowrap">{inc.endTime?.toLocaleString() || "—"}</td>}
                {availableFields.has("callType") && <td className="px-3 py-2 text-xs">{inc.callType || "—"}</td>}
                {availableFields.has("priority") && <td className="px-3 py-2 text-xs">{inc.priority || "—"}</td>}
                {availableFields.has("district") && <td className="px-3 py-2 text-xs">{inc.district || "—"}</td>}
                {availableFields.has("beat") && <td className="px-3 py-2 text-xs">{inc.beat || "—"}</td>}
                {availableFields.has("address") && <td className="px-3 py-2 text-xs">{inc.address || "—"}</td>}
                {availableFields.has("city") && <td className="px-3 py-2 text-xs">{inc.city || "—"}</td>}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground text-sm">No incidents match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1 text-xs rounded-md bg-secondary text-secondary-foreground disabled:opacity-50">Prev</button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="px-3 py-1 text-xs rounded-md bg-secondary text-secondary-foreground disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
