"use client";

import { TeamRoleBadge } from "@/components/TeamRoleBadge";
import { getCurrentUser } from "@/lib/auth";
import {
  createTeamPostComment,
  deleteTeamPostComment,
  getTeamPostComments,
  subscribeTeamPostComments,
  updateTeamPostComment,
  type TeamPostComment,
} from "@/lib/db/teamPostComments";
import type { TeamMembership } from "@/lib/db/teamMemberships";
import { canManageTeamPost } from "@/lib/permissions/teamPermissions";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import { useEffect, useMemo, useState } from "react";

type TeamPostCommentsProps = {
  postId: string;
  teamId: string;
  membership: TeamMembership;
};

export function TeamPostComments({ postId, teamId, membership }: TeamPostCommentsProps) {
  const [comments, setComments] = useState<TeamPostComment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [realtimeNotice, setRealtimeNotice] = useState("");
  const [error, setError] = useState("");

  const canManageComments = useMemo(() => canManageTeamPost(membership), [membership]);
  const canWrite = membership.status === "approved";
  const visibleCommentCount = comments.filter((comment) => !comment.isDeleted).length;

  useEffect(() => {
    let active = true;

    Promise.all([getCurrentUser(), getTeamPostComments(postId)])
      .then(([user, nextComments]) => {
        if (!active) return;
        setCurrentUserId(user?.id ?? null);
        setComments(nextComments);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "댓글을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [postId]);

  useEffect(() => {
    return subscribeTeamPostComments(
      postId,
      (comment, event) => {
        if (event === "DELETE") {
          setComments((current) => current.filter((item) => item.id !== comment.id));
          return;
        }

        setComments((current) => upsertComment(current, comment));
      },
      () => {
        setRealtimeNotice("실시간 댓글 연결이 잠시 불안정합니다. 댓글 등록 후 목록은 자동으로 갱신됩니다.");
      },
    );
  }, [postId]);

  async function handleCreateComment() {
    if (submitting) return;
    setError("");
    setSubmitting(true);

    try {
      const comment = await createTeamPostComment({ postId, teamId, content });
      setComments((current) => upsertComment(current, comment));
      setContent("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "댓글을 등록하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing(comment: TeamPostComment) {
    setEditingId(comment.id);
    setEditingContent(comment.content);
    setError("");
  }

  async function handleUpdateComment(commentId: string) {
    if (savingEdit) return;
    setError("");
    setSavingEdit(true);

    try {
      const comment = await updateTeamPostComment(commentId, editingContent);
      setComments((current) => upsertComment(current, comment));
      setEditingId(null);
      setEditingContent("");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "댓글을 수정하지 못했습니다.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteComment(comment: TeamPostComment) {
    const isMine = comment.authorId === currentUserId;
    const confirmMessage = isMine ? "댓글을 삭제할까요?" : "이 댓글을 관리자로 삭제할까요?";
    if (!window.confirm(confirmMessage)) return;

    setError("");
    try {
      const deletedComment = await deleteTeamPostComment(comment.id);
      setComments((current) => upsertComment(current, deletedComment));
      if (editingId === comment.id) {
        setEditingId(null);
        setEditingContent("");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "댓글을 삭제하지 못했습니다.");
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black text-slate-950">댓글</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">댓글 {visibleCommentCount}개</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">팀원 전용</span>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">댓글을 불러오는 중입니다.</p>
        ) : comments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
            <p className="font-black text-slate-950">아직 댓글이 없습니다.</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">첫 댓글을 남겨보세요.</p>
          </div>
        ) : (
          comments.map((comment) => {
            const isMine = comment.authorId === currentUserId;
            const canEdit = isMine && !comment.isDeleted;
            const canDelete = !comment.isDeleted && (isMine || canManageComments);
            const role = comment.authorMembership?.role ?? "member";
            const authorName = comment.author?.displayName || comment.authorMembership?.profile?.displayName || "팀원";
            const authorPosition = comment.authorMembership?.position || "팀원";

            return (
              <article
                key={comment.id}
                className={comment.isDeleted ? "rounded-xl border border-slate-100 bg-slate-50 p-4" : "rounded-xl border border-slate-200 bg-white p-4 shadow-sm"}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950">
                        {formatMemberNameWithEmoji(authorPosition, authorName)}
                      </p>
                      <TeamRoleBadge role={role} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatDateTime(comment.createdAt)}
                      {comment.updatedAt !== comment.createdAt && !comment.isDeleted ? " · 수정됨" : ""}
                    </p>
                  </div>

                  {canEdit || canDelete ? (
                    <div className="flex shrink-0 gap-2">
                      {canEdit ? (
                        <button type="button" onClick={() => startEditing(comment)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">
                          수정
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button type="button" onClick={() => handleDeleteComment(comment)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
                          삭제
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {editingId === comment.id ? (
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={editingContent}
                      onChange={(event) => setEditingContent(event.target.value)}
                      maxLength={1000}
                      className="input min-h-28 resize-y"
                      placeholder="댓글을 입력하세요."
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditingContent("");
                        }}
                        className="btn-secondary"
                      >
                        취소
                      </button>
                      <button type="button" onClick={() => handleUpdateComment(comment.id)} disabled={savingEdit} className="btn-primary">
                        {savingEdit ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={comment.isDeleted ? "mt-4 text-sm font-semibold text-slate-400" : "mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700"}>
                    {comment.content}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>

      {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {realtimeNotice ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{realtimeNotice}</p> : null}

      {canWrite ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="field-label" htmlFor="team-post-comment-content">댓글 작성</label>
          <textarea
            id="team-post-comment-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={1000}
            className="input mt-2 min-h-28 resize-y bg-white"
            placeholder="댓글을 입력하세요."
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-500">{content.trim().length}/1000자</p>
            <button type="button" onClick={handleCreateComment} disabled={submitting} className="btn-primary min-h-11 sm:min-w-24">
              {submitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function upsertComment(comments: TeamPostComment[], comment: TeamPostComment) {
  const existingIndex = comments.findIndex((item) => item.id === comment.id);
  if (existingIndex === -1) {
    return [...comments, comment].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  const nextComments = [...comments];
  nextComments[existingIndex] = comment;
  return nextComments;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
