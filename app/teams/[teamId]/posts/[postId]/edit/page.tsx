"use client";

import Link from "next/link";
import { TeamPostForm } from "@/components/TeamPostForm";
import { getMyRoleInTeam, type TeamMembership } from "@/lib/db/teamMemberships";
import { getTeam, type Team } from "@/lib/db/teams";
import { getTeamPost, updateTeamPost, type TeamPost, type TeamPostType } from "@/lib/db/teamPosts";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditTeamPostPage() {
  const params = useParams<{ teamId: string; postId: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [membership, setMembership] = useState<TeamMembership | null>(null);
  const [post, setPost] = useState<TeamPost | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPage() {
      const [nextTeam, nextMembership, nextPost] = await Promise.all([
        getTeam(params.teamId),
        getMyRoleInTeam(params.teamId),
        getTeamPost(params.postId),
      ]);

      setTeam(nextTeam);
      setMembership(nextMembership);
      setPost(nextPost && nextPost.teamId === params.teamId ? nextPost : null);
      setLoaded(true);
    }

    loadPage().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "공지 수정 화면을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.teamId, params.postId]);

  async function handleSubmit(input: {
    title: string;
    content: string;
    type: TeamPostType;
    isPinned: boolean;
    notifyMembers: boolean;
    notifyOnUpdate?: boolean;
  }) {
    try {
      setSubmitting(true);
      setError("");
      const savedPost = await updateTeamPost(params.postId, input);
      router.push(`/teams/${params.teamId}/posts/${savedPost.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "공지사항을 수정하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const canManage = membership?.status === "approved" && ["owner", "admin"].includes(membership.role);

  if (!loaded) {
    return <div className="page-shell"><div className="card p-8 text-sm text-slate-500">공지 수정 화면을 준비하는 중입니다.</div></div>;
  }

  if (!team || !post || !canManage) {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">공지 수정 권한이 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">팀 리더와 관리자만 공지사항을 수정할 수 있습니다.</p>
          <Link href={team ? `/teams/${team.id}/posts` : "/teams"} className="btn-primary mt-5">돌아가기</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-3xl space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-blue-700">{team.churchName} · {team.teamName}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">공지사항 수정</h1>
        </div>
        <Link href={`/teams/${team.id}/posts/${post.id}`} className="btn-secondary">상세로</Link>
      </div>

      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      <TeamPostForm mode="edit" initialPost={post} submitting={submitting} onSubmit={handleSubmit} />
    </div>
  );
}
