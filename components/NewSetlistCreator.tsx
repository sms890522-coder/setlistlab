"use client";

import Link from "next/link";
import { createBlankSetlist } from "@/lib/factories";
import { getCurrentUser } from "@/lib/auth";
import { getMyProfile } from "@/lib/db/profiles";
import { createCloudSetlist } from "@/lib/db/setlists";
import { getApprovedMemberships, type TeamMembership } from "@/lib/db/teamMemberships";
import { saveSetlist } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

export function NewSetlistCreator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTeamId = searchParams.get("teamId") ?? "";
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("personal");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const approvedTeams = useMemo(() => memberships.filter((membership) => membership.team), [memberships]);

  useEffect(() => {
    async function loadCreateOptions() {
      if (!isSupabaseConfigured()) {
        setLoaded(true);
        return;
      }

      const user = await getCurrentUser();
      setSignedIn(Boolean(user));
      if (!user) {
        setLoaded(true);
        return;
      }

      const profile = await getMyProfile();
      if (!profile) {
        router.replace("/onboarding?redirect=/setlists/new");
        return;
      }

      const nextMemberships = await getApprovedMemberships();
      setMemberships(nextMemberships);
      if (requestedTeamId && nextMemberships.some((membership) => membership.teamId === requestedTeamId)) {
        setTarget(requestedTeamId);
      }
      setLoaded(true);
    }

    loadCreateOptions().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "콘티 생성 화면을 준비하지 못했습니다.");
      setLoaded(true);
    });
  }, [requestedTeamId, router]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      setCreating(true);
      const blankSetlist = {
        ...createBlankSetlist(),
        title,
        teamId: target === "personal" ? undefined : target,
      };

      if (!isSupabaseConfigured() || !signedIn) {
        const setlist = saveSetlist(blankSetlist);
        router.replace(`/setlists/${setlist.id}/edit`);
        return;
      }

      const setlist = await createCloudSetlist(blankSetlist);
      router.replace(`/setlists/${setlist.id}/edit`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "콘티를 만들지 못했습니다.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-shell max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-bold text-blue-700">새 콘티</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">새 콘티 만들기</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          개인 콘티로 시작하거나, 승인된 팀이 있다면 팀 콘티 초안으로 시작할 수 있습니다.
        </p>
      </section>

      {!loaded ? (
        <div className="card p-8 text-sm text-slate-500">새 콘티 화면을 준비하는 중입니다.</div>
      ) : (
        <form onSubmit={handleCreate} className="card space-y-4 p-5">
          <label className="block space-y-1">
            <span className="field-label">콘티 제목</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="field-input" placeholder="이번 주 예배 콘티" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">저장 위치</span>
            <select value={target} onChange={(event) => setTarget(event.target.value)} className="field-input">
              <option value="personal">개인 콘티</option>
              {approvedTeams.map((membership) => (
                <option key={membership.teamId} value={membership.teamId}>
                  {membership.team?.churchName} / {membership.team?.teamName}
                </option>
              ))}
            </select>
          </label>
          {!signedIn ? (
            <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
              로그인 전에는 이 브라우저에 개인 콘티로 임시 저장됩니다.
            </p>
          ) : approvedTeams.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              아직 승인된 팀이 없습니다. 팀 콘티를 만들려면 <Link href="/teams" className="font-black text-blue-700 underline">내 팀</Link>에서 팀을 만들거나 참여해 주세요.
            </p>
          ) : target === "personal" ? (
            <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
              먼저 개인 콘티 초안을 만들고, 편집 화면에서 저장 버튼으로 확정합니다.
            </p>
          ) : (
            <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
              지금은 팀 콘티 초안만 만들어집니다. 편집 화면에서 “팀에 저장”을 누르기 전까지 팀원들에게 알림이 가지 않습니다.
            </p>
          )}
          {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? "만드는 중" : "콘티 초안 만들기"}
            </button>
            <Link href="/setlists" className="btn-secondary">취소</Link>
          </div>
        </form>
      )}
    </div>
  );
}
