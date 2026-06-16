import { isWebPushConfigured, sendPushToUsers } from "@/lib/server/push";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type SendTeamChatRequest = {
  teamId?: string;
  message?: string;
};

type TeamChatMessageRow = {
  id: string;
  team_id: string;
  user_id: string;
  message: string;
  read_by?: string[] | null;
  created_at: string;
};

type MemberRow = {
  user_id: string;
};

type ProfileRow = {
  display_name: string | null;
};

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: SendTeamChatRequest;
  try {
    body = (await request.json()) as SendTeamChatRequest;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const teamId = body.teamId;
  const message = body.message?.trim().slice(0, 500);

  if (!teamId) {
    return NextResponse.json({ error: "팀 정보가 필요합니다." }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("team_memberships")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .is("removed_at", null)
      .maybeSingle<{ id: string }>();

    if (membershipError) throw new Error(membershipError.message || "팀 권한을 확인하지 못했습니다.");
    if (!membership) {
      return NextResponse.json({ error: "이 팀 채팅에 접근할 권한이 없습니다." }, { status: 403 });
    }

    const { data: insertedMessage, error: insertError } = await supabase
      .from("team_chat_messages")
      .insert({
        team_id: teamId,
        user_id: user.id,
        message,
        read_by: [user.id],
      })
      .select("*")
      .single<TeamChatMessageRow>();

    if (insertError || !insertedMessage) {
      throw new Error(insertError?.message || "메시지를 보내지 못했습니다.");
    }

    const pushResult = await createNotificationsAndPush(teamId, user.id, message).catch((error) => ({
      sent: 0,
      failed: 0,
      removed: 0,
      subscriptions: 0,
      skipped: true,
      error: error instanceof Error ? error.message : "채팅 알림을 보내지 못했습니다.",
    }));

    return NextResponse.json({ message: insertedMessage, push: pushResult });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "메시지를 보내지 못했습니다." },
      { status: 500 },
    );
  }
}

async function createNotificationsAndPush(teamId: string, senderUserId: string, message: string) {
  const supabase = getSupabaseAdminClient();
  const recipients = await getRecipientUserIds(teamId, senderUserId);
  const senderName = await getSenderName(senderUserId);
  const notificationBody = `${senderName}: ${message}`.slice(0, 180);

  if (recipients.length > 0) {
    const { error } = await supabase.from("notifications").insert(
      recipients.map((userId) => ({
        user_id: userId,
        team_id: teamId,
        type: "team_chat_message",
        title: "새 팀 채팅 메시지",
        body: notificationBody,
        link_url: `/teams/${teamId}/chat`,
      })),
    );

    if (error) throw new Error(error.message || "채팅 알림을 만들지 못했습니다.");
  }

  if (recipients.length === 0 || !isWebPushConfigured()) {
    return { sent: 0, failed: 0, removed: 0, subscriptions: 0, skipped: true };
  }

  return sendPushToUsers(recipients, {
    title: "새 팀 채팅이 도착했습니다",
    body: `${senderName}님: ${truncateText(message, 50)}`,
    url: `/teams/${teamId}/chat`,
    tag: `team-chat-${teamId}`,
  });
}

async function getRecipientUserIds(teamId: string, senderUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("status", "approved")
    .is("removed_at", null)
    .returns<MemberRow[]>();

  if (error) throw new Error(error.message || "팀원 정보를 불러오지 못했습니다.");
  return (data ?? []).map((row) => row.user_id).filter((userId) => userId !== senderUserId);
}

async function getSenderName(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle<ProfileRow>();
  return data?.display_name?.trim() || "팀원";
}

function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}
