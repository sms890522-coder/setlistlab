"use client";

import { getCurrentUser } from "@/lib/auth";
import { sanitizeRedirectPath } from "@/lib/routes";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export const NOTIFICATIONS_UPDATED_EVENT = "setlistlab:notifications-updated";

export type NotificationType =
  | "team_chat_message"
  | "team_direct_message"
  | "team_setlist_created"
  | "team_invite_requested"
  | "team_invite_approved";

export type AppNotification = {
  id: string;
  userId: string;
  teamId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
  readAt?: string;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  team_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

export async function getNotifications(limit = 20) {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<NotificationRow[]>();

  if (error) throw new Error(error.message || "알림을 불러오지 못했습니다.");
  return (data ?? []).map(rowToNotification);
}

export async function getUnreadNotificationCount() {
  if (!isSupabaseConfigured()) return 0;

  const supabase = getSupabaseBrowserClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw new Error(error.message || "읽지 않은 알림 개수를 불러오지 못했습니다.");
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select("*")
    .single<NotificationRow>();

  if (error) throw new Error(error.message || "알림을 읽음 처리하지 못했습니다.");
  dispatchNotificationsUpdated();
  return rowToNotification(data);
}

export async function markAllNotificationsRead() {
  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("notifications").update({ read_at: now }).is("read_at", null);

  if (error) throw new Error(error.message || "알림을 모두 읽음 처리하지 못했습니다.");
  dispatchNotificationsUpdated();
  return now;
}

export async function markTeamChatNotificationsRead(teamId: string) {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("team_id", teamId)
    .eq("type", "team_chat_message")
    .is("read_at", null)
    .select("id")
    .returns<Array<{ id: string }>>();

  if (error) throw new Error(error.message || "채팅 알림을 읽음 처리하지 못했습니다.");
  dispatchNotificationsUpdated();
  return data ?? [];
}

export async function markTeamDirectNotificationsRead(threadId: string) {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("type", "team_direct_message")
    .like("link_url", `%/direct/${threadId}`)
    .is("read_at", null)
    .select("id")
    .returns<Array<{ id: string }>>();

  if (error) throw new Error(error.message || "1:1 대화 알림을 읽음 처리하지 못했습니다.");

  dispatchNotificationsUpdated();
  return data ?? [];
}

export async function createTeamChatMessageNotifications(messageId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("create_team_chat_message_notifications", { p_message_id: messageId });
  if (error) throw new Error(error.message || "채팅 알림을 만들지 못했습니다.");
}

export async function createTeamSetlistCreatedNotifications(setlistId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("create_team_setlist_created_notifications", { p_setlist_id: setlistId });
  if (error) throw new Error(error.message || "팀 콘티 알림을 만들지 못했습니다.");
  return Boolean(data);
}

export async function createTeamInviteApprovedNotification(membershipId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("create_team_invite_approved_notification", { p_membership_id: membershipId });
  if (error) throw new Error(error.message || "팀 승인 알림을 만들지 못했습니다.");
}

export function subscribeNotifications(
  userId: string,
  callback: (notification: AppNotification, event: "INSERT" | "UPDATE") => void,
  onStatusChange?: (status: string, error?: unknown) => void,
) {
  const supabase = getSupabaseBrowserClient();

  try {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        ({ new: row }) => callback(rowToNotification(row as NotificationRow), "INSERT"),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        ({ new: row }) => callback(rowToNotification(row as NotificationRow), "UPDATE"),
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          onStatusChange?.(status, error);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  } catch (error) {
    onStatusChange?.("CHANNEL_ERROR", error);
    return () => undefined;
  }
}

export async function getCurrentNotificationUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export function getSafeNotificationLink(linkUrl?: string) {
  return linkUrl ? sanitizeRedirectPath(linkUrl, "") : "";
}

function rowToNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id ?? undefined,
    type: row.type,
    title: row.title,
    body: row.body ?? undefined,
    linkUrl: row.link_url ?? undefined,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
  };
}

function dispatchNotificationsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
}
