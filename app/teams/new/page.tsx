"use client";

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createTeam } from "@/lib/db/teams";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTeamPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [churchName, setChurchName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentUser()
      .then((user) => setSignedIn(Boolean(user)))
      .finally(() => setLoaded(true));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      setSaving(true);
      const team = await createTeam({ churchName, teamName, description });
      router.push(`/teams/${team.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "팀을 만들지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-bold text-blue-700">새 팀</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">새 팀 만들기</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          팀을 만들면 고유 초대코드가 발급됩니다. 팀원은 이 코드를 입력해 참여 요청을 보낼 수 있고, 리더가 승인하면 팀 채팅과 콘티를 함께 사용할 수 있습니다.
        </p>
      </section>

      {!loaded ? (
        <div className="card p-8 text-sm text-slate-500">팀 만들기 화면을 준비하는 중입니다.</div>
      ) : !isSupabaseConfigured() ? (
        <section className="card p-6">
          <h2 className="text-xl font-black text-slate-950">계정 저장 설정이 필요합니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">팀 기능은 계정 클라우드 저장 설정 후 사용할 수 있습니다.</p>
        </section>
      ) : !signedIn ? (
        <section className="card p-6">
          <h2 className="text-xl font-black text-slate-950">로그인이 필요합니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">로그인 후 팀을 만들 수 있습니다.</p>
          <Link href="/login?redirect=/teams/new" className="btn-primary mt-5">
            로그인
          </Link>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-4 p-5">
          <label className="block space-y-1">
            <span className="field-label">교회 이름</span>
            <input value={churchName} onChange={(event) => setChurchName(event.target.value)} className="field-input" placeholder="은혜교회" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">찬양팀 이름</span>
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} className="field-input" placeholder="주일 2부 찬양팀" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">설명</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="field-input min-h-24 resize-y"
              placeholder="팀 소개나 예배 시간 등을 적어주세요."
            />
          </label>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
            초대코드는 팀을 찾기 위한 고유 코드입니다. 교회 이름이 같아도 초대코드가 다르면 다른 팀으로 구분됩니다.
          </div>
          {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "팀 만드는 중" : "팀 만들기"}
            </button>
            <Link href="/teams" className="btn-secondary">
              취소
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
