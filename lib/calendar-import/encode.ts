export function encodeValue(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v * 1_000_000);
}

export function toUnixSeconds(input: string | Date): number {
  const d = input instanceof Date ? input : new Date(input);
  return Math.floor(d.getTime() / 1000);
}