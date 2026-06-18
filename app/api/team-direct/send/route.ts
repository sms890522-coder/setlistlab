import { isWebPushConfigured, sendPushToUsers } from "@/lib/server/push";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type SendTeamDirectRequest = {
  threadId?: string;
  message?: string;
};

type TeamDirectThreadRow = {
  id: string;
  team_id: string;
  user_a_id: string;
  user_b_id: string;
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

type ProfileRow = {
  display_name: string | null;
};

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: SendTeamDirectRequest;
  try {
    body = (await request.json()) as SendTeamDirectRequest;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const threadId = body.threadId;
  const message = body.message?.trim().slice(0, 500);

  if (!threadId) {
    return NextResponse.json({ error: "1:1 대화방 정보가 필요합니다." }, { status: 400 });
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

    const thread = await getThread(threadId);
    if (![thread.user_a_id, thread.user_b_id].includes(user.id)) {
      return NextResponse.json({ error: "이 1:1 대화에 접근할 권한이 없습니다." }, { status: 403 });
    }

    const otherUserId = thread.user_a_id === user.id ? thread.user_b_id : thread.user_a_id;
    const [senderApproved, recipientApproved] = await Promise.all([
      isApprovedTeamMember(thread.team_id, user.id),
      isApprovedTeamMember(thread.team_id, otherUserId),
    ]);

    if (!senderApproved || !recipientApproved) {
      return NextResponse.json({ error: "승인된 팀원끼리만 1:1 대화를 사용할 수 있습니다." }, { status: 403 });
    }

    const { data: insertedMessage, error: insertError } = await supabase
      .from("team_direct_messages")
      .insert({
        thread_id: thread.id,
        team_id: thread.team_id,
        sender_id: user.id,
        message,
        read_by: [user.id],
      })
      .select("*")
      .single<TeamDirectMessageRow>();

    if (insertError || !insertedMessage) {
      throw new Error(insertError?.message || "메시지를 보내지 못했습니다.");
    }

    const { error: threadError } = await supabase
      .from("team_direct_threads")
      .update({
        last_message: message,
        last_message_at: insertedMessage.created_at,
        updated_at: insertedMessage.created_at,
      })
      .eq("id", thread.id);

    if (threadError) throw new Error(threadError.message || "대화방 정보를 갱신하지 못했습니다.");

    const pushResult = await createNotificationAndPush(thread.team_id, thread.id, user.id, otherUserId, message).catch((error) => ({
      sent: 0,
      failed: 0,
      removed: 0,
      subscriptions: 0,
      skipped: true,
      error: error instanceof Error ? error.message : "1:1 메시지 알림을 보내지 못했습니다.",
    }));

    return NextResponse.json({ message: insertedMessage, push: pushResult });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "메시지를 보내지 못했습니다." },
      { status: 500 },
    );
  }
}

async function getThread(threadId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_direct_threads")
    .select("id,team_id,user_a_id,user_b_id")
    .eq("id", threadId)
    .maybeSingle<TeamDirectThreadRow>();

  if (error || !data) throw new Error(error?.message || "1:1 대화방을 찾을 수 없습니다.");
  return data;
}

async function isApprovedTeamMember(teamId: string, userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .is("removed_at", null)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(error.message || "팀 권한을 확인하지 못했습니다.");
  return Boolean(data);
}

async function createNotificationAndPush(teamId: string, threadId: string, senderUserId: string, recipientUserId: string, message: string) {
  const supabase = getSupabaseAdminClient();
  const senderName = await getSenderName(senderUserId);
  const notificationBody = `${senderName}: ${message}`.slice(0, 180);

  const { error } = await supabase.from("notifications").insert({
    user_id: recipientUserId,
    team_id: teamId,
    type: "team_direct_message",
    title: "새 1:1 메시지가 도착했습니다",
    body: notificationBody,
    link_url: `/teams/${teamId}/direct/${threadId}`,
  });

  if (error) throw new Error(error.message || "1:1 메시지 알림을 만들지 못했습니다.");

  if (!isWebPushConfigured()) {
    return { sent: 0, failed: 0, removed: 0, subscriptions: 0, skipped: true };
  }

  return sendPushToUsers([recipientUserId], {
    title: "새 1:1 메시지가 도착했습니다",
    body: `${senderName}님: ${truncateText(message, 50)}`,
    url: `/teams/${teamId}/direct/${threadId}`,
    tag: `team-direct-${threadId}`,
  });
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
