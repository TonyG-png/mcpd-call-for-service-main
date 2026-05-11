/**
 * Analytics computations for police CFS data.
 * All functions accept NormalizedIncident[] and return chart-ready data.
 */

import { NormalizedIncident } from "@/types/incident";
import { getCallTypeCode } from "@/lib/callTypes";

export function callsByDay(incidents: NormalizedIncident[]) {
  const counts: Record<string, number> = {};
  incidents.forEach((inc) => {
    if (inc.startTime) {
      const key = inc.startTime.toISOString().slice(0, 10);
      counts[key] = (counts[key] || 0) + 1;
    }
  });
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export function callsByHour(incidents: NormalizedIncident[]) {
  const counts = Array(24).fill(0);
  incidents.forEach((inc) => {
    if (inc.startTime) counts[inc.startTime.getHours()]++;
  });
  return counts.map((count, hour) => ({
    hour: `${hour.toString().padStart(2, "0")}:00`,
    count,
  }));
}

export function topCallTypes(incidents: NormalizedIncident[], n = 10) {
  const counts: Record<string, number> = {};
  incidents.forEach((inc) => {
    if (inc.callType) counts[inc.callType] = (counts[inc.callType] || 0) + 1;
  });
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([type, count]) => ({ type, count }));
}

export function topCallTypeCodes(incidents: NormalizedIncident[], n = 10) {
  const counts: Record<string, number> = {};
  incidents.forEach((inc) => {
    const code = getCallTypeCode(inc.callType);
    if (code) counts[code] = (counts[code] || 0) + 1;
  });
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([type, count]) => ({ type, count }));
}

export function priorityBreakdown(incidents: NormalizedIncident[]) {
  const counts: Record<string, number> = {};
  incidents.forEach((inc) => {
    if (inc.priority) counts[inc.priority] = (counts[inc.priority] || 0) + 1;
  });
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([priority, count]) => ({ priority, count }));
}

export function districtBreakdown(incidents: NormalizedIncident[]) {
  const counts: Record<string, number> = {};
  incidents.forEach((inc) => {
    if (inc.district) counts[inc.district] = (counts[inc.district] || 0) + 1;
  });
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([district, count]) => ({ district, count }));
}

export function avgDuration(incidents: NormalizedIncident[]): number | null {
  const durations: number[] = [];
  incidents.forEach((inc) => {
    if (inc.startTime && inc.endTime) {
      const mins = (inc.endTime.getTime() - inc.startTime.getTime()) / 60000;
      if (mins >= 0 && mins < 1440) durations.push(mins); // Cap at 24hrs
    }
  });
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

export function rollingAverage(daily: { date: string; count: number }[], window = 7) {
  return daily.map((item, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = daily.slice(start, i + 1);
    const avg = Math.round(slice.reduce((s, d) => s + d.count, 0) / slice.length);
    return { date: item.date, count: item.count, avg };
  });
}

export function callsByDayOfWeek(incidents: NormalizedIncident[]) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = Array(7).fill(0);
  incidents.forEach((inc) => {
    if (inc.startTime) counts[inc.startTime.getDay()]++;
  });
  return days.map((day, i) => ({ day, count: counts[i] }));
}

export function avgTimeByCallType(incidents: NormalizedIncident[], n = 10) {
  const sums: Record<string, { total: number; count: number }> = {};
  incidents.forEach((inc) => {
    if (inc.callType && inc.startTime && inc.endTime) {
      const mins = (inc.endTime.getTime() - inc.startTime.getTime()) / 60000;
      if (mins >= 0 && mins < 1440) {
        if (!sums[inc.callType]) sums[inc.callType] = { total: 0, count: 0 };
        sums[inc.callType].total += mins;
        sums[inc.callType].count++;
      }
    }
  });
  return Object.entries(sums)
    .filter(([, v]) => v.count >= 3)
    .map(([type, v]) => ({ type, avgMinutes: Math.round(v.total / v.count) }))
    .sort((a, b) => b.avgMinutes - a.avgMinutes)
    .slice(0, n);
}

export function avgTimeByCallTypeCode(incidents: NormalizedIncident[], n = 10) {
  const sums: Record<string, { total: number; count: number }> = {};
  incidents.forEach((inc) => {
    const code = getCallTypeCode(inc.callType);
    if (code && inc.startTime && inc.endTime) {
      const mins = (inc.endTime.getTime() - inc.startTime.getTime()) / 60000;
      if (mins >= 0 && mins < 1440) {
        if (!sums[code]) sums[code] = { total: 0, count: 0 };
        sums[code].total += mins;
        sums[code].count++;
      }
    }
  });
  return Object.entries(sums)
    .filter(([, v]) => v.count >= 3)
    .map(([type, v]) => ({ type, avgMinutes: Math.round(v.total / v.count) }))
    .sort((a, b) => b.avgMinutes - a.avgMinutes)
    .slice(0, n);
}

export function categoryBreakdown(incidents: NormalizedIncident[]) {
  const counts: Record<string, number> = {};
  incidents.forEach((inc) => {
    if (inc.serviceCategory)
      counts[inc.serviceCategory] = (counts[inc.serviceCategory] || 0) + 1;
  });
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({ category, count }));
}

export function overnightCalls(incidents: NormalizedIncident[]) {
  return incidents.filter((inc) => {
    if (!inc.startTime) return false;
    const h = inc.startTime.getHours();
    return h >= 22 || h < 6;
  }).length;
}

export function weekendVsWeekday(incidents: NormalizedIncident[]) {
  let weekend = 0;
  let weekday = 0;
  incidents.forEach((inc) => {
    if (inc.startTime) {
      const d = inc.startTime.getDay();
      if (d === 0 || d === 6) weekend++;
      else weekday++;
    }
  });
  return [
    { label: "Weekday", count: weekday },
    { label: "Weekend", count: weekend },
  ];
}
