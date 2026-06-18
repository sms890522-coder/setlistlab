"use client";

import Link from "next/link";
import { TeamDirectChatPanel } from "@/components/TeamDirectChatPanel";
import { getTeamDirectThread, type TeamDirectConversationSummary } from "@/lib/db/teamDirectMessages";
import { getMyRoleInTeam } from "@/lib/db/teamMemberships";
import { getTeam, type Team } from "@/lib/db/teams";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function TeamDirectRoomPage() {
  const params = useParams<{ teamId: string; threadId: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [thread, setThread] = useState<TeamDirectConversationSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRoom() {
      const [nextTeam, membership] = await Promise.all([getTeam(params.teamId), getMyRoleInTeam(params.teamId)]);
      if (!nextTeam) {
        setError("팀을 찾을 수 없습니다.");
        setLoaded(true);
        return;
      }

      if (membership?.status !== "approved") {
        setMessage(membership?.status === "pending" ? "리더 승인 후 1:1 대화를 사용할 수 있습니다." : "이 팀의 1:1 대화에 접근할 권한이 없습니다.");
        setLoaded(true);
        return;
      }

      const nextThread = await getTeamDirectThread(params.threadId);
      if (nextThread.teamId !== params.teamId) {
        setError("이 팀의 1:1 대화방이 아닙니다.");
        setLoaded(true);
        return;
      }

      setTeam(nextTeam);
      setThread(nextThread);
      setLoaded(true);
    }

    loadRoom().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "1:1 대화방을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.teamId, params.threadId]);

  if (!loaded) {
    return <div className="page-shell"><div className="card p-8 text-sm text-slate-500">1:1 대화방을 불러오는 중입니다.</div></div>;
  }

  if (!team || !thread) {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">1:1 대화를 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message || error || "이 1:1 대화에 접근할 권한이 없습니다."}</p>
          <Link href={`/teams/${params.teamId}`} className="btn-primary mt-5">팀으로</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell pb-24">
      <TeamDirectChatPanel team={team} thread={thread} />
    </div>
  );
}
