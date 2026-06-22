"use client";

import Link from "next/link";
import { getMyRoleInTeam, type TeamMembership } from "@/lib/db/teamMemberships";
import { getTeam, type Team } from "@/lib/db/teams";
import {
  deleteTeamPost,
  getTeamPost,
  getTeamPostReadStatus,
  markTeamPostRead,
  TEAM_POST_TYPE_LABELS,
  type TeamPost,
  type TeamPostReadStatus,
} from "@/lib/db/teamPosts";
import { canDeleteTeamPost, canManageTeamPost } from "@/lib/permissions/teamPermissions";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TeamPostDetailPage() {
  const params = useParams<{ teamId: string; postId: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [membership, setMembership] = useState<TeamMembership | null>(null);
  const [post, setPost] = useState<TeamPost | null>(null);
  const [readStatus, setReadStatus] = useState<TeamPostReadStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canManage = canManageTeamPost(membership);
  const canDelete = canDeleteTeamPost(membership);

  useEffect(() => {
    loadPage().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "공지사항을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.teamId, params.postId]);

  async function loadPage() {
    const [nextTeam, nextMembership, nextPost] = await Promise.all([
      getTeam(params.teamId),
      getMyRoleInTeam(params.teamId),
      getTeamPost(params.postId),
    ]);

    if (!nextTeam || !nextPost || nextPost.teamId !== params.teamId) {
      setError("공지사항을 찾을 수 없습니다.");
      setLoaded(true);
      return;
    }

    if (nextMembership?.status !== "approved") {
      setMessage(nextMembership?.status === "pending" ? "리더 승인 후 공지사항을 사용할 수 있습니다." : "이 공지사항에 접근할 권한이 없습니다.");
      setLoaded(true);
      return;
    }

    setTeam(nextTeam);
    setMembership(nextMembership);
    setPost(nextPost);
    setLoaded(true);

    const read = await markTeamPostRead(nextPost.id).catch(() => null);
    if (read) {
      setPost((current) => (current ? { ...current, hasRead: true, readAt: read.readAt } : current));
    }

    if (canManageTeamPost(nextMembership)) {
      setReadStatus(await getTeamPostReadStatus(nextPost.id).catch(() => null));
    }
  }

  async function handleDelete() {
    if (!post || !team || !window.confirm("이 공지사항을 삭제할까요?")) return;

    try {
      await deleteTeamPost(post.id);
      router.push(`/teams/${team.id}/posts`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "공지사항을 삭제하지 못했습니다.");
    }
  }

  if (!loaded) {
    return <div className="page-shell"><div className="card p-8 text-sm text-slate-500">공지사항을 불러오는 중입니다.</div></div>;
  }

  if (!team || !post || membership?.status !== "approved") {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">공지사항을 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message || error || "승인된 팀원만 공지사항에 접근할 수 있습니다."}</p>
          <Link href={team ? `/teams/${team.id}/posts` : "/teams"} className="btn-primary mt-5">돌아가기</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-4xl space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/teams/${team.id}/posts`} className="btn-secondary">공지 목록</Link>
        {canManage || canDelete ? (
          <div className="flex flex-wrap gap-2">
            {canManage ? <Link href={`/teams/${team.id}/posts/${post.id}/edit`} className="btn-secondary">수정</Link> : null}
            {canDelete ? <button type="button" onClick={handleDelete} className="btn-danger">삭제</button> : null}
          </div>
        ) : null}
      </div>

      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <article className="card overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            {post.isPinned ? <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white">고정 공지</span> : null}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{TEAM_POST_TYPE_LABELS[post.type]}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">이 공지를 확인했습니다</span>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">{post.title}</h1>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            {post.author?.displayName || "팀원"} · 작성 {formatDateTime(post.createdAt)}
            {post.updatedAt !== post.createdAt ? ` · 수정 ${formatDateTime(post.updatedAt)}` : ""}
          </p>
        </div>
        <div className="whitespace-pre-wrap p-5 text-sm leading-8 text-slate-800 sm:p-7">{post.content}</div>
      </article>

      {canManage && readStatus ? (
        <details className="card p-5">
          <summary className="cursor-pointer text-base font-black text-slate-950">읽음 현황 보기</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="전체 팀원" value={readStatus.totalCount} />
            <Stat label="읽은 팀원" value={readStatus.readCount} />
            <Stat label="안 읽은 팀원" value={readStatus.unreadCount} />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <ReadList title="읽은 팀원" members={readStatus.readMembers.map((item) => item.membership)} />
            <ReadList title="안 읽은 팀원" members={readStatus.unreadMembers} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function ReadList({ title, members }: { title: string; members: TeamMembership[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      {members.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">해당 팀원이 없습니다.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {members.map((member) => (
            <span key={member.id} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
              {member.position || "팀원"}: {formatMemberNameWithEmoji(member.position || "팀원", member.profile?.displayName || "팀원")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
