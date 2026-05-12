import { supabase } from "../services/supabaseClient";

type ApiErrorBody = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (!headers.Authorization) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  if (init?.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers,
  });

  const json = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!res.ok) {
    const msg = json.error || json.message || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return json as T;
}
