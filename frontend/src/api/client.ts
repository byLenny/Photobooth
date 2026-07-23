import type { AdminSettings, CameraStatus, Settings, SessionSummary, SessionDetail } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getSettings(): Promise<Settings> {
  return request<Settings>("/api/settings");
}

export function createSession(photos: Blob[], email?: string): Promise<SessionDetail> {
  const form = new FormData();
  photos.forEach((blob, i) => form.append("photo", blob, `shot-${i + 1}.jpg`));
  if (email) form.append("email", email);
  return request<SessionDetail>("/api/sessions", { method: "POST", body: form });
}

export function listSessions(limit = 12): Promise<SessionSummary[]> {
  return request<SessionSummary[]>(`/api/sessions?limit=${limit}`);
}

export function adminLogin(pin: string): Promise<{ ok: true }> {
  return request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
}

export function adminLogout(): Promise<{ ok: true }> {
  return request("/api/admin/logout", { method: "POST" });
}

export function adminMe(): Promise<{ ok: true }> {
  return request("/api/admin/me");
}

export function adminGetSettings(): Promise<AdminSettings> {
  return request<AdminSettings>("/api/admin/settings");
}

export function adminUpdateSettings(partial: Partial<AdminSettings>): Promise<AdminSettings> {
  return request<AdminSettings>("/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  });
}

export function adminGetCameraStatus(): Promise<CameraStatus> {
  return request<CameraStatus>("/api/admin/camera/status");
}

export function adminChangePin(currentPin: string, newPin: string): Promise<{ ok: true }> {
  return request("/api/admin/change-pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPin, newPin }),
  });
}

export function adminListSessions(
  limit = 20,
  offset = 0,
): Promise<{ total: number; items: SessionDetail[] }> {
  return request(`/api/admin/sessions?limit=${limit}&offset=${offset}`);
}

export function adminGetSession(id: string): Promise<SessionDetail> {
  return request<SessionDetail>(`/api/admin/sessions/${id}`);
}

export async function adminUploadOverlay(file: File): Promise<{ ok: true; overlayFile: string }> {
  const form = new FormData();
  form.append("file", file);
  return request("/api/admin/overlay", { method: "POST", body: form });
}
