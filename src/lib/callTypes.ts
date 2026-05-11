export function getCallTypeCode(callType?: string | null) {
  return (callType || "")
    .trim()
    .split(/\s*-\s*|\s+/)[0]
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

export function isTruCallType(callType?: string | null) {
  return getCallTypeCode(callType).endsWith("T");
}
