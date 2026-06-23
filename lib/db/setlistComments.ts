"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { dispatchPushEvent } from "./pushEvents";
import { getProfile, type Profile } from "./profiles";
import { getTeamMembers, type TeamMembership } from "./teamMemberships";

const MAX_COMMENT_LENGTH = 1000;
const DELETED_COMMENT_TEXT = "삭제된 댓글입니다.";

export type SetlistComment = {
  id: string;
  setlistId: string;
  teamId?: string;
  authorId?: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  author?: Profile | null;
  authorMembership?: TeamMembership | null;
};

export type SetlistCommentInput = {
  setlistId: string;
  content: string;
};

type SetlistCommentRow = {
  id: string;
  setlist_id: string;
  team_id: string | null;
  author_id: string | null;
  content: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

type CommentSetlistRow = {
  id: string;
  user_id: string;
  team_id: string | null;
};

export async function getSetlistComments(setlistId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlist_comments")
    .select("*")
    .eq("setlist_id", setlistId)
    .order("created_at", { ascending: true })
    .returns<SetlistCommentRow[]>();

  if (error) throw new Error(error.message || "댓글을 불러오지 못했습니다.");
  return attachCommentMeta(data ?? []);
}

export async function getSetlistCommentCount(setlistId: string) {
  const supabase = getSupabaseBrowserClient();
  const { count, error } = await supabase
    .from("setlist_comments")
    .select("id", { count: "exact", head: true })
    .eq("setlist_id", setlistId)
    .eq("is_deleted", false);

  if (error) throw new Error(error.message || "댓글 수를 불러오지 못했습니다.");
  return count ?? 0;
}

export async function getSetlistCommentCounts(setlistIds: string[]) {
  const uniqueSetlistIds = Array.from(new Set(setlistIds)).filter(Boolean);
  if (uniqueSetlistIds.length === 0) return new Map<string, number>();

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlist_comments")
    .select("setlist_id")
    .in("setlist_id", uniqueSetlistIds)
    .eq("is_deleted", false)
    .returns<Array<{ setlist_id: string }>>();

  if (error) throw new Error(error.message || "댓글 수를 불러오지 못했습니다.");

  const counts = new Map<string, number>();
  for (const id of uniqueSetlistIds) counts.set(id, 0);
  for (const row of data ?? []) {
    counts.set(row.setlist_id, (counts.get(row.setlist_id) ?? 0) + 1);
  }
  return counts;
}

export async function createSetlistComment(input: SetlistCommentInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const content = normalizeCommentContent(input.content);
  const supabase = getSupabaseBrowserClient();
  const setlist = await getCommentSetlist(input.setlistId);

  const { data, error } = await supabase
    .from("setlist_comments")
    .insert({
      setlist_id: input.setlistId,
      team_id: setlist.team_id,
      author_id: user.id,
      content,
    })
    .select("*")
    .single<SetlistCommentRow>();

  if (error) throw new Error(error.message || "댓글을 등록하지 못했습니다.");

  if (data.team_id) {
    const notified = await createTeamSetlistCommentNotifications(data.id).catch(() => false);
    if (notified) {
      void dispatchPushEvent({ eventType: "team_setlist_comment_created", commentId: data.id });
    }
  }

  const [comment] = await attachCommentMeta([data]);
  return comment;
}

export async function updateSetlistComment(commentId: string, content: string) {
  const normalizedContent = normalizeCommentContent(content);
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlist_comments")
    .update({
      content: normalizedContent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("is_deleted", false)
    .select("*")
    .single<SetlistCommentRow>();

  if (error) throw new Error(error.message || "댓글을 수정하지 못했습니다.");
  const [comment] = await attachCommentMeta([data]);
  return comment;
}

export async function deleteSetlistComment(commentId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlist_comments")
    .update({
      content: DELETED_COMMENT_TEXT,
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("is_deleted", false)
    .select("*")
    .single<SetlistCommentRow>();

  if (error) throw new Error(error.message || "댓글을 삭제하지 못했습니다.");
  const [comment] = await attachCommentMeta([data]);
  return comment;
}

export function subscribeSetlistComments(
  setlistId: string,
  callback: (comment: SetlistComment, event: "INSERT" | "UPDATE" | "DELETE") => void,
  onStatusChange?: (status: string, error?: unknown) => void,
) {
  const supabase = getSupabaseBrowserClient();
  const channel = supabase
    .channel(`setlist-comments:${setlistId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "setlist_comments", filter: `setlist_id=eq.${setlistId}` },
      async (payload) => {
        if (payload.eventType === "DELETE") {
          callback(rowToComment(payload.old as SetlistCommentRow), "DELETE");
          return;
        }

        const [comment] = await attachCommentMeta([payload.new as SetlistCommentRow]);
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

async function getCommentSetlist(setlistId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlists")
    .select("id,user_id,team_id")
    .eq("id", setlistId)
    .maybeSingle<CommentSetlistRow>();

  if (error) throw new Error(error.message || "콘티를 확인하지 못했습니다.");
  if (!data) throw new Error("댓글을 남길 콘티를 찾을 수 없습니다.");
  return data;
}

async function createTeamSetlistCommentNotifications(commentId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("create_team_setlist_comment_notifications", {
    p_comment_id: commentId,
  });

  if (error) throw new Error(error.message || "댓글 알림을 만들지 못했습니다.");
  return Boolean(data);
}

async function attachCommentMeta(rows: SetlistCommentRow[]) {
  const comments = rows.map(rowToComment);
  if (comments.length === 0) return comments;

  const authorIds = Array.from(new Set(comments.map((comment) => comment.authorId).filter(Boolean))) as string[];
  const teamIds = Array.from(new Set(comments.map((comment) => comment.teamId).filter(Boolean))) as string[];
  const [profiles, membershipsByTeam] = await Promise.all([getProfilesById(authorIds), getMembershipsByTeam(teamIds)]);

  return comments.map((comment) => ({
    ...comment,
    author: comment.authorId ? profiles.get(comment.authorId) ?? null : null,
    authorMembership:
      comment.teamId && comment.authorId ? membershipsByTeam.get(comment.teamId)?.get(comment.authorId) ?? null : null,
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

function rowToComment(row: SetlistCommentRow): SetlistComment {
  return {
    id: row.id,
    setlistId: row.setlist_id,
    teamId: row.team_id ?? undefined,
    authorId: row.author_id ?? undefined,
    content: row.is_deleted ? DELETED_COMMENT_TEXT : row.content,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
