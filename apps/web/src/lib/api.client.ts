import { parseApiResponse } from "./api-error";

/** Browser-side calls to /api/v1 through the same-origin rewrite. */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  return parseApiResponse<T>(response);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiSend<T>(method: "PUT" | "PATCH" | "DELETE", path: string, body?: unknown) {
  return apiRequest<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
