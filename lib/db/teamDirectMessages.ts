"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile, type Profile } from "./profiles";
import { NOTIFICATIONS_UPDATED_EVENT } from "./notifications";

export type TeamDirectThread = {
  id: string;
  teamId: string;
  userAId: string;
  userBId: string;
  createdBy?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamDirectMessage = {
  id: string;
  threadId: string;
  teamId: string;
  senderId: string;
  message: string;
  readBy: string[];
  createdAt: string;
  profile?: Profile | null;
};

export type TeamDirectConversationSummary = TeamDirectThread & {
  otherUserId: string;
  otherProfile?: Profile | null;
  otherPosition?: string;
  unreadCount: number;
};

export type TeamDirectMessageEvent = "INSERT" | "UPDATE";
export type TeamDirectThreadEvent = "INSERT" | "UPDATE";

type TeamDirectThreadRow = {
  id: string;
  team_id: string;
  user_a_id: string;
  user_b_id: string;
  created_by: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type TeamDirectMessageRow = {
  id: string;
  thread_id: string;
  team_id: string;
  sender_id: string;
  message: string;
  read_by?: string[] | null;
  created_at: string;
};

type MemberPositionRow = {
  user_id: string;
  position: string | null;
};

export async function getTeamDirectThreads(teamId: string): Promise<TeamDirectConversationSummary[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_direct_threads")
    .select("*")
    .eq("team_id", teamId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .returns<TeamDirectThreadRow[]>();

  if (error) throw new Error(error.message || "1:1 대화 목록을 불러오지 못했습니다.");

  const threads = (data ?? []).map(rowToThread);
  return attachConversationSummaries(teamId, threads, user.id);
}

export async function getTeamDirectThread(threadId: string): Promise<TeamDirectConversationSummary> {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_direct_threads")
    .select("*")
    .eq("id", threadId)
    .maybeSingle<TeamDirectThreadRow>();

  if (error) throw new Error(error.message || "1:1 대화방을 불러오지 못했습니다.");
  if (!data) throw new Error("1:1 대화방을 찾을 수 없습니다.");

  const [summary] = await attachConversationSummaries(data.team_id, [rowToThread(data)], user.id);
  return summary;
}

export async function getOrCreateTeamDirectThread(teamId: string, otherUserId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .rpc("get_or_create_team_direct_thread", {
      p_team_id: teamId,
      p_other_user_id: otherUserId,
    })
    .single<TeamDirectThreadRow>();

  if (error) throw new Error(error.message || "1:1 대화방을 만들지 못했습니다.");
  return rowToThread(data);
}

export async function getTeamDirectMessages(threadId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_direct_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(160)
    .returns<TeamDirectMessageRow[]>();

  if (error) throw new Error(error.message || "1:1 메시지를 불러오지 못했습니다.");
  return attachMessageProfiles((data ?? []).map(rowToMessage));
}

export async function sendTeamDirectMessage(threadId: string, message: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const trimmedMessage = message.trim();
  if (!trimmedMessage) throw new Error("메시지를 입력해 주세요.");

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");

  const response = await fetch("/api/team-direct/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ threadId, message: trimmedMessage }),
  });
  const result = (await response.json().catch(() => ({}))) as { message?: TeamDirectMessageRow; error?: string };

  if (!response.ok || !result.message) throw new Error(result.error || "메시지를 보내지 못했습니다.");
  const [nextMessage] = await attachMessageProfiles([rowToMessage(result.message)]);
  return nextMessage;
}

export async function markTeamDirectMessagesRead(threadId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("mark_team_direct_messages_read", { p_thread_id: threadId });

  if (error) throw new Error(error.message || "1:1 메시지 읽음 처리를 하지 못했습니다.");
}

export function subscribeTeamDirectMessages(
  threadId: string,
  callback: (message: TeamDirectMessage, event: TeamDirectMessageEvent) => void,
  onStatusChange?: (status: string, error?: unknown) => void,
) {
  const supabase = getSupabaseBrowserClient();
  const channelName = `team-direct-message:${threadId}:${Math.random().toString(36).slice(2)}`;

  try {
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_direct_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async ({ new: row }) => {
          try {
            const [message] = await attachMessageProfiles([rowToMessage(row as TeamDirectMessageRow)]);
            callback(message, "INSERT");
          } catch {
            // Polling in the UI can repair missed realtime payloads.
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "team_direct_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async ({ new: row }) => {
          try {
            const [message] = await attachMessageProfiles([rowToMessage(row as TeamDirectMessageRow)]);
            callback(message, "UPDATE");
          } catch {
            // Polling in the UI can repair missed read updates.
          }
        },
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

export function subscribeTeamDirectThreads(
  teamId: string,
  callback: (thread: TeamDirectThread, event: TeamDirectThreadEvent) => void,
  onStatusChange?: (status: string, error?: unknown) => void,
) {
  const supabase = getSupabaseBrowserClient();
  const channelName = `team-direct-thread:${teamId}:${Math.random().toString(36).slice(2)}`;

  try {
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_direct_threads",
          filter: `team_id=eq.${teamId}`,
        },
        ({ new: row }) => callback(rowToThread(row as TeamDirectThreadRow), "INSERT"),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "team_direct_threads",
          filter: `team_id=eq.${teamId}`,
        },
        ({ new: row }) => callback(rowToThread(row as TeamDirectThreadRow), "UPDATE"),
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

export function dispatchDirectNotificationsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
}

async function attachConversationSummaries(teamId: string, threads: TeamDirectThread[], currentUserId: string) {
  const threadIds = threads.map((thread) => thread.id);
  const otherUserIds = Array.from(new Set(threads.map((thread) => getOtherUserId(thread, currentUserId))));
  const [profilesById, positionsById, unreadByThreadId] = await Promise.all([
    getProfilesById(otherUserIds),
    getPositionsById(teamId, otherUserIds),
    getUnreadCounts(threadIds, currentUserId),
  ]);

  return threads.map((thread) => {
    const otherUserId = getOtherUserId(thread, currentUserId);
    return {
      ...thread,
      otherUserId,
      otherProfile: profilesById.get(otherUserId) ?? null,
      otherPosition: positionsById.get(otherUserId) ?? undefined,
      unreadCount: unreadByThreadId.get(thread.id) ?? 0,
    };
  });
}

async function getProfilesById(userIds: string[]) {
  const entries = await Promise.all(userIds.map(async (userId) => [userId, await getProfile(userId).catch(() => null)] as const));
  return new Map(entries);
}

async function getPositionsById(teamId: string, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("team_memberships")
    .select("user_id,position")
    .eq("team_id", teamId)
    .eq("status", "approved")
    .in("user_id", userIds)
    .returns<MemberPositionRow[]>();

  return new Map((data ?? []).map((row) => [row.user_id, row.position ?? "팀원"]));
}

async function getUnreadCounts(threadIds: string[], currentUserId: string) {
  if (threadIds.length === 0) return new Map<string, number>();

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("team_direct_messages")
    .select("thread_id,sender_id,read_by")
    .in("thread_id", threadIds)
    .returns<Array<{ thread_id: string; sender_id: string; read_by: string[] | null }>>();

  const unreadByThreadId = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.sender_id === currentUserId) continue;
    if ((row.read_by ?? []).includes(currentUserId)) continue;
    unreadByThreadId.set(row.thread_id, (unreadByThreadId.get(row.thread_id) ?? 0) + 1);
  }
  return unreadByThreadId;
}

async function attachMessageProfiles(messages: TeamDirectMessage[]) {
  const profileByUserId = await getProfilesById(Array.from(new Set(messages.map((message) => message.senderId))));
  return messages.map((message) => ({ ...message, profile: profileByUserId.get(message.senderId) ?? null }));
}

function getOtherUserId(thread: TeamDirectThread, currentUserId: string) {
  return thread.userAId === currentUserId ? thread.userBId : thread.userAId;
}

function rowToThread(row: TeamDirectThreadRow): TeamDirectThread {
  return {
    id: row.id,
    teamId: row.team_id,
    userAId: row.user_a_id,
    userBId: row.user_b_id,
    createdBy: row.created_by ?? undefined,
    lastMessage: row.last_message ?? undefined,
    lastMessageAt: row.last_message_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMessage(row: TeamDirectMessageRow): TeamDirectMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    teamId: row.team_id,
    senderId: row.sender_id,
    message: row.message,
    readBy: row.read_by ?? [],
    createdAt: row.created_at,
  };
}
