import type { DateRangeOption } from "@/types/incident";

export interface DateRangeBounds {
  start: Date;
  end?: Date;
}

export interface DateRangeChoice {
  value: DateRangeOption;
  label: string;
}

export function getDateRangeOptions(now = new Date()): DateRangeChoice[] {
  return [
    { value: 7, label: "7 Days" },
    { value: 14, label: "14 Days" },
    { value: 28, label: "28 Days" },
    { value: "ytd", label: "YTD" },
  ];
}

function parseDateInput(value?: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getDateRangeBounds(
  range: DateRangeOption,
  now = new Date(),
  customStartDate?: string,
  customEndDate?: string,
): DateRangeBounds {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (typeof range === "number") {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - range);
    return { start, end: todayStart };
  }

  if (range === "ytd") {
    return { start: new Date(now.getFullYear(), 0, 1), end: todayStart };
  }

  if (range === "custom") {
    const customStart = parseDateInput(customStartDate);
    const customEnd = parseDateInput(customEndDate);

    if (customStart && customEnd) {
      const end = new Date(customEnd);
      end.setDate(end.getDate() + 1);
      return customStart <= customEnd
        ? { start: customStart, end }
        : { start: customEnd, end: new Date(customStart.getFullYear(), customStart.getMonth(), customStart.getDate() + 1) };
    }

    if (customStart) {
      return { start: customStart };
    }
  }

  const start = new Date(todayStart);
  start.setDate(start.getDate() - 28);
  return { start, end: todayStart };
}

export function getDateRangeLabel(range: DateRangeOption) {
  return getDateRangeOptions().find((option) => option.value === range)?.label || "Selected range";
}

export function formatSocrataDateTime(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
