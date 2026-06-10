"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile, type Profile } from "./profiles";

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

type TeamChatMessageRow = {
  id: string;
  team_id: string;
  user_id: string;
  message: string;
  read_by: string[] | null;
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

  if (error) {
    console.error("getTeamMessages error", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    throw new Error(error.message || "팀 채팅을 불러오지 못했습니다.");
  }

  return (data ?? []).map(rowToMessage);
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
  return rowToMessage(data);
  
}

export async function markTeamMessagesRead(teamId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("mark_team_chat_messages_read", { p_team_id: teamId });

  if (error) throw new Error(error.message || "채팅 읽음 처리를 하지 못했습니다.");
}

export function subscribeTeamMessages(teamId: string, callback: (message: TeamChatMessage, event: TeamChatMessageEvent) => void) {
  const supabase = getSupabaseBrowserClient();
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
          callback(message, "INSERT");
        } catch (error) {
          console.error("team_chat_messages INSERT payload error", {
            error,
            row,
          });
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
        } catch (error) {
          console.error("team_chat_messages UPDATE payload error", {
            error,
            row,
          });
        }
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
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
