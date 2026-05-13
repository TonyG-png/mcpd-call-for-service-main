export function normalizeLocationPart(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").toUpperCase() || "";
}

export function getNormalizedLocationKey(address?: string | null, city?: string | null) {
  const normalizedAddress = normalizeLocationPart(address);
  const normalizedCity = normalizeLocationPart(city) || "UNKNOWN";
  return normalizedAddress ? `${normalizedAddress}|${normalizedCity}` : "";
}

export function formatLocationLabel(address: string, city?: string | null) {
  const normalizedCity = normalizeLocationPart(city);
  return `${address}${normalizedCity && normalizedCity !== "UNKNOWN" ? `, ${normalizedCity}` : ""}`;
}
