"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { dispatchPushEvent } from "./pushEvents";
import { getProfile, type Profile } from "./profiles";
import { getTeamMembers, type TeamMembership } from "./teamMemberships";

export type TeamPostType = "notice" | "free" | "rehearsal" | "resource";

export type TeamPost = {
  id: string;
  teamId: string;
  authorId?: string;
  type: TeamPostType;
  title: string;
  content: string;
  isPinned: boolean;
  notifyMembers: boolean;
  createdAt: string;
  updatedAt: string;
  author?: Profile | null;
  readAt?: string;
  hasRead: boolean;
};

export type TeamPostRead = {
  id: string;
  postId: string;
  userId: string;
  readAt: string;
};

export type TeamPostInput = {
  teamId: string;
  type: TeamPostType;
  title: string;
  content: string;
  isPinned: boolean;
  notifyMembers: boolean;
};

export type TeamPostUpdateInput = Omit<TeamPostInput, "teamId"> & {
  notifyOnUpdate?: boolean;
};

export type TeamPostReadStatus = {
  totalCount: number;
  readCount: number;
  unreadCount: number;
  readMembers: Array<{ membership: TeamMembership; readAt: string }>;
  unreadMembers: TeamMembership[];
};

type TeamPostRow = {
  id: string;
  team_id: string;
  author_id: string | null;
  type: TeamPostType;
  title: string;
  content: string;
  is_pinned: boolean;
  notify_members: boolean;
  created_at: string;
  updated_at: string;
};

type TeamPostReadRow = {
  id: string;
  post_id: string;
  user_id: string;
  read_at: string;
};

export const TEAM_POST_TYPE_LABELS: Record<TeamPostType, string> = {
  notice: "공지",
  rehearsal: "연습 안내",
  resource: "자료 공유",
  free: "자유글",
};

