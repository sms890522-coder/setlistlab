"use client";

import Link from "next/link";
import { TeamNavTabs } from "@/components/TeamNavTabs";
import { getMyRoleInTeam, type TeamMembership } from "@/lib/db/teamMemberships";
import { getTeam, type Team } from "@/lib/db/teams";
import { getTeamPosts, subscribeTeamPosts, TEAM_POST_TYPE_LABELS, type TeamPost } from "@/lib/db/teamPosts";
import { canCreateTeamPost } from "@/lib/permissions/teamPermissions";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function TeamPostsPage() {
  const params = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [membership, setMembership] = useState<TeamMembership | null>(null);
  const [posts, setPosts] = useState<TeamPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canManage = useMemo(() => canCreateTeamPost(membership), [membership]);

  useEffect(() => {
    loadPage().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "팀 공지사항을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.teamId]);

  useEffect(() => {
    if (!team) return undefined;
    return subscribeTeamPosts(team.id, () => {
      void refreshPosts();
    });
  }, [team?.id]);

  async function loadPage() {
    const [nextTeam, nextMembership] = await Promise.all([getTeam(params.teamId), getMyRoleInTeam(params.teamId)]);
    if (!nextTeam) {
      setError("팀을 찾을 수 없습니다.");
      setLoaded(true);
      return;
    }

    if (nextMembership?.status !== "approved") {
      setMessage(nextMembership?.status === "pending" ? "리더 승인 후 공지사항을 사용할 수 있습니다." : "이 팀 공지사항에 접근할 권한이 없습니다.");
      setLoaded(true);
      return;
    }

    setTeam(nextTeam);
    setMembership(nextMembership);
    setPosts(await getTeamPosts(params.teamId));
    setLoaded(true);
  }

  async function refreshPosts() {
    setPosts(await getTeamPosts(params.teamId).catch(() => posts));
  }

  if (!loaded) {
    return <div className="page-shell"><div className="card p-8 text-sm text-slate-500">팀 공지사항을 불러오는 중입니다.</div></div>;
  }

  if (!team || membership?.status !== "approved") {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">공지사항을 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message || error || "승인된 팀원만 공지사항에 접근할 수 있습니다."}</p>
          <Link href="/teams" className="btn-primary mt-5">내 팀으로</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6 pb-20">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">{team.churchName} · {team.teamName}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">팀 공지사항</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                팀 연습과 예배 준비에 필요한 중요한 내용을 공지로 남겨보세요.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage ? <Link href={`/teams/${team.id}/posts/new`} className="btn-primary">공지 작성</Link> : null}
            </div>
          </div>
        </div>
      </section>

      <TeamNavTabs teamId={team.id} active="posts" />

      {posts.length === 0 ? (
        <section className="card p-8 text-center">
          <h2 className="text-xl font-black text-slate-950">아직 공지사항이 없습니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {canManage ? "리더 또는 부리더가 첫 공지를 작성해보세요." : "리더나 부리더가 공지를 등록하면 이곳에서 확인할 수 있습니다."}
          </p>
          {canManage ? <Link href={`/teams/${team.id}/posts/new`} className="btn-primary mt-5">공지 작성</Link> : null}
        </section>
      ) : (
        <section className="grid gap-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/teams/${team.id}/posts/${post.id}`}
              className="card p-5 transition hover:border-blue-200 hover:bg-blue-50"
            >
              <div className="flex flex-wrap items-center gap-2">
                {post.isPinned ? <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white">고정 공지</span> : null}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{TEAM_POST_TYPE_LABELS[post.type]}</span>
                {post.hasRead ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">읽음</span>
                ) : (
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">읽지 않음</span>
                )}
                {post.notifyMembers ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">알림 전송</span> : null}
                {post.commentCount > 0 ? (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">댓글 {post.commentCount}</span>
                ) : null}
              </div>
              <h2 className="mt-3 text-lg font-black text-slate-950">{post.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{post.content}</p>
              <p className="mt-3 text-xs font-semibold text-slate-500">
                {post.author?.displayName || "팀원"} · {formatDateTime(post.createdAt)}
              </p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
