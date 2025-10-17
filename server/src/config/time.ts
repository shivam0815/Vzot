// null-safe IST converter
export function toIST(d?: Date | string | null): string | undefined {
  if (!d) return undefined;
  return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}
