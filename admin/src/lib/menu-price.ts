export function parseMenuPrice(value: string): number | null {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return null;
  const [baht, satang = ""] = value.split(".");
  return Number(baht + satang.padEnd(2, "0"));
}
