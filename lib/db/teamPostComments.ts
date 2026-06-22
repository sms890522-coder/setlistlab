"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { dispatchPushEvent } from "./pushEvents";
import { getProfile, type Profile } from "./profiles";
import { getTeamMembers, type TeamMembership } from "./teamMemberships";

const MAX_COMMENT_LENGTH = 1000;
const DELETED_COMMENT_TEXT = "삭제된 댓글입니다.";

export type TeamPostComment = {
  id: string;
  postId: string;
  teamId: string;
  authorId?: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  author?: Profile | null;
  authorMembership?: TeamMembership | null;
};

export type TeamPostCommentInput = {
  postId: string;
  teamId: string;
  content: string;
};

type TeamPostCommentRow = {
  id: string;
  post_id: string;
  team_id: string;
  author_id: string | null;
  content: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export async function getTeamPostComments(postId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .returns<TeamPostCommentRow[]>();

  if (error) throw new Error(error.message || "댓글을 불러오지 못했습니다.");
  return attachCommentMeta(data ?? []);
}

export async function getTeamPostCommentCount(postId: string) {
  const supabase = getSupabaseBrowserClient();
  const { count, error } = await supabase
    .from("team_post_comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId)
    .eq("is_deleted", false);

  if (error) throw new Error(error.message || "댓글 수를 불러오지 못했습니다.");
  return count ?? 0;
}

export async function createTeamPostComment(input: TeamPostCommentInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const content = normalizeCommentContent(input.content);
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_post_comments")
    .insert({
      post_id: input.postId,
      team_id: input.teamId,
      author_id: user.id,
      content,
    })
    .select("*")
    .single<TeamPostCommentRow>();

  if (error) throw new Error(error.message || "댓글을 등록하지 못했습니다.");

  const notified = await createTeamPostCommentNotifications(data.id).catch(() => false);
  if (notified) {
    void dispatchPushEvent({ eventType: "team_notice_comment_created", commentId: data.id });
  }

  const [comment] = await attachCommentMeta([data]);
  return comment;
}

export async function updateTeamPostComment(commentId: string, content: string) {
  const normalizedContent = normalizeCommentContent(content);
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_post_comments")
    .update({
      content: normalizedContent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("is_deleted", false)
    .select("*")
    .single<TeamPostCommentRow>();

  if (error) throw new Error(error.message || "댓글을 수정하지 못했습니다.");
  const [comment] = await attachCommentMeta([data]);
  return comment;
}

export async function deleteTeamPostComment(commentId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_post_comments")
    .update({
      content: DELETED_COMMENT_TEXT,
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("is_deleted", false)
    .select("*")
    .single<TeamPostCommentRow>();

  if (error) throw new Error(error.message || "댓글을 삭제하지 못했습니다.");
  const [comment] = await attachCommentMeta([data]);
  return comment;
}

export function subscribeTeamPostComments(
  postId: string,
  callback: (comment: TeamPostComment, event: "INSERT" | "UPDATE" | "DELETE") => void,
  onStatusChange?: (status: string, error?: unknown) => void,
) {
  const supabase = getSupabaseBrowserClient();
  const channel = supabase
    .channel(`team-post-comments:${postId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "team_post_comments", filter: `post_id=eq.${postId}` },
      async (payload) => {
        if (payload.eventType === "DELETE") {
          callback(rowToComment(payload.old as TeamPostCommentRow), "DELETE");
          return;
        }

        const [comment] = await attachCommentMeta([payload.new as TeamPostCommentRow]);
        callback(comment, payload.eventType as "INSERT" | "UPDATE");
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

async function createTeamPostCommentNotifications(commentId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("create_team_post_comment_notifications", {
    p_comment_id: commentId,
  });

  if (error) throw new Error(error.message || "댓글 알림을 만들지 못했습니다.");
  return Boolean(data);
}

async function attachCommentMeta(rows: TeamPostCommentRow[]) {
  const comments = rows.map(rowToComment);
  if (comments.length === 0) return comments;

  const authorIds = Array.from(new Set(comments.map((comment) => comment.authorId).filter(Boolean))) as string[];
  const teamIds = Array.from(new Set(comments.map((comment) => comment.teamId)));
  const [profiles, membershipsByTeam] = await Promise.all([getProfilesById(authorIds), getMembershipsByTeam(teamIds)]);

  return comments.map((comment) => ({
    ...comment,
    author: comment.authorId ? profiles.get(comment.authorId) ?? null : null,
    authorMembership: comment.authorId ? membershipsByTeam.get(comment.teamId)?.get(comment.authorId) ?? null : null,
  }));
}

async function getProfilesById(userIds: string[]) {
  const entries = await Promise.all(userIds.map(async (id) => [id, await getProfile(id).catch(() => null)] as const));
  return new Map(entries);
}

async function getMembershipsByTeam(teamIds: string[]) {
  const entries = await Promise.all(
    teamIds.map(async (teamId) => {
      const members = await getTeamMembers(teamId).catch(() => []);
      return [teamId, new Map(members.map((member) => [member.userId, member]))] as const;
    }),
  );
  return new Map(entries);
}

function normalizeCommentContent(value: string) {
  const content = value.trim();
  if (!content) throw new Error("댓글 내용을 입력해 주세요.");
  if (content.length > MAX_COMMENT_LENGTH) throw new Error(`댓글은 ${MAX_COMMENT_LENGTH}자까지 입력할 수 있습니다.`);
  return content;
}

function rowToComment(row: TeamPostCommentRow): TeamPostComment {
  return {
    id: row.id,
    postId: row.post_id,
    teamId: row.team_id,
    authorId: row.author_id ?? undefined,
    content: row.is_deleted ? DELETED_COMMENT_TEXT : row.content,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
