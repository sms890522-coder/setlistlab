"use client";

import { createBlankTeamAssignment } from "@/lib/factories";
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
  const sortedAssignments = sortTeamAssignments(assignments);

  function updateAssignment(id: string, patch: Partial<TeamAssignment>) {
    onChange(assignments.map((assignment) => (assignment.id === id ? { ...assignment, ...patch } : assignment)));
  }

  return (
    <section className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">팀원 파트 배정</h2>
          <p className="field-help">이번 예배의 팀원과 담당 파트를 정리하세요.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...assignments, createBlankTeamAssignment()])}
          className="btn-primary min-h-10 px-3"
        >
          팀원 추가
        </button>
      </div>

      <datalist id="team-part-options">
        {DEFAULT_TEAM_PARTS.map((part) => (
          <option key={part} value={part} />
        ))}
      </datalist>

      {sortedAssignments.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          아직 배정된 팀원이 없습니다.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {sortedAssignments.map((assignment) => (
            <div key={assignment.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_0.8fr_1.4fr_auto]">
              <label className="space-y-1">
                <span className="field-label">이름</span>
                <input
                  value={assignment.name}
                  onChange={(event) => updateAssignment(assignment.id, { name: event.target.value })}
                  className="field-input"
                  placeholder="김OO"
                />
              </label>
              <label className="space-y-1">
                <span className="field-label">파트</span>
                <input
                  value={assignment.part}
                  onChange={(event) => updateAssignment(assignment.id, { part: event.target.value })}
                  className="field-input"
                  placeholder="싱어"
                  list="team-part-options"
                />
              </label>
              <label className="space-y-1">
                <span className="field-label">메모</span>
                <input
                  value={assignment.note ?? ""}
                  onChange={(event) => updateAssignment(assignment.id, { note: event.target.value })}
                  className="field-input"
                  placeholder="필요한 메모"
                />
              </label>
              <div className="flex items-end">
                <button type="button" onClick={() => setDeleteTarget(assignment)} className="btn-danger min-h-10 px-3">
                  삭제
                </button>
              </div>
            </div>
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
