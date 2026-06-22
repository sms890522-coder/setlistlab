"use client";

import Link from "next/link";
import { TeamNavTabs } from "@/components/TeamNavTabs";
import { TeamRoleBadge, getTeamRoleDescription, getTeamRoleIcon } from "@/components/TeamRoleBadge";
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
  leaveTeam,
  rejectJoinRequest,
  removeTeamMember,
  setTeamMemberRole,
  transferTeamOwnership,
  type TeamMembership,
} from "@/lib/db/teamMemberships";
import {
  canCreateTeamSetlist,
  canCreateTeamCalendarEvent,
  canCreateTeamPost,
  canManageDeputyLeaders,
  canManageMembers,
  canManageTeam,
  canTransferLeadership,
} from "@/lib/permissions/teamPermissions";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import type { Setlist } from "@/lib/types";
import { getTeamDashboard, type TeamDashboardData } from "@/lib/db/teamDashboard";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

export default function TeamDashboardPage() {
  const params = useParams<{ teamId: string }>();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [myMembership, setMyMembership] = useState<TeamMembership | null>(null);
  const [members, setMembers] = useState<TeamMembership[]>([]);
  const [pendingRequests, setPendingRequests] = useState<TeamMembership[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [dashboard, setDashboard] = useState<TeamDashboardData | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [churchName, setChurchName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canEditTeamSettings = canManageTeam(myMembership);
  const canManageTeamMembers = canManageMembers(myMembership);
  const canManageDeputies = canManageDeputyLeaders(myMembership);
  const canTransferLeader = canTransferLeadership(myMembership);
  const canCreateSetlist = canCreateTeamSetlist(myMembership);
  const canCreatePost = canCreateTeamPost(myMembership);
  const canCreateCalendarEvent = canCreateTeamCalendarEvent(myMembership);
  const canShowOwnerActions = canEditTeamSettings || canManageTeamMembers || canManageDeputies || canTransferLeader;
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

    const [nextDashboard, nextPendingRequests] = await Promise.all([
      getTeamDashboard(params.teamId, nextMembership),
      canManageMembers(nextMembership) ? getPendingJoinRequests(params.teamId) : Promise.resolve([]),
    ]);

    setTeam(nextTeam);
    setMyMembership(nextMembership);
    setDashboard(nextDashboard);
    setMembers(nextDashboard.members);
    setPendingRequests(nextPendingRequests);
    setSetlists(nextDashboard.teamSetlists);
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

  async function handleSetDeputy(member: TeamMembership) {
    if (!team) return;
    const name = member.profile?.displayName || "팀원";
    const confirmed = window.confirm(
      `${name} 님을 부리더로 지정할까요?\n\n부리더는 팀 콘티, 공지사항, 일정을 만들고 수정할 수 있습니다.`,
    );
    if (!confirmed) return;

    try {
      await setTeamMemberRole(team.id, member.userId, "admin");
      setMessage("부리더로 지정했습니다.");
      setError("");
      await loadTeam();
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "부리더로 지정하지 못했습니다.");
      setMessage("");
    }
  }

  async function handleUnsetDeputy(member: TeamMembership) {
    if (!team) return;
    const name = member.profile?.displayName || "팀원";
    if (!window.confirm(`${name} 님의 부리더 권한을 해제할까요?`)) return;

    try {
      await setTeamMemberRole(team.id, member.userId, "member");
      setMessage("부리더 권한을 해제했습니다.");
      setError("");
      await loadTeam();
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "부리더 권한을 해제하지 못했습니다.");
      setMessage("");
    }
  }

  async function handleTransferLeadership(member: TeamMembership) {
    if (!team) return;
    const name = member.profile?.displayName || "팀원";
    const typed = window.prompt(
      `정말 리더 권한을 ${name} 님에게 양도하시겠어요?\n\n권한을 양도하면 선택한 팀원이 새 리더가 되고, 현재 리더는 일반 팀원으로 변경됩니다.\n계속하려면 "양도"라고 입력해 주세요.`,
    );
    if (typed !== "양도") return;

    try {
      await transferTeamOwnership(team.id, member.userId);
      setMessage("리더 권한을 양도했습니다.");
      setError("");
      await loadTeam();
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : "리더 권한을 양도하지 못했습니다.");
      setMessage("");
    }
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
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
                <span>내 권한:</span>
                <TeamRoleBadge role={myMembership.role} />
                <span>· {myMembership.position || "포지션 미정"}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCreateSetlist ? <Link href={`/setlists/new?teamId=${team.id}`} className="btn-secondary">팀 콘티 만들기</Link> : null}
              {canEditTeamSettings ? <button type="button" onClick={() => setEditing((value) => !value)} className="btn-secondary">팀 정보 수정</button> : null}
            </div>
          </div>
        </div>
      </section>

      <TeamNavTabs teamId={team.id} active="dashboard" />

      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">{team.teamName} 대시보드</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            이번 주 예배 준비에 필요한 콘티, 공지, 일정, 채팅을 한곳에서 확인하세요.
          </p>
        </div>

        {dashboard?.onboardingStatus.shouldShowLeaderChecklist ? (
          <OnboardingChecklist
            teamId={team.id}
            open={checklistOpen}
            onToggle={() => setChecklistOpen((value) => !value)}
            items={[
              { label: "팀 정보 확인하기", done: Boolean(team.churchName && team.teamName), href: `/teams/${team.id}` },
              { label: "팀원 초대하기", done: dashboard.onboardingStatus.hasInvitedMembers, href: `/teams/${team.id}` },
              { label: "첫 콘티 만들기", done: dashboard.onboardingStatus.hasSetlist, href: `/setlists/new?teamId=${team.id}` },
              { label: "첫 공지 작성하기", done: dashboard.onboardingStatus.hasPost, href: `/teams/${team.id}/posts/new` },
              { label: "첫 예배 일정 만들기", done: dashboard.onboardingStatus.hasCalendarEvent, href: `/teams/${team.id}/calendar/new` },
              { label: "팀원 가능 여부 확인하기", done: dashboard.onboardingStatus.hasCalendarEvent, href: `/teams/${team.id}/calendar` },
            ]}
          />
        ) : null}

        {dashboard?.onboardingStatus.shouldShowMemberGuide ? (
          <section className="card p-5">
            <p className="text-sm font-black text-blue-700">팀원 시작 안내</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">팀에 참여했습니다</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              이제 콘티와 공지, 일정을 함께 확인할 수 있습니다. 이번 주 콘티, 가능 여부, 공지사항, 팀 채팅부터 확인해 보세요.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={dashboard.upcomingSetlist ? `/setlists/${dashboard.upcomingSetlist.id}` : `/teams/${team.id}`} className="btn-secondary min-h-10 px-3">
                이번 주 콘티
              </Link>
              <Link href={`/teams/${team.id}/calendar`} className="btn-secondary min-h-10 px-3">가능 여부 체크</Link>
              <Link href={`/teams/${team.id}/posts`} className="btn-secondary min-h-10 px-3">공지사항</Link>
              <Link href={`/teams/${team.id}/chat`} className="btn-secondary min-h-10 px-3">팀 채팅</Link>
              <Link href="/tools/tuner" className="btn-secondary min-h-10 px-3">튜너 & 메트로놈</Link>
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <DashboardCard title="이번 주 콘티" action={canCreateSetlist ? { href: `/setlists/new?teamId=${team.id}`, label: "콘티 만들기" } : undefined}>
            {dashboard?.upcomingSetlist ? (
              <div className="space-y-3">
                <div>
                  <p className="text-lg font-black text-slate-950">{dashboard.upcomingSetlist.title || "제목 없는 콘티"}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {dashboard.upcomingSetlist.worshipDate || "날짜 미정"} · 곡 {dashboard.upcomingSetlist.songs.length}개
                  </p>
                  {dashboard.upcomingEvents.find((event) => event.setlistId === dashboard.upcomingSetlist?.id) ? (
                    <p className="mt-2 text-sm text-blue-700">연결된 팀 캘린더 일정이 있습니다.</p>
                  ) : null}
                </div>
                <Link href={`/setlists/${dashboard.upcomingSetlist.id}`} className="btn-primary w-fit min-h-10 px-3">콘티 보기</Link>
              </div>
            ) : (
              <EmptyDashboardState
                message="이번 주 콘티가 아직 없습니다."
                action={canCreateSetlist ? { href: `/setlists/new?teamId=${team.id}`, label: "콘티 만들기" } : undefined}
              />
            )}
          </DashboardCard>

          <DashboardCard title="다가오는 일정" action={canCreateCalendarEvent ? { href: `/teams/${team.id}/calendar/new`, label: "일정 만들기" } : { href: `/teams/${team.id}/calendar`, label: "전체 보기" }}>
            {dashboard && dashboard.upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {dashboard.upcomingEvents.map((event) => (
                  <Link key={event.id} href={`/teams/${team.id}/calendar/${event.id}`} className="block rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-slate-950">{event.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{formatKoreanDate(event.eventDate)} {event.startTime ? `· ${formatTimeLabel(event.startTime)}` : ""}</p>
                      </div>
                      <span className={getAvailabilityClass(event.myAvailability?.status ?? "unknown")}>
                        {getAvailabilityLabel(event.myAvailability?.status ?? "unknown")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyDashboardState
                message="아직 팀 일정이 없습니다. 예배나 연습 일정을 등록해보세요."
                action={canCreateCalendarEvent ? { href: `/teams/${team.id}/calendar/new`, label: "일정 만들기" } : undefined}
              />
            )}
          </DashboardCard>

          <DashboardCard title="공지사항" badge={dashboard?.unreadPostsCount ? `읽지 않음 ${dashboard.unreadPostsCount}` : undefined} action={canCreatePost ? { href: `/teams/${team.id}/posts/new`, label: "공지 작성" } : { href: `/teams/${team.id}/posts`, label: "전체 보기" }}>
            {dashboard && dashboard.recentPosts.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recentPosts.map((post) => (
                  <Link key={post.id} href={`/teams/${team.id}/posts/${post.id}`} className="block rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50">
                    <div className="flex items-center gap-2">
                      {post.isPinned ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-700">고정</span> : null}
                      {!post.hasRead ? <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-black text-blue-700">새 글</span> : null}
                    </div>
                    <p className="mt-2 font-black text-slate-950">{post.title}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyDashboardState
                message="아직 공지사항이 없습니다. 중요한 연습 안내를 공지로 남겨보세요."
                action={canCreatePost ? { href: `/teams/${team.id}/posts/new`, label: "공지 작성" } : undefined}
              />
            )}
          </DashboardCard>

          <DashboardCard title="팀 채팅" badge={dashboard?.unreadChatCount ? `새 메시지 ${dashboard.unreadChatCount}` : undefined} action={{ href: `/teams/${team.id}/chat`, label: "팀 채팅 열기" }}>
            {dashboard?.recentChatMessage ? (
              <div className="space-y-3">
                <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{dashboard.recentChatMessage.message}</p>
                <p className="text-xs font-semibold text-slate-500">{formatDateTimeLabel(dashboard.recentChatMessage.createdAt)}</p>
              </div>
            ) : (
              <EmptyDashboardState message="아직 대화가 없습니다. 팀원들과 예배 준비 이야기를 나눠보세요." />
            )}
          </DashboardCard>

          <DashboardCard title="팀원 현황" badge={dashboard?.pendingMembersCount ? `승인 대기 ${dashboard.pendingMembersCount}` : undefined} action={{ href: `#team-members`, label: "팀원 보기" }}>
            <div className="space-y-3">
              <p className="text-3xl font-black text-slate-950">{members.length}<span className="ml-1 text-base font-bold text-slate-500">명</span></p>
              <div className="flex flex-wrap gap-2">
                {members.filter((member) => member.role !== "member").map((member) => (
                  <span key={member.id} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">
                    {getTeamRoleIcon(member.role)} {member.profile?.displayName || "팀원"}
                  </span>
                ))}
              </div>
              {dashboard?.pendingMembersCount ? <p className="text-sm font-semibold text-amber-700">새 참여 요청을 확인해 주세요.</p> : null}
            </div>
          </DashboardCard>

          <DashboardCard title="빠른 작업">
            <div className="grid gap-2 sm:grid-cols-2">
              {myMembership.role !== "member" ? (
                <>
                  <Link href={`/setlists/new?teamId=${team.id}`} className="btn-secondary justify-center">콘티 만들기</Link>
                  <Link href={`/teams/${team.id}/posts/new`} className="btn-secondary justify-center">공지 작성</Link>
                  <Link href={`/teams/${team.id}/calendar/new`} className="btn-secondary justify-center">일정 만들기</Link>
                  <button type="button" onClick={copyInviteLink} className="btn-secondary justify-center">팀원 초대</button>
                </>
              ) : (
                <>
                  <Link href="/account" className="btn-secondary justify-center">내 일정 확인</Link>
                  <Link href="/songs" className="btn-secondary justify-center">곡 보관함</Link>
                  <Link href="/tools/tuner" className="btn-secondary justify-center">튜너 & 메트로놈</Link>
                  <Link href={`/teams/${team.id}/chat`} className="btn-secondary justify-center">팀 채팅</Link>
                </>
              )}
            </div>
          </DashboardCard>
        </div>
      </section>

      {editing && canEditTeamSettings ? (
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

      <section id="team-settings" className="card p-5 scroll-mt-24">
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
            {canEditTeamSettings ? <button type="button" onClick={handleRegenerateInviteCode} className="btn-secondary">재발급</button> : null}
            {canEditTeamSettings ? <button type="button" onClick={handleInviteToggle} className="btn-secondary">{team.inviteEnabled ? "초대 비활성화" : "초대 활성화"}</button> : null}
          </div>
        </div>
      </section>

      {canManageTeamMembers ? (
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

      <section id="team-members" className="card p-5 scroll-mt-24">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="section-title">팀원 목록</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              리더는 팀원 승인과 부리더 지정, 리더 권한 양도를 할 수 있습니다. 부리더는 콘티, 공지사항, 일정을 함께 관리합니다.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {members.map((member) => (
            <article key={member.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {member.role !== "member" ? <span aria-hidden="true">{getTeamRoleIcon(member.role)}</span> : null}
                    <p className="font-black text-slate-950">
                      {formatMemberNameWithEmoji(member.position || "팀원", member.profile?.displayName || "팀원")}
                    </p>
                    <TeamRoleBadge role={member.role} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-500">{member.position || "포지션 미정"}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{getTeamRoleDescription(member.role)}</p>
                </div>
              </div>
              {canShowOwnerActions && member.role !== "owner" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {canManageDeputies && member.role === "member" ? (
                    <button type="button" onClick={() => handleSetDeputy(member)} className="btn-secondary min-h-9 px-3 text-xs">
                      부리더로 지정
                    </button>
                  ) : null}
                  {canManageDeputies && member.role === "admin" ? (
                    <button type="button" onClick={() => handleUnsetDeputy(member)} className="btn-secondary min-h-9 px-3 text-xs">
                      부리더 해제
                    </button>
                  ) : null}
                  {canTransferLeader && members.length > 1 ? (
                    <button type="button" onClick={() => handleTransferLeadership(member)} className="btn-secondary min-h-9 px-3 text-xs">
                      리더 권한 양도
                    </button>
                  ) : null}
                  {canManageTeamMembers ? (
                    <button type="button" onClick={() => handleRemove(member)} className="btn-danger min-h-9 px-3 text-xs">
                      제거
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section id="team-setlists" className="card p-5 scroll-mt-24">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">팀 콘티</h2>
          <div className="flex flex-wrap gap-2">
            <Link href={`/teams/${team.id}/calendar`} className="btn-secondary min-h-10 px-3">팀 캘린더</Link>
            <Link href={`/teams/${team.id}/posts`} className="btn-secondary min-h-10 px-3">공지사항</Link>
            {canCreateSetlist ? <Link href={`/setlists/new?teamId=${team.id}`} className="btn-secondary min-h-10 px-3">팀 콘티 만들기</Link> : null}
          </div>
        </div>
        {setlists.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
            아직 콘티가 없습니다. 이번 주 예배 콘티를 만들어보세요.
          </p>
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

function DashboardCard({
  title,
  badge,
  action,
  children,
}: {
  title: string;
  badge?: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <article className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="section-title">{title}</h3>
            {badge ? <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-black text-blue-700">{badge}</span> : null}
          </div>
        </div>
        {action ? (
          <Link href={action.href} className="btn-secondary min-h-9 shrink-0 px-3 text-xs">
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </article>
  );
}

function EmptyDashboardState({ message, action }: { message: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
      <p>{message}</p>
      {action ? (
        <Link href={action.href} className="btn-primary mt-3 w-fit min-h-10 px-3">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

function OnboardingChecklist({
  open,
  onToggle,
  items,
}: {
  teamId: string;
  open: boolean;
  onToggle: () => void;
  items: Array<{ label: string; done: boolean; href: string }>;
}) {
  const doneCount = items.filter((item) => item.done).length;

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 text-left"
      >
        <div>
          <p className="text-sm font-black text-blue-700">시작하기 체크리스트</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">팀 운영을 시작하기 위한 기본 설정</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{doneCount}/{items.length} 완료</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-black text-slate-700">
          {open ? "접기" : "펼치기"}
        </span>
      </button>
      {open ? (
        <div className="grid gap-2 p-5 sm:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50"
            >
              <span className="font-bold text-slate-800">{item.label}</span>
              <span className={item.done ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-500"}>
                {item.done ? "완료" : "하기"}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function getAvailabilityLabel(status: string) {
  if (status === "available") return "가능";
  if (status === "unavailable") return "어려움";
  if (status === "maybe") return "미정";
  return "미응답";
}

function getAvailabilityClass(status: string) {
  if (status === "available") return "shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700";
  if (status === "unavailable") return "shrink-0 rounded-full bg-rose-100 px-2 py-1 text-xs font-black text-rose-700";
  if (status === "maybe") return "shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-700";
  return "shrink-0 rounded-full bg-slate-200 px-2 py-1 text-xs font-black text-slate-600";
}

function formatKoreanDate(date: string) {
  if (!date) return "날짜 미정";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

function formatTimeLabel(time: string) {
  return time.slice(0, 5);
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
