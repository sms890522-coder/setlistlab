"use client";

import { TEAM_POST_TYPE_LABELS, type TeamPost, type TeamPostType } from "@/lib/db/teamPosts";
import { FormEvent, useState } from "react";

type TeamPostFormProps = {
  initialPost?: TeamPost;
  mode: "create" | "edit";
  submitting?: boolean;
  onSubmit: (input: {
    title: string;
    content: string;
    type: TeamPostType;
    isPinned: boolean;
    notifyMembers: boolean;
    notifyOnUpdate?: boolean;
  }) => void | Promise<void>;
};

const POST_TYPES: TeamPostType[] = ["notice", "rehearsal", "resource", "free"];

export function TeamPostForm({ initialPost, mode, submitting = false, onSubmit }: TeamPostFormProps) {
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [content, setContent] = useState(initialPost?.content ?? "");
  const [type, setType] = useState<TeamPostType>(initialPost?.type ?? "notice");
  const [isPinned, setIsPinned] = useState(initialPost?.isPinned ?? false);
  const [notifyMembers, setNotifyMembers] = useState(initialPost?.notifyMembers ?? true);
  const [notifyOnUpdate, setNotifyOnUpdate] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ title, content, type, isPinned, notifyMembers, notifyOnUpdate });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-5">
      <div className="space-y-2">
        <h2 className="section-title">{mode === "create" ? "공지 작성" : "공지 수정"}</h2>
        <p className="field-help">
          공지로 등록하면 팀원들이 확인할 수 있고, 필요하면 알림을 보낼 수 있습니다.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="field-label">제목</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="field-input"
          placeholder="이번 주 토요일 연습 안내"
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="field-label">내용</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="field-input min-h-56 resize-y leading-7"
          placeholder="연습 시간, 준비할 곡, 확인할 내용을 적어주세요."
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="field-label">유형</span>
          <select value={type} onChange={(event) => setType(event.target.value as TeamPostType)} className="field-input">
            {POST_TYPES.map((postType) => (
              <option key={postType} value={postType}>
                {TEAM_POST_TYPE_LABELS[postType]}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(event) => setIsPinned(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            상단에 고정
          </label>
          {mode === "create" ? (
            <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={notifyMembers}
                onChange={(event) => setNotifyMembers(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              팀원들에게 알림 보내기
            </label>
          ) : (
            <>
              <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={notifyMembers}
                  onChange={(event) => setNotifyMembers(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                목록에 알림 전송 표시 유지
              </label>
              <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={notifyOnUpdate}
                  onChange={(event) => setNotifyOnUpdate(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                수정사항을 팀원에게 알리기
              </label>
            </>
          )}
        </div>
      </div>

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "저장 중" : mode === "create" ? "공지 등록" : "수정 저장"}
      </button>
    </form>
  );
}
