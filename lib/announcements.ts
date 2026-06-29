"use client";

import { getCurrentSession } from "@/lib/auth";

export type AnnouncementType = "feature" | "improvement" | "fix" | "important" | "maintenance" | "tip";
export type AnnouncementStatus = "draft" | "published" | "archived";
export type AnnouncementTarget = "all" | "lab_users" | "logged_in_users";

export type AppAnnouncement = {
  id: string;
  title: string;
  summary: string;
  body: string;
  type: AnnouncementType;
  status: AnnouncementStatus;
  priority: number;
  target: AnnouncementTarget;
  linkLabel?: string;
  linkUrl?: string;
  startsAt?: string;
  endsAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  hiddenUntil?: string;
};

export type AnnouncementInput = {
  title: string;
  summary: string;
  body: string;
  type: AnnouncementType;
  status: AnnouncementStatus;
  target: AnnouncementTarget;
  priority: number;
  linkLabel?: string;
  linkUrl?: string;
  startsAt?: string;
  endsAt?: string;
};

export async function getCurrentAnnouncement() {
  return requestJson<{ announcement: AppAnnouncement | null }>("/api/announcements/current");
}

export async function getAnnouncementList() {
  return requestJson<{ announcements: AppAnnouncement[] }>("/api/announcements");
}

export async function markAnnouncementRead(announcementId: string) {
  return requestJson(`/api/announcements/${announcementId}/read`, { method: "POST", requireAuth: true });
}

export async function hideAnnouncementToday(announcementId: string) {
  return requestJson(`/api/announcements/${announcementId}/hide-today`, { method: "POST", requireAuth: true });
}

export async function getAdminAnnouncements() {
  return requestJson<{ announcements: AppAnnouncement[] }>("/api/admin/announcements", { requireAuth: true });
}

export async function createAdminAnnouncement(input: AnnouncementInput) {
  return requestJson<{ announcement: AppAnnouncement }>("/api/admin/announcements", {
    method: "POST",
    body: input,
    requireAuth: true,
  });
}

export async function updateAdminAnnouncement(id: string, input: AnnouncementInput) {
  return requestJson<{ announcement: AppAnnouncement }>(`/api/admin/announcements/${id}`, {
    method: "PATCH",
    body: input,
    requireAuth: true,
  });
}

export async function archiveAdminAnnouncement(id: string) {
  return requestJson<{ announcement: AppAnnouncement }>(`/api/admin/announcements/${id}`, {
    method: "DELETE",
    requireAuth: true,
  });
}

async function requestJson<T>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    requireAuth?: boolean;
  } = {},
): Promise<T> {
  const session = await getCurrentSession();
  if (options.requireAuth && !session?.access_token) throw new Error("로그인이 필요합니다.");

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "요청을 처리하지 못했습니다.");
  return payload as T;
}
