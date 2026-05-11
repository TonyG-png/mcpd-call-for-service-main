import { NormalizedIncident } from "@/types/incident";

export function exportToCSV(incidents: NormalizedIncident[], filename = "incidents.csv") {
  if (!incidents.length) return;

  const headers = [
    "Incident ID", "Start Time", "End Time", "Call Type", "Priority",
    "District", "Beat", "Address", "City", "Latitude", "Longitude", "Category",
  ];

  const rows = incidents.map((inc) => [
    inc.incidentId || "",
    inc.startTime?.toISOString() || "",
    inc.endTime?.toISOString() || "",
    inc.callType || "",
    inc.priority || "",
    inc.district || "",
    inc.beat || "",
    inc.address || "",
    inc.city || "",
    inc.latitude?.toString() || "",
    inc.longitude?.toString() || "",
    inc.serviceCategory || "",
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
