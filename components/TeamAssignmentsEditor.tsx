"use client";

import { createBlankTeamAssignment } from "@/lib/factories";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import { sortTeamAssignments } from "@/lib/teamAssignments";
import { DEFAULT_TEAM_PARTS, type TeamAssignment } from "@/lib/types";
import { useState } from "react";
import { createPortal } from "react-dom";

type TeamAssignmentsEditorProps = {
  assignments: TeamAssignment[];
  onChange: (assignments: TeamAssignment[]) => void;
};

export function TeamAssignmentsEditor({ assignments, onChange }: TeamAssignmentsEditorProps) {
  const [deleteTarget, setDeleteTarget] = useState<TeamAssignment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TeamAssignment>(() => createBlankTeamAssignment());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const sortedAssignments = sortTeamAssignments(assignments);

  function resetForm() {
    setEditingId(null);
    setDraft(createBlankTeamAssignment());
    setError("");
  }

  function selectAssignment(assignment: TeamAssignment) {
    setEditingId(assignment.id);
    setDraft({ ...assignment, part: assignment.part || DEFAULT_TEAM_PARTS[0] });
    setMessage("");
    setError("");
  }

  function saveAssignment() {
    const name = draft.name.trim();
    if (!name) {
      setError("팀원 이름을 입력해 주세요.");
      return;
    }

    const nextAssignment = {
      ...draft,
      name,
      part: draft.part || DEFAULT_TEAM_PARTS[0],
      note: draft.note?.trim() || "",
    };

    if (editingId) {
      onChange(assignments.map((assignment) => (assignment.id === editingId ? nextAssignment : assignment)));
      setMessage(`${nextAssignment.part}: ${nextAssignment.name} 배정을 수정했습니다.`);
    } else {
      onChange([...assignments, nextAssignment]);
      setMessage(`${nextAssignment.part}: ${nextAssignment.name} 배정을 추가했습니다.`);
    }

    resetForm();
  }

  return (
    <section className="card p-5">
      <div>
        <h2 className="section-title">팀원 파트 배정</h2>
        <p className="field-help">한 명씩 추가하고, 아래 배정 버튼을 눌러 수정하세요.</p>
      </div>

      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-blue-800">{editingId ? "팀원 배정 수정" : "팀원 추가"}</p>
          {editingId ? (
            <button type="button" onClick={resetForm} className="text-xs font-bold text-blue-700 hover:text-blue-900">
              추가 모드로
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_0.8fr_1.4fr_auto]">
          <label className="space-y-1">
            <span className="field-label">이름</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              className="field-input"
              placeholder="김OO"
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">파트</span>
            <select
              value={draft.part}
              onChange={(event) => setDraft((current) => ({ ...current, part: event.target.value }))}
              className="field-input"
            >
              {draft.part && !DEFAULT_TEAM_PARTS.includes(draft.part as (typeof DEFAULT_TEAM_PARTS)[number]) ? (
                <option value={draft.part}>{draft.part} · 기존 입력값</option>
              ) : null}
              {DEFAULT_TEAM_PARTS.map((part) => (
                <option key={part} value={part}>
                  {part}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="field-label">메모</span>
            <input
              value={draft.note ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
              className="field-input"
              placeholder="필요한 메모"
            />
          </label>
          <div className="flex items-end gap-2">
            <button type="button" onClick={saveAssignment} className="btn-primary min-h-10 px-4">
              {editingId ? "수정 저장" : "추가"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={() => setDeleteTarget(assignments.find((assignment) => assignment.id === editingId) ?? draft)}
                className="btn-danger min-h-10 px-3"
              >
                삭제
              </button>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {message ? <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      </div>

      {sortedAssignments.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
          아직 배정된 팀원이 없습니다.
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {sortedAssignments.map((assignment) => (
            <button
              key={assignment.id}
              type="button"
              onClick={() => selectAssignment(assignment)}
              title={assignment.note || `${assignment.part} 배정 수정`}
              className={`rounded-lg border px-3 py-2 text-left text-sm font-bold transition ${
                editingId === assignment.id
                  ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
              }`}
            >
              <span className={editingId === assignment.id ? "text-blue-100" : "text-blue-700"}>{assignment.part}</span>
              <span className="mx-1 text-current">:</span>
              <span>{formatMemberNameWithEmoji(assignment.part, assignment.name)}</span>
            </button>
          ))}
        </div>
      )}

      {deleteTarget && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
              role="presentation"
              onClick={() => setDeleteTarget(null)}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={`delete-assignment-${deleteTarget.id}`}
                className="card w-full max-w-md p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-sm font-bold text-rose-600">팀원 배정 삭제</p>
                <h3 id={`delete-assignment-${deleteTarget.id}`} className="mt-2 text-xl font-black text-slate-950">
                  {deleteTarget.name || "이 팀원"}
                </h3>
                <p className="mt-3 text-sm text-slate-600">파트 배정을 삭제할까요?</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary">
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(assignments.filter((assignment) => assignment.id !== deleteTarget.id));
                      if (editingId === deleteTarget.id) {
                        resetForm();
                      }
                      setMessage(`${deleteTarget.part}: ${deleteTarget.name || "이름 미정"} 배정을 삭제했습니다.`);
                      setDeleteTarget(null);
                    }}
                    className="btn-danger"
                  >
                    삭제하기
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