export async function getTeamPosts(teamId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_posts")
    .select("*")
    .eq("team_id", teamId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<TeamPostRow[]>();

  if (error) throw new Error(error.message || "팀 공지사항을 불러오지 못했습니다.");

  return attachPostMeta(data ?? []);
}

export async function getTeamPost(postId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("team_posts").select("*").eq("id", postId).maybeSingle<TeamPostRow>();

  if (error) throw new Error(error.message || "공지사항을 불러오지 못했습니다.");
  if (!data) return null;

  const [post] = await attachPostMeta([data]);
  return post ?? null;
}

export async function createTeamPost(input: TeamPostInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const payload = normalizePostInput(input);
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_posts")
    .insert({
      team_id: payload.teamId,
      author_id: user.id,
      type: payload.type,
      title: payload.title,
      content: payload.content,
      is_pinned: payload.isPinned,
      notify_members: payload.notifyMembers,
    })
    .select("*")
    .single<TeamPostRow>();

  if (error) throw new Error(error.message || "공지사항을 등록하지 못했습니다.");

  if (data.notify_members) {
    const notified = await createTeamPostNotifications(data.id, "team_notice_created").catch(() => false);
    if (notified) {
      void dispatchPushEvent({ eventType: "team_notice_created", postId: data.id });
    }
  }

  const [post] = await attachPostMeta([data]);
  return post;
}

export async function updateTeamPost(postId: string, input: TeamPostUpdateInput) {
  const payload = normalizePostInput({ ...input, teamId: "team" });
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_posts")
    .update({
      type: payload.type,
      title: payload.title,
      content: payload.content,
      is_pinned: payload.isPinned,
      notify_members: payload.notifyMembers,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select("*")
    .single<TeamPostRow>();

  if (error) throw new Error(error.message || "공지사항을 수정하지 못했습니다.");

  if (input.notifyOnUpdate) {
    const notified = await createTeamPostNotifications(data.id, "team_notice_updated").catch(() => false);
    if (notified) {
      void dispatchPushEvent({ eventType: "team_notice_updated", postId: data.id });
    }
  }

  const [post] = await attachPostMeta([data]);
  return post;
}

export async function deleteTeamPost(postId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("team_posts").delete().eq("id", postId);

  if (error) throw new Error(error.message || "공지사항을 삭제하지 못했습니다.");
}

export async function markTeamPostRead(postId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_post_reads")
    .upsert(
      {
        post_id: postId,
        user_id: user.id,
        read_at: new Date().toISOString(),
      },
      { onConflict: "post_id,user_id" },
    )
    .select("*")
    .single<TeamPostReadRow>();

  if (error) throw new Error(error.message || "공지사항 읽음 처리를 하지 못했습니다.");
  return rowToRead(data);
}

export async function getTeamPostReadStatus(postId: string): Promise<TeamPostReadStatus> {
  const post = await getTeamPost(postId);
  if (!post) throw new Error("공지사항을 찾을 수 없습니다.");

  const [members, reads] = await Promise.all([getTeamMembers(post.teamId), getPostReads(postId)]);
  const readByUserId = new Map(reads.map((read) => [read.userId, read.readAt]));
  const readMembers = members
    .filter((member) => readByUserId.has(member.userId))
    .map((membership) => ({ membership, readAt: readByUserId.get(membership.userId)! }));
  const unreadMembers = members.filter((member) => !readByUserId.has(member.userId));

  return {
    totalCount: members.length,
    readCount: readMembers.length,
    unreadCount: unreadMembers.length,
    readMembers,
    unreadMembers,
  };
}

export function subscribeTeamPosts(
  teamId: string,
  callback: (post: TeamPost, event: "INSERT" | "UPDATE" | "DELETE") => void,
  onStatusChange?: (status: string, error?: unknown) => void,
) {
  const supabase = getSupabaseBrowserClient();
  const channel = supabase
    .channel(`team-posts:${teamId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "team_posts", filter: `team_id=eq.${teamId}` },
      async (payload) => {
        if (payload.eventType === "DELETE") {
          callback(createDeletedPostPlaceholder(teamId, payload.old as Partial<TeamPostRow>), "DELETE");
          return;
        }

        const [post] = await attachPostMeta([payload.new as TeamPostRow]);
        callback(post, payload.eventType as "INSERT" | "UPDATE");
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
}

async function attachPostMeta(rows: TeamPostRow[]) {
  const posts = rows.map(rowToPost);
  if (posts.length === 0) return posts;

  const [reads, authors] = await Promise.all([getMyPostReads(posts.map((post) => post.id)), getAuthors(posts)]);
  const readByPostId = new Map(reads.map((read) => [read.postId, read.readAt]));

  return posts.map((post) => ({
    ...post,
    author: post.authorId ? authors.get(post.authorId) ?? null : null,
    readAt: readByPostId.get(post.id),
    hasRead: readByPostId.has(post.id),
  }));
}

async function getMyPostReads(postIds: string[]) {
  const user = await getCurrentUser();
  if (!user || postIds.length === 0) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_post_reads")
    .select("*")
    .eq("user_id", user.id)
    .in("post_id", postIds)
    .returns<TeamPostReadRow[]>();

  if (error) return [];
  return (data ?? []).map(rowToRead);
}

async function getPostReads(postId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("team_post_reads").select("*").eq("post_id", postId).returns<TeamPostReadRow[]>();

  if (error) throw new Error(error.message || "읽음 현황을 불러오지 못했습니다.");
  return (data ?? []).map(rowToRead);
}

async function getAuthors(posts: TeamPost[]) {
  const authorIds = Array.from(new Set(posts.map((post) => post.authorId).filter(Boolean))) as string[];
  const entries = await Promise.all(authorIds.map(async (id) => [id, await getProfile(id).catch(() => null)] as const));
  return new Map(entries);
}

async function createTeamPostNotifications(postId: string, eventType: "team_notice_created" | "team_notice_updated") {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("create_team_post_notifications", {
    p_post_id: postId,
    p_event_type: eventType,
  });

  if (error) throw new Error(error.message || "공지 알림을 만들지 못했습니다.");
  return Boolean(data);
}

function normalizePostInput(input: TeamPostInput) {
  const title = input.title.trim();
  const content = input.content.trim();

  if (!title) throw new Error("공지 제목을 입력해 주세요.");
  if (!content) throw new Error("공지 내용을 입력해 주세요.");

  return {
    ...input,
    title,
    content,
    type: input.type || "notice",
  };
}

function rowToPost(row: TeamPostRow): TeamPost {
  return {
    id: row.id,
    teamId: row.team_id,
    authorId: row.author_id ?? undefined,
    type: row.type,
    title: row.title,
    content: row.content,
    isPinned: row.is_pinned,
    notifyMembers: row.notify_members,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasRead: false,
  };
}

function createDeletedPostPlaceholder(teamId: string, row: Partial<TeamPostRow>): TeamPost {
  const now = new Date().toISOString();
  return {
    id: row.id ?? "",
    teamId,
    authorId: undefined,
    type: "notice",
    title: "",
    content: "",
    isPinned: false,
    notifyMembers: false,
    createdAt: row.created_at ?? now,
    updatedAt: row.updated_at ?? now,
    hasRead: false,
  };
}

function rowToRead(row: TeamPostReadRow): TeamPostRead {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    readAt: row.read_at,
  };
}
