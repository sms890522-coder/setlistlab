"use client";

import Link from "next/link";
import { DEFAULT_TEAM_PARTS } from "@/lib/types";
import { getMyProfile } from "@/lib/db/profiles";
import { deleteTeamMember, getTeamMembers, saveTeamMember, type TeamMember } from "@/lib/db/teamMembers";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

export default function TeamPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>(DEFAULT_TEAM_PARTS[1]);
  const [memo, setMemo] = useState("");
  const [profileRole, setProfileRole] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const groupedMembers = useMemo(() => {
    return members.reduce<Record<string, TeamMember[]>>((acc, member) => {
      acc[member.role] = [...(acc[member.role] ?? []), member];
      return acc;
    }, {});
  }, [members]);

  useEffect(() => {
    async function loadTeam() {
      if (!isSupabaseConfigured()) {
        setLoaded(true);
        return;
      }

      const [profile, nextMembers] = await Promise.all([getMyProfile(), getTeamMembers()]);
      if (!profile) {
        router.replace("/onboarding?redirect=/team");
        return;
      }
      setProfileRole(profile.role);
      setMembers(nextMembers);
      setLoaded(true);
    }

    loadTeam().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "팀원 목록을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [router]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setRole(DEFAULT_TEAM_PARTS[1]);
    setMemo("");
  }

  function selectMember(member: TeamMember) {
    setEditingId(member.id);
    setName(member.name);
    setRole(member.role);
    setMemo(member.memo ?? "");
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!name.trim()) {
      setError("팀원 이름을 입력해 주세요.");
      return;
    }

    try {
      const saved = await saveTeamMember({ id: editingId ?? undefined, name, role, memo });
      setMembers((current) => {
        const exists = current.some((member) => member.id === saved.id);
        return exists ? current.map((member) => (member.id === saved.id ? saved : member)) : [...current, saved];
      });
      setMessage(`${saved.role}: ${saved.name} 팀원을 저장했습니다.`);
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "팀원을 저장하지 못했습니다.");
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    const target = members.find((member) => member.id === editingId);
    if (!target || !window.confirm(`${target.name} 팀원을 삭제할까요?`)) return;

    try {
      await deleteTeamMember(editingId);
      setMembers((current) => current.filter((member) => member.id !== editingId));
      setMessage(`${target.name} 팀원을 삭제했습니다.`);
      resetForm();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "팀원을 삭제하지 못했습니다.");
    }
  }

  return (
    <div className="page-shell space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">Team</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">팀원 관리</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            자주 섬기는 팀원을 저장해두면 콘티 수정 화면에서 이번 주 팀원으로 바로 불러올 수 있습니다.
          </p>
        </div>
        <Link href="/setlists" className="btn-secondary">
          콘티 목록
        </Link>
      </section>

      {!loaded ? (
        <div className="card p-8 text-sm text-slate-500">팀원 목록을 불러오는 중입니다.</div>
      ) : !isSupabaseConfigured() ? (
        <section className="card p-6">
          <h2 className="text-xl font-black text-slate-950">로그인 저장 설정이 필요합니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">팀원 관리는 Supabase 로그인 저장을 켠 뒤 사용할 수 있습니다.</p>
        </section>
      ) : (
        <>
          {profileRole && profileRole !== "찬양인도자" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              현재 역할은 {profileRole}입니다. MVP에서는 강하게 막지 않지만, 보통 찬양인도자가 팀원 목록을 관리합니다.
            </div>
          ) : null}

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{editingId ? "팀원 수정" : "팀원 추가"}</h2>
                <p className="field-help">입력 블럭 하나로 추가하고, 아래 버튼을 눌러 수정합니다.</p>
              </div>
              {editingId ? (
                <button type="button" onClick={resetForm} className="btn-secondary min-h-10 px-3">
                  추가 모드
                </button>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-[1fr_0.8fr_1.4fr_auto]">
              <label className="space-y-1">
                <span className="field-label">이름</span>
                <input value={name} onChange={(event) => setName(event.target.value)} className="field-input" placeholder="김OO" />
              </label>
              <label className="space-y-1">
                <span className="field-label">파트</span>
                <select value={role} onChange={(event) => setRole(event.target.value)} className="field-input">
                  {role && !DEFAULT_TEAM_PARTS.includes(role as (typeof DEFAULT_TEAM_PARTS)[number]) ? (
                    <option value={role}>{role} · 기존 입력값</option>
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
                <input value={memo} onChange={(event) => setMemo(event.target.value)} className="field-input" placeholder="이번 달 섬김 가능" />
              </label>
              <div className="flex items-end gap-2">
                <button type="submit" className="btn-primary min-h-10 px-4">
                  {editingId ? "수정 저장" : "추가"}
                </button>
                {editingId ? (
                  <button type="button" onClick={handleDelete} className="btn-danger min-h-10 px-3">
                    삭제
                  </button>
                ) : null}
              </div>
            </form>

            {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
            {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          </section>

          <section className="card p-5">
            <h2 className="section-title">저장된 팀원</h2>
            {members.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                아직 저장된 팀원이 없습니다.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {Object.entries(groupedMembers).map(([part, partMembers]) => (
                  <div key={part}>
                    <p className="text-xs font-black uppercase text-slate-400">{part}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {partMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => selectMember(member)}
                          className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                            editingId === member.id
                              ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                          }`}
                        >
                          {member.role}: {member.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
