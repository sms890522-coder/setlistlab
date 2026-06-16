"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createTeamChatMessageNotifications } from "./notifications";
import { getProfile, type Profile } from "./profiles";
import { dispatchPushEvent } from "./pushEvents";

export type TeamChatMessage = {
  id: string;
  teamId: string;
  userId: string;
  message: string;
  readBy: string[];
  createdAt: string;
  profile?: Profile | null;
};

export type TeamChatMessageEvent = "INSERT" | "UPDATE";

export type TeamChatPresence = {
  userId: string;
  displayName: string;
  role: string;
  onlineAt: string;
};

type TeamChatMessageRow = {
  id: string;
  team_id: string;
  user_id: string;
  message: string;
  read_by?: string[] | null;
  created_at: string;
};

export async function getTeamMessages(teamId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_chat_messages")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true })
    .limit(120)
    .returns<TeamChatMessageRow[]>();

  if (error) throw new Error(error.message || "팀 채팅을 불러오지 못했습니다.");

  return attachProfiles((data ?? []).map(rowToMessage));
}

export async function sendTeamMessage(teamId: string, message: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const trimmedMessage = message.trim();
  if (!trimmedMessage) throw new Error("메시지를 입력해 주세요.");

  const supabase = getSupabaseBrowserClient();
  let { data, error } = await supabase
    .from("team_chat_messages")
    .insert({
      team_id: teamId,
      user_id: user.id,
      message: trimmedMessage.slice(0, 500),
      read_by: [user.id],
    })
    .select("*")
    .single<TeamChatMessageRow>();

  if (error && isMissingReadByColumnError(error.message)) {
    const retryResult = await supabase
      .from("team_chat_messages")
      .insert({
        team_id: teamId,
        user_id: user.id,
        message: trimmedMessage.slice(0, 500),
      })
      .select("*")
      .single<TeamChatMessageRow>();

    data = retryResult.data;
    error = retryResult.error;
  }

  if (error || !data) throw new Error(error?.message || "메시지를 보내지 못했습니다.");
  await createTeamChatMessageNotifications(data.id).catch(() => undefined);
  void dispatchPushEvent({ eventType: "team_chat_message", messageId: data.id });
  const [nextMessage] = await attachProfiles([rowToMessage(data)]);
  return nextMessage;
}

export async function markTeamMessagesRead(teamId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("mark_team_chat_messages_read", { p_team_id: teamId });

  if (error) throw new Error(error.message || "채팅 읽음 처리를 하지 못했습니다.");
}

export function subscribeTeamMessages(
  teamId: string,
  callback: (message: TeamChatMessage, event: TeamChatMessageEvent) => void,
  onStatusChange?: (status: string, error?: unknown) => void,
) {
  const supabase = getSupabaseBrowserClient();

  try {
    const channel = supabase
      .channel(`team-chat:${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_chat_messages",
          filter: `team_id=eq.${teamId}`,
        },
        async ({ new: row }) => {
          try {
            const message = rowToMessage(row as TeamChatMessageRow);
            const [messageWithProfile] = await attachProfiles([message]);
            callback(messageWithProfile, "INSERT");
          } catch {
            // Polling in the UI keeps chat usable if realtime enrichment fails.
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "team_chat_messages",
          filter: `team_id=eq.${teamId}`,
        },
        async ({ new: row }) => {
          try {
            const message = rowToMessage(row as TeamChatMessageRow);
            const [messageWithProfile] = await attachProfiles([message]);
            callback(messageWithProfile, "UPDATE");
          } catch {
            // Polling in the UI repairs missed read-count updates.
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

export function subscribeTeamChatPresence(teamId: string, presence: TeamChatPresence, callback: (members: TeamChatPresence[]) => void) {
  const supabase = getSupabaseBrowserClient();

  try {
    const channel = supabase.channel(`team-chat-presence:${teamId}`, {
      config: {
        presence: { key: presence.userId },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        callback(readPresenceMembers(channel));
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;

        await channel.track({
          ...presence,
          onlineAt: new Date().toISOString(),
        });
        callback(readPresenceMembers(channel));
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  } catch {
    return () => undefined;
  }
}

async function attachProfiles(messages: TeamChatMessage[]) {
  const profileByUserId = new Map<string, Profile | null>();

  await Promise.all(
    Array.from(new Set(messages.map((message) => message.userId))).map(async (userId) => {
      profileByUserId.set(userId, await getProfile(userId).catch(() => null));
    }),
  );

  return messages.map((message) => ({ ...message, profile: profileByUserId.get(message.userId) ?? null }));
}

function rowToMessage(row: TeamChatMessageRow): TeamChatMessage {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    message: row.message,
    readBy: row.read_by ?? [],
    createdAt: row.created_at,
  };
}

function isMissingReadByColumnError(message?: string) {
  return Boolean(message?.includes("read_by") || message?.toLowerCase().includes("schema cache"));
}

function readPresenceMembers(channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]>) {
  const state = channel.presenceState() as Record<string, TeamChatPresence[]>;

  return Object.values(state)
    .flat()
    .filter(isTeamChatPresence)
    .sort((a, b) => {
      const roleCompare = a.role.localeCompare(b.role, "ko-KR");
      if (roleCompare !== 0) return roleCompare;
      return a.displayName.localeCompare(b.displayName, "ko-KR");
    });
}

function isTeamChatPresence(value: unknown): value is TeamChatPresence {
  if (!value || typeof value !== "object") return false;

  const presence = value as Partial<TeamChatPresence>;
  return Boolean(presence.userId && presence.displayName && presence.role && presence.onlineAt);
}
