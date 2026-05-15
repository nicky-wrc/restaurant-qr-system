const DEFAULT_API = "http://localhost:4000";

export function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API).replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBase()}${p}`;
}

export type ApiErrorBody = { error?: { message?: string; code?: string } };

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { accessToken?: string | null },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (init?.accessToken) {
    headers.set("Authorization", `Bearer ${init.accessToken}`);
  }
  const res = await fetch(apiUrl(path), { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: { message: text } };
    }
  }
  if (!res.ok) {
    const err = body as ApiErrorBody;
    throw new Error(err.error?.message ?? res.statusText);
  }
  return body as T;
}
