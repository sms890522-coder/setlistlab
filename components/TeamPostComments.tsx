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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-violet-50 px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-blue-700">공지 의견</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">댓글</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              공지 확인, 질문, 추가 안내를 팀원들과 함께 남겨보세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">
              댓글 {visibleCommentCount}개
            </span>
            <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white">팀원 전용</span>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-6 lg:p-7">
        {canWrite ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
            <label className="text-sm font-black text-slate-950" htmlFor={`team-post-comment-content-${postId}`}>
              새 댓글 작성
            </label>
            <textarea
              id={`team-post-comment-content-${postId}`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={1000}
              className="field-input mt-3 min-h-32 resize-y bg-white text-[15px] leading-7 shadow-sm sm:min-h-36"
              placeholder="예: 확인했습니다. 연습 시간은 7시 맞나요?"
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-slate-500">{content.trim().length}/1000자</p>
              <button type="button" onClick={handleCreateComment} disabled={submitting || !content.trim()} className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-28">
                {submitting ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {realtimeNotice ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{realtimeNotice}</p> : null}

        <div className="space-y-3">
        {loading ? (
          <p className="rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">댓글을 불러오는 중입니다.</p>
        ) : comments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <p className="text-lg font-black text-slate-950">아직 댓글이 없습니다.</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">공지 확인 메시지나 질문을 첫 댓글로 남겨보세요.</p>
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
                className={
                  comment.isDeleted
                    ? "rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5"
                    : isMine
                      ? "rounded-2xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm sm:p-5"
                      : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                }
              >
                <div className="flex gap-3">
                  <div
                    className={
                      comment.isDeleted
                        ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-black text-slate-500"
                        : isMine
                          ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white"
                          : "flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white"
                    }
                    aria-hidden="true"
                  >
                    {getAuthorInitial(authorName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-slate-950">
                            {formatMemberNameWithEmoji(authorPosition, authorName)}
                          </p>
                          <TeamRoleBadge role={role} />
                          {isMine && !comment.isDeleted ? (
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-blue-700 ring-1 ring-blue-100">
                              내 댓글
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatDateTime(comment.createdAt)}
                          {comment.updatedAt !== comment.createdAt && !comment.isDeleted ? " · 수정됨" : ""}
                        </p>
                      </div>

                      {canEdit || canDelete ? (
                        <div className="flex shrink-0 gap-2 self-start">
                          {canEdit ? (
                            <button type="button" onClick={() => startEditing(comment)} className="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
                              수정
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button type="button" onClick={() => handleDeleteComment(comment)} className="rounded-lg bg-white px-3 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-50">
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
                          className="field-input min-h-32 resize-y bg-white text-[15px] leading-7"
                          placeholder="공지에 대한 댓글을 입력하세요."
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
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
                          <button type="button" onClick={() => handleUpdateComment(comment.id)} disabled={savingEdit || !editingContent.trim()} className="btn-primary">
                            {savingEdit ? "저장 중..." : "저장"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={comment.isDeleted ? "mt-4 text-sm font-semibold text-slate-400" : "mt-4 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-700"}>
                        {comment.content}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
        </div>
      </div>
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

function getAuthorInitial(name: string) {
  const trimmedName = name.trim();
  return trimmedName ? trimmedName.slice(0, 1) : "팀";
}
