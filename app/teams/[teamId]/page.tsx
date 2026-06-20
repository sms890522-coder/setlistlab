"use client";

import Link from "next/link";
import {
  disableInviteCode,
  enableInviteCode,
  getTeam,
  regenerateInviteCode,
  updateTeam,
  type Team,
} from "@/lib/db/teams";
import {
  approveJoinRequest,
  getMyRoleInTeam,
  getPendingJoinRequests,
  getTeamMembers,
  leaveTeam,
  rejectJoinRequest,
  removeTeamMember,
  type TeamMembership,
} from "@/lib/db/teamMemberships";
import { getCloudSetlists } from "@/lib/db/setlists";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import type { Setlist } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

export default function TeamDashboardPage() {
  const params = useParams<{ teamId: string }>();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [myMembership, setMyMembership] = useState<TeamMembership | null>(null);
  const [members, setMembers] = useState<TeamMembership[]>([]);
  const [pendingRequests, setPendingRequests] = useState<TeamMembership[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [editing, setEditing] = useState(false);
  const [churchName, setChurchName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canManage = myMembership?.status === "approved" && ["owner", "admin"].includes(myMembership.role);
  const inviteLink = useMemo(() => {
    if (!team || typeof window === "undefined") return "";
    return `${window.location.origin}/join/${team.inviteCode}`;
  }, [team]);

  useEffect(() => {
    loadTeam().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "팀 정보를 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.teamId]);

  async function loadTeam() {
    const [nextTeam, nextMembership] = await Promise.all([getTeam(params.teamId), getMyRoleInTeam(params.teamId)]);
    if (!nextTeam || nextMembership?.status !== "approved") {
      setTeam(null);
      setMyMembership(nextMembership);
      setLoaded(true);
      return;
    }

    const [nextMembers, nextSetlists, nextPendingRequests] = await Promise.all([
      getTeamMembers(params.teamId),
      getCloudSetlists(),
      ["owner", "admin"].includes(nextMembership.role) ? getPendingJoinRequests(params.teamId) : Promise.resolve([]),
    ]);

    setTeam(nextTeam);
    setMyMembership(nextMembership);
    setMembers(nextMembers);
    setPendingRequests(nextPendingRequests);
    setSetlists(nextSetlists.filter((setlist) => setlist.teamId === params.teamId));
    setChurchName(nextTeam.churchName);
    setTeamName(nextTeam.teamName);
    setDescription(nextTeam.description ?? "");
    setLoaded(true);
  }

  async function copyInviteLink() {
    if (!team) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage("초대링크를 복사했습니다.");
      setError("");
    } catch {
      setError("클립보드 복사에 실패했습니다. 초대링크를 직접 복사해 주세요.");
      setMessage("");
    }
  }

  async function copyInviteCode() {
    if (!team) return;
    try {
      await navigator.clipboard.writeText(team.inviteCode);
      setMessage("초대코드를 복사했습니다.");
      setError("");
    } catch {
      setError("클립보드 복사에 실패했습니다. 초대코드를 직접 복사해 주세요.");
      setMessage("");
    }
  }

  async function handleUpdateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!team) return;

    try {
      const savedTeam = await updateTeam(team.id, { churchName, teamName, description });
      setTeam(savedTeam);
      setEditing(false);
      setMessage("팀 정보를 저장했습니다.");
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "팀 정보를 저장하지 못했습니다.");
    }
  }

  async function handleInviteToggle() {
    if (!team) return;
    const savedTeam = team.inviteEnabled ? await disableInviteCode(team.id) : await enableInviteCode(team.id);
    setTeam(savedTeam);
    setMessage(savedTeam.inviteEnabled ? "초대코드를 활성화했습니다." : "초대코드를 비활성화했습니다.");
  }

  async function handleRegenerateInviteCode() {
    if (!team || !window.confirm("초대코드를 재발급할까요? 기존 초대코드는 사용할 수 없습니다.")) return;
    const savedTeam = await regenerateInviteCode(team.id);
    setTeam(savedTeam);
    setMessage("초대코드를 재발급했습니다.");
  }

  async function handleApprove(membershipId: string) {
    await approveJoinRequest(membershipId);
    setMessage("팀원으로 승인했습니다.");
    await loadTeam();
  }

  async function handleReject(membershipId: string) {
    await rejectJoinRequest(membershipId);
    setMessage("참여 요청을 거절했습니다.");
    await loadTeam();
  }

  async function handleRemove(membership: TeamMembership) {
    if (!window.confirm(`${membership.profile?.displayName || "팀원"} 님을 팀에서 제거할까요?`)) return;
    await removeTeamMember(membership.id);
    setMessage("팀원을 제거했습니다.");
    await loadTeam();
  }

  async function handleLeaveTeam() {
    if (!team || !window.confirm("이 팀에서 나갈까요?")) return;
    await leaveTeam(team.id);
    router.push("/teams");
  }

  if (!loaded) {
    return <div className="page-shell"><div className="card p-8 text-sm text-slate-500">팀 정보를 불러오는 중입니다.</div></div>;
  }

  if (!team || myMembership?.status !== "approved") {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">팀에 접근할 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {myMembership?.status === "pending" ? "리더 승인 후 사용할 수 있습니다." : "승인된 팀원만 팀 대시보드에 접근할 수 있습니다."}
          </p>
          <Link href="/teams" className="btn-primary mt-5">내 팀으로</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">{team.churchName}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{team.teamName}</h1>
              {team.description ? <p className="mt-3 text-sm leading-7 text-slate-700">{team.description}</p> : null}
              <p className="mt-3 text-sm font-semibold text-slate-600">내 권한: {roleLabel(myMembership.role)} · {myMembership.position || "포지션 미정"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/teams/${team.id}/calendar`} className="btn-primary">팀 캘린더</Link>
              <Link href={`/teams/${team.id}/posts`} className="btn-primary">공지사항</Link>
              <Link href={`/teams/${team.id}/chat`} className="btn-secondary">팀 채팅</Link>
              <Link href={`/teams/${team.id}/direct`} className="btn-secondary">1:1 대화</Link>
              <Link href={`/setlists/new?teamId=${team.id}`} className="btn-secondary">팀 콘티 만들기</Link>
              {canManage ? <button type="button" onClick={() => setEditing((value) => !value)} className="btn-secondary">팀 정보 수정</button> : null}
            </div>
          </div>
        </div>
      </section>

      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      {editing && canManage ? (
        <form onSubmit={handleUpdateTeam} className="card grid gap-4 p-5 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="field-label">교회 이름</span>
            <input value={churchName} onChange={(event) => setChurchName(event.target.value)} className="field-input" />
          </label>
          <label className="space-y-1">
            <span className="field-label">찬양팀 이름</span>
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} className="field-input" />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="field-label">설명</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="field-input min-h-24 resize-y" />
          </label>
          <button type="submit" className="btn-primary w-fit">저장</button>
        </form>
      ) : null}

      <section className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="section-title">초대코드</h2>
            <p className="mt-2 text-2xl font-black tracking-wider text-slate-950">{team.inviteCode}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">초대코드를 아는 사람도 바로 팀원이 되지 않고, 참여 요청 후 리더 승인이 필요합니다.</p>
            <input value={inviteLink} readOnly className="field-input mt-3 bg-slate-50 font-mono text-xs" onFocus={(event) => event.target.select()} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyInviteCode} className="btn-secondary">코드 복사</button>
            <button type="button" onClick={copyInviteLink} className="btn-secondary">링크 복사</button>
            {canManage ? <button type="button" onClick={handleRegenerateInviteCode} className="btn-secondary">재발급</button> : null}
            {canManage ? <button type="button" onClick={handleInviteToggle} className="btn-secondary">{team.inviteEnabled ? "초대 비활성화" : "초대 활성화"}</button> : null}
          </div>
        </div>
      </section>

      {canManage ? (
        <section className="card p-5">
          <h2 className="section-title">새로운 팀 참여 요청</h2>
          {pendingRequests.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">대기 중인 요청이 없습니다.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {pendingRequests.map((request) => (
                <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-black text-slate-950">{request.profile?.displayName || "이름 없는 사용자"}</p>
                  <p className="mt-1 text-sm text-slate-500">포지션 {request.position || "-"}</p>
                  {request.requestedMessage ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{request.requestedMessage}</p> : null}
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => handleApprove(request.id)} className="btn-primary min-h-10 px-3">승인</button>
                    <button type="button" onClick={() => handleReject(request.id)} className="btn-danger min-h-10 px-3">거절</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="card p-5">
        <h2 className="section-title">팀원 목록</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {members.map((member) => (
            <span key={member.id} className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
              {member.position || "팀원"}: {formatMemberNameWithEmoji(member.position || "팀원", member.profile?.displayName || "팀원")}
              {canManage && member.role !== "owner" ? (
                <button type="button" onClick={() => handleRemove(member)} className="text-xs font-black text-rose-600">제거</button>
              ) : null}
            </span>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">팀 콘티</h2>
          <div className="flex flex-wrap gap-2">
            <Link href={`/teams/${team.id}/calendar`} className="btn-secondary min-h-10 px-3">팀 캘린더</Link>
            <Link href={`/teams/${team.id}/posts`} className="btn-secondary min-h-10 px-3">공지사항</Link>
            <Link href={`/setlists/new?teamId=${team.id}`} className="btn-secondary min-h-10 px-3">팀 콘티 만들기</Link>
          </div>
        </div>
        {setlists.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">아직 팀 콘티가 없습니다.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {setlists.map((setlist) => (
              <Link key={setlist.id} href={`/setlists/${setlist.id}`} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50">
                <p className="font-black text-slate-950">{setlist.title || "제목 없는 콘티"}</p>
                <p className="mt-1 text-sm text-slate-500">{setlist.worshipDate || "날짜 미정"} · {setlist.serviceName || "예배 이름 미정"}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {myMembership.role !== "owner" ? (
        <button type="button" onClick={handleLeaveTeam} className="btn-danger">팀 나가기</button>
      ) : null}
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "owner") return "리더";
  if (role === "admin") return "관리자";
  return "팀원";
}
