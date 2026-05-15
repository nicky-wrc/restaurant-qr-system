import { getRefreshToken, setTokens } from "./auth-storage";

const DEFAULT_API = "http://localhost:4000";

export function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API).replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBase()}${p}`;
}

export type ApiErrorBody = { error?: { message?: string; code?: string } };

async function tryRefreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(apiUrl("/api/v1/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { error: { message: text } };
      }
    }
    if (!res.ok) return null;
    const b = body as { accessToken?: string; refreshToken?: string };
    if (b.accessToken && b.refreshToken) {
      setTokens(b.accessToken, b.refreshToken);
      return b.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

/** ถ้าได้ 401 จะลอง refresh token แล้วยิงซ้ำได้ครั้งเดียว */
async function fetchWithAccessTokenRetry(
  input: string,
  init: RequestInit | undefined,
  accessToken: string,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  const first = await fetch(input, { ...init, headers });
  if (first.status !== 401) return first;
  const next = await tryRefreshAccessToken();
  if (!next) return first;
  headers.set("Authorization", `Bearer ${next}`);
  return fetch(input, { ...init, headers });
}

export function mediaUrl(pathOrUrl: string | null | undefined): string | null {
  if (pathOrUrl == null || pathOrUrl === "") return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getApiBase()}${p}`;
}

export async function uploadMenuItemImage(
  file: File,
  accessToken: string,
): Promise<{ imageUrl: string }> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetchWithAccessTokenRetry(
    apiUrl("/api/v1/menu/items/upload-image"),
    { method: "POST", body: fd },
    accessToken,
  );
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
  return body as { imageUrl: string };
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { accessToken?: string | null },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = init?.accessToken
    ? await fetchWithAccessTokenRetry(apiUrl(path), { ...init, headers }, init.accessToken)
    : await fetch(apiUrl(path), { ...init, headers });
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
