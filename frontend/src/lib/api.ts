const DEFAULT_API = "http://localhost:4000";

export function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API).replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBase()}${p}`;
}

export type ApiErrorBody = { error?: { message?: string; code?: string } };

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
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch(apiUrl("/api/v1/menu/items/upload-image"), {
    method: "POST",
    headers,
    body: fd,
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
