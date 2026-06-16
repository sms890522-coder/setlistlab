import { isWebPushConfigured, sendPushToUsers, type PushPayload } from "@/lib/server/push";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type PushEventType = "team_chat_message" | "team_setlist_created" | "team_invite_requested" | "team_invite_approved";

type PushEventRequest = {
  eventType?: PushEventType;
  messageId?: string;
  setlistId?: string;
  membershipId?: string;
};

type TeamChatMessageRow = {
  id: string;
  team_id: string;
  user_id: string;
  message: string;
};

type SetlistRow = {
  id: string;
  team_id: string | null;
  user_id: string;
  title: string;
  worship_date: string | null;
};

type MembershipRow = {
  id: string;
  team_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  position: string | null;
  status: "pending" | "approved" | "rejected" | "removed";
  removed_at: string | null;
};

type TeamRow = {
  id: string;
  church_name: string;
  team_name: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

export async function POST(request: Request) {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ sent: 0, failed: 0, removed: 0, skipped: true });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: PushEventRequest;
  try {
    body = (await request.json()) as PushEventRequest;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
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

    const event = await buildPushEvent(body, user.id);
    if (!event) {
      return NextResponse.json({ sent: 0, failed: 0, removed: 0, skipped: true });
    }

    const result = await sendPushToUsers(event.userIds, event.payload);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "푸시 알림을 보내지 못했습니다.";
    const status = message.includes("권한") || message.includes("본인이") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function buildPushEvent(body: PushEventRequest, actorUserId: string) {
  switch (body.eventType) {
    case "team_chat_message":
      return buildChatMessagePush(body.messageId, actorUserId);
    case "team_setlist_created":
      return buildSetlistCreatedPush(body.setlistId, actorUserId);
    case "team_invite_requested":
      return buildInviteRequestedPush(body.membershipId, actorUserId);
    case "team_invite_approved":
      return buildInviteApprovedPush(body.membershipId, actorUserId);
    default:
      return null;
  }
}

async function buildChatMessagePush(messageId: string | undefined, actorUserId: string) {
  if (!messageId) throw new Error("채팅 메시지 정보가 필요합니다.");

  const supabase = getSupabaseAdminClient();
  const { data: message, error } = await supabase
    .from("team_chat_messages")
    .select("id,team_id,user_id,message")
    .eq("id", messageId)
    .maybeSingle<TeamChatMessageRow>();

  if (error || !message) throw new Error(error?.message || "채팅 메시지를 찾을 수 없습니다.");
  if (message.user_id !== actorUserId) throw new Error("본인이 보낸 채팅만 푸시 알림을 만들 수 있습니다.");

  const userIds = await getApprovedMemberIds(message.team_id, actorUserId);
  const senderName = await getDisplayName(actorUserId);

  return {
    userIds,
    payload: {
      title: "새 팀 채팅이 도착했습니다",
      body: `${senderName}님: ${truncateText(message.message, 50)}`,
      url: `/teams/${message.team_id}/chat`,
      tag: `team-chat-${message.team_id}`,
    } satisfies PushPayload,
  };
}

async function buildSetlistCreatedPush(setlistId: string | undefined, actorUserId: string) {
  if (!setlistId) throw new Error("콘티 정보가 필요합니다.");

  const supabase = getSupabaseAdminClient();
  const { data: setlist, error } = await supabase
    .from("setlists")
    .select("id,team_id,user_id,title,worship_date")
    .eq("id", setlistId)
    .maybeSingle<SetlistRow>();

  if (error || !setlist) throw new Error(error?.message || "콘티를 찾을 수 없습니다.");
  if (!setlist.team_id) return null;

  const canSend = setlist.user_id === actorUserId || (await isTeamAdmin(setlist.team_id, actorUserId));
  if (!canSend) throw new Error("이 팀 콘티 알림을 보낼 권한이 없습니다.");

  const body = [setlist.title || "제목 없는 콘티", setlist.worship_date].filter(Boolean).join(" · ");
  return {
    userIds: await getApprovedMemberIds(setlist.team_id, actorUserId),
    payload: {
      title: "새 팀 콘티가 공유되었습니다",
      body,
      url: `/setlists/${setlist.id}`,
      tag: `team-setlist-${setlist.id}`,
    } satisfies PushPayload,
  };
}

async function buildInviteRequestedPush(membershipId: string | undefined, actorUserId: string) {
  const membership = await getMembershipForEvent(membershipId);
  if (membership.user_id !== actorUserId) throw new Error("본인의 참여 요청만 푸시 알림을 만들 수 있습니다.");
  if (membership.status !== "pending") return null;

  const requesterName = await getDisplayName(actorUserId);
  return {
    userIds: await getAdminMemberIds(membership.team_id, actorUserId),
    payload: {
      title: "새 팀 참여 요청이 있습니다",
      body: `${requesterName}님이 팀 참여를 요청했습니다.`,
      url: `/teams/${membership.team_id}`,
      tag: `team-invite-request-${membership.team_id}`,
    } satisfies PushPayload,
  };
}

async function buildInviteApprovedPush(membershipId: string | undefined, actorUserId: string) {
  const membership = await getMembershipForEvent(membershipId);
  if (!(await isTeamAdmin(membership.team_id, actorUserId))) {
    throw new Error("팀 참여 승인 알림을 보낼 권한이 없습니다.");
  }
  if (membership.status !== "approved") return null;

  const team = await getTeam(membership.team_id);
  return {
    userIds: [membership.user_id].filter((userId) => userId !== actorUserId),
    payload: {
      title: "팀 참여가 승인되었습니다",
      body: `${team?.church_name ?? "팀"} · ${team?.team_name ?? "찬양팀"}에 참여할 수 있습니다.`,
      url: `/teams/${membership.team_id}`,
      tag: `team-invite-approved-${membership.id}`,
    } satisfies PushPayload,
  };
}

async function getMembershipForEvent(membershipId: string | undefined) {
  if (!membershipId) throw new Error("팀 참여 정보가 필요합니다.");

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .select("id,team_id,user_id,role,position,status,removed_at")
    .eq("id", membershipId)
    .maybeSingle<MembershipRow>();

  if (error || !data) throw new Error(error?.message || "팀 참여 정보를 찾을 수 없습니다.");
  return data;
}

async function getApprovedMemberIds(teamId: string, excludeUserId?: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("status", "approved")
    .is("removed_at", null)
    .returns<Array<{ user_id: string }>>();

  if (error) throw new Error(error.message || "팀원 정보를 불러오지 못했습니다.");
  return (data ?? []).map((row) => row.user_id).filter((userId) => userId !== excludeUserId);
}

async function getAdminMemberIds(teamId: string, excludeUserId?: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("status", "approved")
    .in("role", ["owner", "admin"])
    .is("removed_at", null)
    .returns<Array<{ user_id: string }>>();

  if (error) throw new Error(error.message || "팀 리더 정보를 불러오지 못했습니다.");
  return (data ?? []).map((row) => row.user_id).filter((userId) => userId !== excludeUserId);
}

async function isTeamAdmin(teamId: string, userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .in("role", ["owner", "admin"])
    .is("removed_at", null)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(error.message || "팀 권한을 확인하지 못했습니다.");
  return Boolean(data);
}

async function getTeam(teamId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase.from("teams").select("id,church_name,team_name").eq("id", teamId).maybeSingle<TeamRow>();
  return data ?? null;
}

async function getDisplayName(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase.from("profiles").select("id,display_name").eq("id", userId).maybeSingle<ProfileRow>();
  return data?.display_name?.trim() || "팀원";
}

function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}
