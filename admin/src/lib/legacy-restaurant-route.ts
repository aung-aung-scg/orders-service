import { redirect } from "next/navigation";

export function redirectLegacyRestaurantPage(path: string, search: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    for (const item of typeof value === "string" ? [value] : value ?? []) query.append(key, item);
  }
  redirect(path + (query.size ? "?" + query : ""));
}
