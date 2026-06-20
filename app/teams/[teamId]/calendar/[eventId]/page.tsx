"use client";

import Link from "next/link";
import {
  AVAILABILITY_LABELS,
  TEAM_CALENDAR_EVENT_TYPE_LABELS,
  deleteTeamCalendarEvent,
  getTeamCalendarEvent,
  sendTeamCalendarAvailabilityReminder,
  upsertMyAvailability,
  type AvailabilityStatus,
  type TeamCalendarEventWithAvailability,
  type TeamEventAvailability,
} from "@/lib/db/teamCalendar";
import { getMyRoleInTeam, type TeamMembership } from "@/lib/db/teamMemberships";
import { getTeam, type Team } from "@/lib/db/teams";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STATUS_ORDER: AvailabilityStatus[] = ["available", "unavailable", "maybe", "unknown"];

export default function TeamCalendarEventDetailPage() {
  const params = useParams<{ teamId: string; eventId: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [membership, setMembership] = useState<TeamMembership | null>(null);
  const [event, setEvent] = useState<TeamCalendarEventWithAvailability | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AvailabilityStatus>("unknown");
  const [memo, setMemo] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canManage = membership?.status === "approved" && ["owner", "admin"].includes(membership.role);
  const groupedMembers = useMemo(() => (event ? groupMembersByAvailability(event) : createEmptyGroups()), [event]);

  useEffect(() => {
    loadPage().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "팀 일정을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.teamId, params.eventId]);

  async function loadPage() {
    const [nextTeam, nextMembership, nextEvent] = await Promise.all([
      getTeam(params.teamId),
      getMyRoleInTeam(params.teamId),
      getTeamCalendarEvent(params.eventId),
    ]);

    if (!nextTeam || !nextEvent || nextEvent.teamId !== params.teamId) {
      setError("팀 일정을 찾을 수 없습니다.");
      setLoaded(true);
      return;
    }

    if (nextMembership?.status !== "approved") {
      setTeam(nextTeam);
      setMembership(nextMembership);
      setLoaded(true);
      return;
    }

    setTeam(nextTeam);
    setMembership(nextMembership);
    setEvent(nextEvent);
    setSelectedStatus(nextEvent.myAvailability?.status ?? "unknown");
    setMemo(nextEvent.myAvailability?.memo ?? "");
    setLoaded(true);
  }

  async function handleAvailabilitySave() {
    if (!event) return;

    try {
      setSaving(true);
      setError("");
      await upsertMyAvailability(event.id, selectedStatus, memo);
      const refreshed = await getTeamCalendarEvent(event.id);
      setEvent(refreshed);
      setMessage("가능 여부를 저장했습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "가능 여부를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReminder() {
    if (!event || !window.confirm("아직 응답하지 않은 팀원에게 알림을 보낼까요?")) return;

    try {
      setError("");
      await sendTeamCalendarAvailabilityReminder(event.id);
      setMessage("미응답 팀원에게 알림을 보냈습니다.");
    } catch (reminderError) {
      setError(reminderError instanceof Error ? reminderError.message : "알림을 보내지 못했습니다.");
    }
  }

  async function handleDelete() {
    if (!event || !team || !window.confirm("이 팀 일정을 삭제할까요?")) return;

    try {
      await deleteTeamCalendarEvent(event.id);
      router.push(`/teams/${team.id}/calendar`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "팀 일정을 삭제하지 못했습니다.");
    }
  }

  if (!loaded) {
    return <div className="page-shell"><div className="card p-8 text-sm text-slate-500">팀 일정을 불러오는 중입니다.</div></div>;
  }

  if (!team || !event || membership?.status !== "approved") {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">팀 일정을 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {membership?.status === "pending" ? "리더 승인 후 팀 캘린더를 사용할 수 있습니다." : error || "승인된 팀원만 팀 캘린더에 접근할 수 있습니다."}
          </p>
          <Link href={team ? `/teams/${team.id}/calendar` : "/teams"} className="btn-primary mt-5">돌아가기</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-5xl space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/teams/${team.id}/calendar`} className="btn-secondary">캘린더</Link>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/teams/${team.id}/calendar/${event.id}/edit`} className="btn-secondary">수정</Link>
            <button type="button" onClick={handleDelete} className="btn-danger">삭제</button>
          </div>
        ) : null}
      </div>

      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{TEAM_CALENDAR_EVENT_TYPE_LABELS[event.eventType]}</span>
            <span className={statusBadgeClass(event.myAvailability?.status ?? "unknown")}>
              내 응답: {AVAILABILITY_LABELS[event.myAvailability?.status ?? "unknown"]}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">{event.title}</h1>
          <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-2">
            <p>날짜: {formatDate(event.eventDate)}</p>
            {event.startTime ? <p>시작/예배 시간: {event.startTime}</p> : null}
            {event.gatheringTime ? <p>모임 시간: {event.gatheringTime}</p> : null}
            {event.location ? <p>장소: {event.location}</p> : null}
          </div>
          {event.memo ? <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{event.memo}</p> : null}
          {event.setlist ? (
            <Link href={`/setlists/${event.setlist.id}`} className="btn-primary mt-5">
              연결된 콘티 보기
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="card p-5">
          <h2 className="section-title">내 가능 여부</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            가능 여부는 실제 섬김 배정이 아니라 리더가 콘티 팀원을 정할 때 참고하는 정보입니다.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {(["available", "unavailable", "maybe"] as AvailabilityStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(status)}
                className={`min-h-14 rounded-xl border px-3 py-2 text-sm font-black transition ${
                  selectedStatus === status ? selectedButtonClass(status) : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {status === "available" ? "가능해요" : status === "unavailable" ? "어려워요" : "미정이에요"}
              </button>
            ))}
          </div>
          <label className="mt-4 block space-y-1">
            <span className="field-label">메모</span>
            <textarea
              value={memo}
              onChange={(changeEvent) => setMemo(changeEvent.target.value)}
              className="field-input min-h-24 resize-y"
              placeholder="오후에는 가능해요 / 10분 늦을 수 있어요"
            />
          </label>
          <button type="button" onClick={handleAvailabilitySave} disabled={saving} className="btn-primary mt-4 w-full">
            {saving ? "저장 중" : "가능 여부 저장"}
          </button>
        </div>

        <div className="card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="section-title">팀 응답 현황</h2>
              <p className="mt-2 text-sm text-slate-500">
                가능 {event.summary.available} · 어려움 {event.summary.unavailable} · 미정 {event.summary.maybe} · 미응답 {event.summary.unknown}
              </p>
            </div>
            {canManage && event.summary.unknown > 0 ? (
              <button type="button" onClick={handleReminder} className="btn-secondary min-h-10 px-3">
                미응답 알림
              </button>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            {STATUS_ORDER.map((status) => (
              <MemberGroup
                key={status}
                status={status}
                members={groupedMembers[status]}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MemberGroup({
  status,
  members,
}: {
  status: AvailabilityStatus;
  members: Array<{ member: TeamMembership; availability?: TeamEventAvailability }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-slate-950">{AVAILABILITY_LABELS[status]}</p>
        <span className={statusBadgeClass(status)}>{members.length}명</span>
      </div>
      {members.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">해당 팀원이 없습니다.</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {members.map(({ member, availability }) => (
            <div key={member.id} className="rounded-lg bg-white p-3 ring-1 ring-slate-100">
              <p className="text-sm font-black text-slate-800">
                {formatMemberNameWithEmoji(member.position || "팀원", member.profile?.displayName || "팀원")}
                <span className="ml-2 text-xs font-bold text-slate-500">{member.position || "포지션 미정"}</span>
              </p>
              {availability?.memo ? <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{availability.memo}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupMembersByAvailability(event: TeamCalendarEventWithAvailability) {
  const groups = createEmptyGroups();
  const availabilityByUserId = new Map(event.availabilities.map((availability) => [availability.userId, availability]));

  for (const member of event.members) {
    const availability = availabilityByUserId.get(member.userId);
    const status = availability?.status ?? "unknown";
    groups[status].push({ member, availability });
  }

  return groups;
}

function createEmptyGroups(): Record<AvailabilityStatus, Array<{ member: TeamMembership; availability?: TeamEventAvailability }>> {
  return {
    available: [],
    unavailable: [],
    maybe: [],
    unknown: [],
  };
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function statusBadgeClass(status: AvailabilityStatus) {
  const classes: Record<AvailabilityStatus, string> = {
    available: "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700",
    unavailable: "rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700",
    maybe: "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700",
    unknown: "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600",
  };
  return classes[status];
}

function selectedButtonClass(status: AvailabilityStatus) {
  const classes: Record<AvailabilityStatus, string> = {
    available: "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm",
    unavailable: "border-rose-300 bg-rose-50 text-rose-800 shadow-sm",
    maybe: "border-amber-300 bg-amber-50 text-amber-800 shadow-sm",
    unknown: "border-slate-300 bg-slate-100 text-slate-700 shadow-sm",
  };
  return classes[status];
}
