import { backendFetch } from "@/lib/api";
import { menuImageFilename } from "@/lib/menu-image";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!menuImageFilename.test(file)) return new Response(null, { status: 404 });

  const upstream = await backendFetch("/menu-images/" + file, { cache: "no-store" })
    .catch(() => null);
  if (!upstream) return new Response(null, { status: 502 });
  const headers = new Headers();
  for (const name of ["Content-Type", "X-Content-Type-Options", "Cache-Control", "Content-Length"]) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
