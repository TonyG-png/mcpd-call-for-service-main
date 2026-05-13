import { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { CalendarDays, Check, ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { getDateRangeOptions } from "@/lib/dateRanges";

export default function GlobalFilters() {
  const { incidents, filters, setFilters, availableFields } = useData();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [districtMenuOpen, setDistrictMenuOpen] = useState(false);
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
      customStartDate: "",
      customEndDate: "",
      district: [],
      beat: "",
      priority: "",
      callType: "",
    });

  const hasActiveFilters =
    filters.dateRange !== 28 ||
    filters.customStartDate !== "" ||
    filters.customEndDate !== "" ||
    filters.district.length > 0 ||
    filters.beat !== "" ||
    filters.priority !== "" ||
    filters.callType !== "";
  const activeAdvancedFilters = [
    filters.district.length > 0 ? filters.district.join(",") : "",
    filters.beat,
    filters.priority,
    filters.callType,
    filters.dateRange === "custom" ? [filters.customStartDate, filters.customEndDate].filter(Boolean).join(" to ") : "",
  ].filter(Boolean).length;

  const setCustomDate = (field: "customStartDate" | "customEndDate", value: string) => {
    setFilters((f) => ({
      ...f,
      dateRange: "custom",
      [field]: value,
    }));
  };

  const renderDateControls = (buttonClass = "px-3 py-1.5", isMobile = false) => (
    <div className={`flex ${isMobile ? "w-full flex-col gap-2" : "flex-wrap items-center gap-2"}`}>
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
      <div className={`flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 ${
        isMobile ? "w-full" : ""
      }`}>
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          type="date"
          value={filters.customStartDate}
          onChange={(e) => setCustomDate("customStartDate", e.target.value)}
          className="h-7 min-w-0 bg-transparent text-xs text-foreground outline-none"
          aria-label="Custom start date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={filters.customEndDate}
          onChange={(e) => setCustomDate("customEndDate", e.target.value)}
          className="h-7 min-w-0 bg-transparent text-xs text-foreground outline-none"
          aria-label="Custom end date"
        />
      </div>
    </div>
  );

  const renderAdvancedFilters = (isMobile = false) => (
    <>
      {availableFields.has("district") && uniqueValues.districts.length > 0 && (
        <div className={`relative ${isMobile ? "w-full" : ""}`}>
          <button
            type="button"
            onClick={() => setDistrictMenuOpen((open) => !open)}
            className={`filter-select flex items-center justify-between gap-3 text-left ${
              isMobile ? "h-10 w-full" : "min-w-[140px]"
            }`}
          >
            <span className="truncate">
              {filters.district.length === 0
                ? "All Districts"
                : filters.district.length === 1
                ? filters.district[0]
                : `${filters.district.length} Districts`}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>

          {districtMenuOpen && (
            <div className={`absolute left-0 top-full z-50 mt-1 rounded-md border border-border bg-card p-1 shadow-lg ${
              isMobile ? "w-full" : "w-48"
            }`}>
              <button
                type="button"
                onClick={() => {
                  setFilters((f) => ({ ...f, district: [] }));
                  setDistrictMenuOpen(false);
                }}
                className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs text-foreground hover:bg-accent"
              >
                All Districts
                {filters.district.length === 0 && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
              {uniqueValues.districts.map((d) => {
                const selected = filters.district.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        district: selected
                          ? f.district.filter((value) => value !== d)
                          : [...f.district, d].sort(),
                      }))
                    }
                    className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs text-foreground hover:bg-accent"
                  >
                    {d}
                    {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
          {renderDateControls()}
          {renderAdvancedFilters()}
        </div>

        <div className="space-y-2 sm:hidden">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-x-auto">
              {renderDateControls("px-2.5 py-2", true)}
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
