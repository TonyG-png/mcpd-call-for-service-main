import { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { Search, RotateCcw, SlidersHorizontal } from "lucide-react";
import { getDateRangeOptions } from "@/lib/dateRanges";

export default function GlobalFilters() {
  const { incidents, filters, setFilters, availableFields } = useData();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const dateRangeOptions = useMemo(() => getDateRangeOptions(), []);

  const uniqueValues = useMemo(() => {
    const dSet = new Set<string>();
    const bSet = new Set<string>();
    const pSet = new Set<string>();
    const tSet = new Set<string>();
    incidents.forEach((inc) => {
      if (inc.district) dSet.add(inc.district);
      if (inc.beat) bSet.add(inc.beat);
      if (inc.priority) pSet.add(inc.priority);
      if (inc.callType) tSet.add(inc.callType);
    });
    return {
      districts: [...dSet].sort(),
      beats: [...bSet].sort(),
      priorities: [...pSet].sort(),
      callTypes: [...tSet].sort(),
    };
  }, [incidents]);

  const resetFilters = () =>
    setFilters({
      dateRange: 28,
      district: "",
      beat: "",
      priority: "",
      callType: "",
      search: "",
    });

  const hasActiveFilters =
    filters.dateRange !== 28 ||
    filters.district !== "" ||
    filters.beat !== "" ||
    filters.priority !== "" ||
    filters.callType !== "" ||
    filters.search !== "";
  const activeAdvancedFilters = [
    filters.district,
    filters.beat,
    filters.priority,
    filters.callType,
    filters.search,
  ].filter(Boolean).length;

  const renderDateButtons = (buttonClass = "px-3 py-1.5") => (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {dateRangeOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setFilters((f) => ({ ...f, dateRange: opt.value }))}
          className={`${buttonClass} text-xs font-medium transition-colors ${
            filters.dateRange === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const renderAdvancedFilters = (isMobile = false) => (
    <>
      {availableFields.has("district") && uniqueValues.districts.length > 0 && (
        <select
          value={filters.district}
          onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))}
          className={`filter-select ${isMobile ? "h-10 w-full" : ""}`}
        >
          <option value="">All Districts</option>
          {uniqueValues.districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      )}

      {availableFields.has("beat") && uniqueValues.beats.length > 0 && (
        <select
          value={filters.beat}
          onChange={(e) => setFilters((f) => ({ ...f, beat: e.target.value }))}
          className={`filter-select ${isMobile ? "h-10 w-full" : ""}`}
        >
          <option value="">All Beats</option>
          {uniqueValues.beats.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      )}

      {availableFields.has("priority") && uniqueValues.priorities.length > 0 && (
        <select
          value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          className={`filter-select ${isMobile ? "h-10 w-full" : ""}`}
        >
          <option value="">All Priorities</option>
          {uniqueValues.priorities.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      )}

      {availableFields.has("callType") && uniqueValues.callTypes.length > 0 && (
        <select
          value={filters.callType}
          onChange={(e) => setFilters((f) => ({ ...f, callType: e.target.value }))}
          className={`filter-select ${isMobile ? "h-10 w-full max-w-none" : "max-w-[180px]"}`}
        >
          <option value="">All Call Types</option>
          {uniqueValues.callTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}

      <div className={`relative ${isMobile ? "w-full" : ""}`}>
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search ID/address..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className={`filter-input pl-7 ${isMobile ? "h-10 w-full" : "w-[160px]"}`}
        />
      </div>

      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className={`flex items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground ${
            isMobile ? "h-10 w-full rounded-md border border-border bg-card" : ""
          }`}
        >
          <RotateCcw className="h-3 w-3" /> Clear
        </button>
      )}
    </>
  );

  return (
    <div className="sticky top-14 z-40 bg-card/60 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 py-2">
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          {renderDateButtons()}
          {renderAdvancedFilters()}
        </div>

        <div className="space-y-2 sm:hidden">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-x-auto">
              {renderDateButtons("px-2.5 py-2")}
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeAdvancedFilters > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                  {activeAdvancedFilters}
                </span>
              )}
            </button>
          </div>

          {mobileFiltersOpen && (
            <div className="grid gap-2 pb-1">
              {renderAdvancedFilters(true)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
