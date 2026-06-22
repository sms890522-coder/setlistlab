"use client";

import Link from "next/link";
import { TeamNavTabs } from "@/components/TeamNavTabs";
import { getCurrentUser } from "@/lib/auth";
import {
  getOrCreateTeamDirectThread,
  getTeamDirectThreads,
  subscribeTeamDirectThreads,
  type TeamDirectConversationSummary,
} from "@/lib/db/teamDirectMessages";
import { getMyRoleInTeam, getTeamMembers, type TeamMembership } from "@/lib/db/teamMemberships";
import { getTeam, type Team } from "@/lib/db/teams";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function TeamDirectListPage() {
  const params = useParams<{ teamId: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMembership[]>([]);
  const [threads, setThreads] = useState<TeamDirectConversationSummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [startingUserId, setStartingUserId] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectableMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return members
      .filter((member) => member.userId !== currentUserId)
      .filter((member) => {
        if (!normalizedQuery) return true;
        const name = member.profile?.displayName ?? "";
        const position = member.position ?? "";
        return `${name} ${position}`.toLowerCase().includes(normalizedQuery);
      });
  }, [currentUserId, members, query]);

  useEffect(() => {
    loadPage().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "1:1 대화 목록을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.teamId]);

  useEffect(() => {
    if (!team) return;

    const unsubscribe = subscribeTeamDirectThreads(team.id, () => {
      getTeamDirectThreads(team.id)
        .then(setThreads)
        .catch(() => undefined);
    });

    return () => {
      unsubscribe();
    };
  }, [team]);

  async function loadPage() {
    const [nextTeam, membership, user] = await Promise.all([getTeam(params.teamId), getMyRoleInTeam(params.teamId), getCurrentUser()]);
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

    const [nextMembers, nextThreads] = await Promise.all([getTeamMembers(params.teamId), getTeamDirectThreads(params.teamId)]);
    setTeam(nextTeam);
    setMembers(nextMembers);
    setThreads(nextThreads);
    setCurrentUserId(user?.id ?? "");
    setLoaded(true);
  }

  async function startDirectMessage(otherUserId: string) {
    if (!team) return;

    try {
      setStartingUserId(otherUserId);
      setError("");
      const thread = await getOrCreateTeamDirectThread(team.id, otherUserId);
      router.push(`/teams/${team.id}/direct/${thread.id}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "1:1 대화를 시작하지 못했습니다.");
    } finally {
      setStartingUserId("");
    }
  }

  if (!loaded) {
    return <div className="page-shell"><div className="card p-8 text-sm text-slate-500">1:1 대화 목록을 불러오는 중입니다.</div></div>;
  }

  if (!team) {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">1:1 대화를 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message || error || "승인된 팀원만 1:1 대화에 접근할 수 있습니다."}</p>
          <Link href="/teams" className="btn-primary mt-5">내 팀으로</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6 pb-24">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">{team.churchName} · {team.teamName}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">1:1 대화</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                팀 안의 특정 팀원과 개인적으로 대화할 수 있습니다. 예배 준비와 관련된 확인이 필요할 때 사용해보세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      <TeamNavTabs teamId={team.id} active="direct" />

      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">대화 목록</h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{threads.length}개</span>
          </div>
          {threads.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <p className="font-black text-slate-950">아직 1:1 대화가 없습니다.</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">팀원을 선택해 대화를 시작해보세요.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/teams/${team.id}/direct/${thread.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-slate-950">
                        {formatMemberNameWithEmoji(thread.otherPosition || "팀원", thread.otherProfile?.displayName || "팀원")}
                      </p>
                      <p className="mt-1 truncate text-sm text-slate-500">{thread.lastMessage || "아직 메시지가 없습니다."}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-bold text-slate-400">{thread.lastMessageAt ? formatListTime(thread.lastMessageAt) : ""}</p>
                      {thread.unreadCount > 0 ? (
                        <span className="mt-2 inline-flex rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-black text-white">
                          {thread.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="section-title">팀원에게 메시지 보내기</h2>
          <label className="mt-4 block space-y-1">
            <span className="field-label">팀원 검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="field-input"
              placeholder="이름이나 파트 검색"
            />
          </label>
          <div className="mt-4 grid gap-2">
            {selectableMembers.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">대화할 수 있는 팀원이 없습니다.</p>
            ) : (
              selectableMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => startDirectMessage(member.userId)}
                  disabled={startingUserId === member.userId}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-60"
                >
                  <span>
                    <span className="block font-black text-slate-950">
                      {formatMemberNameWithEmoji(member.position || "팀원", member.profile?.displayName || "팀원")}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{member.position || "포지션 미정"}</span>
                  </span>
                  <span className="text-xs font-black text-blue-700">{startingUserId === member.userId ? "여는 중" : "대화"}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatListTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
