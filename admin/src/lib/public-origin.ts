import "server-only";

export function publicUrl(path: string) {
  return new URL(path, process.env.PUBLIC_BASE_URL ?? "http://localhost:3001");
}
