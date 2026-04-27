import { headers } from "next/headers";

export async function getServerBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${protocol}://${host}`;
  return "http://localhost:3000";
}

export async function serverApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const h = await headers();
  const cookie = h.get("cookie");
  const requestHeaders = new Headers(init.headers);
  if (cookie && !requestHeaders.has("cookie")) {
    requestHeaders.set("cookie", cookie);
  }

  const baseUrl = await getServerBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return fetch(`${baseUrl}${normalizedPath}`, {
    ...init,
    headers: requestHeaders,
    cache: init.cache ?? "no-store",
  });
}
