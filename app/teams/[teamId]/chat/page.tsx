"use client";

import Link from "next/link";
import { TeamChatPanel } from "@/components/TeamChatPanel";
import { getMyRoleInTeam } from "@/lib/db/teamMemberships";
import { getTeam, type Team } from "@/lib/db/teams";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function TeamChatPage() {
  const params = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadChat() {
      const [nextTeam, membership] = await Promise.all([getTeam(params.teamId), getMyRoleInTeam(params.teamId)]);
      if (!nextTeam) {
        setError("팀을 찾을 수 없습니다.");
        setLoaded(true);
        return;
      }

      if (membership?.status !== "approved") {
        setMessage(membership?.status === "pending" ? "리더 승인 후 채팅을 사용할 수 있습니다." : "이 팀 채팅에 접근할 권한이 없습니다.");
        setLoaded(true);
        return;
      }

      setTeam(nextTeam);
      setLoaded(true);
    }

    loadChat().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "팀 채팅을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.teamId]);

  if (!loaded) {
    return <div className="page-shell"><div className="card p-8 text-sm text-slate-500">팀 채팅을 불러오는 중입니다.</div></div>;
  }

  if (!team) {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">팀 채팅을 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message || error || "승인된 팀원만 팀 채팅에 접근할 수 있습니다."}</p>
          <Link href="/teams" className="btn-primary mt-5">내 팀으로</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/teams/${team.id}`} className="btn-secondary min-h-10 px-3">팀으로</Link>
      </div>
      <TeamChatPanel team={team} />
    </div>
  );
}
