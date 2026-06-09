"use client";

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getMyMemberships, type TeamMembership } from "@/lib/db/teamMemberships";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function TeamsPage() {
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTeams() {
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

      setMemberships(await getMyMemberships());
      setLoaded(true);
    }

    loadTeams().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "팀 목록을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, []);

  return (
    <div className="page-shell space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">내 팀</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">내 팀</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            팀은 고유 초대코드와 승인된 멤버십으로 구분됩니다. 교회 이름이 같아도 초대코드가 다르면 다른 팀입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/teams/new" className="btn-primary">
            새 팀 만들기
          </Link>
          <Link href="/teams/join" className="btn-secondary">
            초대코드로 참여
          </Link>
        </div>
      </section>

      {!loaded ? (
        <div className="card p-8 text-sm text-slate-500">팀 목록을 불러오는 중입니다.</div>
      ) : !isSupabaseConfigured() ? (
        <section className="card p-6">
          <h2 className="text-xl font-black text-slate-950">계정 저장 설정이 필요합니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">팀 기능은 로그인과 계정 클라우드 저장을 켠 뒤 사용할 수 있습니다.</p>
        </section>
      ) : !signedIn ? (
        <section className="card p-6">
          <h2 className="text-xl font-black text-slate-950">로그인이 필요합니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">로그인하면 팀을 만들거나 초대코드로 참여 요청을 보낼 수 있습니다.</p>
          <Link href="/login?redirect=/teams" className="btn-primary mt-5">
            로그인
          </Link>
        </section>
      ) : memberships.length === 0 ? (
        <section className="card p-8 text-center">
          <h2 className="text-xl font-black text-slate-950">아직 소속된 팀이 없습니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">팀을 만들거나 초대코드로 참여해 보세요.</p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/teams/new" className="btn-primary">
              새 팀 만들기
            </Link>
            <Link href="/teams/join" className="btn-secondary">
              초대코드로 참여
            </Link>
          </div>
        </section>
      ) : (
        <div className="grid gap-4">
          {memberships.map((membership) => (
            <article key={membership.id} className="card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-blue-700">{membership.team?.churchName || "교회 이름 없음"}</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">{membership.team?.teamName || "찬양팀 이름 없음"}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    내 역할 {roleLabel(membership.role)} · 포지션 {membership.position || "-"} · 상태 {statusLabel(membership.status)}
                  </p>
                </div>
                {membership.status === "approved" ? (
                  <Link href={`/teams/${membership.teamId}`} className="btn-primary">
                    팀으로 이동
                  </Link>
                ) : (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700">
                    {statusLabel(membership.status)}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "owner") return "리더";
  if (role === "admin") return "관리자";
  return "팀원";
}

function statusLabel(status: string) {
  if (status === "approved") return "승인됨";
  if (status === "pending") return "승인 대기";
  if (status === "rejected") return "거절됨";
  if (status === "removed") return "나간 팀";
  return status;
}
