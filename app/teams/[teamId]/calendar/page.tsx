"use client";

import Link from "next/link";
import {
  AVAILABILITY_LABELS,
  TEAM_CALENDAR_EVENT_TYPE_LABELS,
  getTeamCalendarEvents,
  type AvailabilityStatus,
  type TeamCalendarEventWithAvailability,
} from "@/lib/db/teamCalendar";
import { getMyRoleInTeam, type TeamMembership } from "@/lib/db/teamMemberships";
import { getTeam, type Team } from "@/lib/db/teams";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const SUMMARY_ORDER: AvailabilityStatus[] = ["available", "unavailable", "maybe", "unknown"];

export default function TeamCalendarPage() {
  const params = useParams<{ teamId: string }>();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [team, setTeam] = useState<Team | null>(null);
  const [membership, setMembership] = useState<TeamMembership | null>(null);
  const [events, setEvents] = useState<TeamCalendarEventWithAvailability[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const canManage = membership?.status === "approved" && ["owner", "admin"].includes(membership.role);
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const calendarDays = useMemo(() => buildCalendarDays(year, month), [year, month]);

  useEffect(() => {
    loadPage().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "팀 캘린더를 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.teamId, year, month]);

  async function loadPage() {
    const [nextTeam, nextMembership] = await Promise.all([getTeam(params.teamId), getMyRoleInTeam(params.teamId)]);
    if (!nextTeam || nextMembership?.status !== "approved") {
      setTeam(nextTeam);
      setMembership(nextMembership);
      setLoaded(true);
      return;
    }

    setTeam(nextTeam);
    setMembership(nextMembership);
    setEvents(await getTeamCalendarEvents(params.teamId, year, month));
    setLoaded(true);
  }

  function moveMonth(offset: number) {
    const next = new Date(year, month - 1 + offset, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setLoaded(false);
  }

  if (!loaded) {
    return <div className="page-shell"><div className="card p-8 text-sm text-slate-500">팀 캘린더를 불러오는 중입니다.</div></div>;
  }

  if (!team || membership?.status !== "approved") {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">팀 캘린더를 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {membership?.status === "pending" ? "리더 승인 후 팀 캘린더를 사용할 수 있습니다." : error || "승인된 팀원만 팀 캘린더에 접근할 수 있습니다."}
          </p>
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
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">팀 캘린더</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                예배와 연습 일정을 확인하고, 가능한 날짜를 팀원들과 함께 체크하세요.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage ? <Link href={`/teams/${team.id}/calendar/new`} className="btn-primary">일정 만들기</Link> : null}
              <Link href={`/teams/${team.id}/posts`} className="btn-secondary">공지사항</Link>
              <Link href={`/teams/${team.id}`} className="btn-secondary">팀으로</Link>
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => moveMonth(-1)} className="btn-secondary min-h-10 px-3">이전 달</button>
          <div className="text-center">
            <p className="text-xl font-black text-slate-950">{year}년 {month}월</p>
            <button
              type="button"
              onClick={() => {
                setYear(today.getFullYear());
                setMonth(today.getMonth() + 1);
              }}
              className="mt-1 text-xs font-bold text-blue-700"
            >
              이번 달로
            </button>
          </div>
          <button type="button" onClick={() => moveMonth(1)} className="btn-secondary min-h-10 px-3">다음 달</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-slate-500">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="py-2">{weekday}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayEvents = day.dateKey ? eventsByDate.get(day.dateKey) ?? [] : [];
            return (
              <div
                key={day.key}
                className={`min-h-24 rounded-xl border p-1.5 text-left sm:min-h-32 ${
                  day.isCurrentMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"
                } ${day.isToday ? "ring-2 ring-blue-400" : ""}`}
              >
                <p className={`text-xs font-black ${day.isCurrentMonth ? "text-slate-700" : "text-slate-300"}`}>{day.dayNumber}</p>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <Link
                      key={event.id}
                      href={`/teams/${team.id}/calendar/${event.id}`}
                      className="block rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold leading-4 text-blue-900 hover:bg-blue-100"
                    >
                      <span className="block truncate">{event.startTime ? `${event.startTime} ` : ""}{event.title}</span>
                      <span className="text-[10px] text-blue-700">{event.summary.available} 가능</span>
                    </Link>
                  ))}
                  {dayEvents.length > 2 ? <p className="text-[11px] font-bold text-slate-500">+{dayEvents.length - 2}개</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="section-title">이번 달 일정</h2>
            <p className="mt-1 text-sm text-slate-500">가능 여부는 실제 섬김 배정이 아니라 리더가 콘티 팀원을 정할 때 참고하는 정보입니다.</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="card p-8 text-center">
            <h3 className="text-xl font-black text-slate-950">등록된 일정이 없습니다</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {canManage ? "이번 달 예배나 연습 일정을 만들어 팀원 가능 여부를 확인해 보세요." : "리더가 일정을 등록하면 이곳에 표시됩니다."}
            </p>
            {canManage ? <Link href={`/teams/${team.id}/calendar/new`} className="btn-primary mt-5">일정 만들기</Link> : null}
          </div>
        ) : (
          <div className="grid gap-3">
            {events.map((event) => (
              <Link key={event.id} href={`/teams/${team.id}/calendar/${event.id}`} className="card p-5 transition hover:border-blue-200 hover:bg-blue-50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                    {TEAM_CALENDAR_EVENT_TYPE_LABELS[event.eventType]}
                  </span>
                  <span className={statusBadgeClass(event.myAvailability?.status ?? "unknown")}>
                    내 응답: {AVAILABILITY_LABELS[event.myAvailability?.status ?? "unknown"]}
                  </span>
                  {event.setlist ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">콘티 연결</span> : null}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">{event.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {formatDate(event.eventDate)}{event.startTime ? ` · ${event.startTime}` : ""}{event.location ? ` · ${event.location}` : ""}
                    </p>
                  </div>
                  <Summary summary={event.summary} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({ summary }: { summary: Record<AvailabilityStatus, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SUMMARY_ORDER.map((status) => (
        <span key={status} className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
          {AVAILABILITY_LABELS[status]} {summary[status]}
        </span>
      ))}
    </div>
  );
}

function groupEventsByDate(events: TeamCalendarEventWithAvailability[]) {
  const map = new Map<string, TeamCalendarEventWithAvailability[]>();
  for (const event of events) {
    const list = map.get(event.eventDate) ?? [];
    list.push(event);
    map.set(event.eventDate, list);
  }
  return map;
}

function buildCalendarDays(year: number, month: number) {
  const firstDate = new Date(year, month - 1, 1);
  const firstWeekday = firstDate.getDay();
  const lastDate = new Date(year, month, 0);
  const totalCells = Math.ceil((firstWeekday + lastDate.getDate()) / 7) * 7;
  const todayKey = formatDateInput(new Date());

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(year, month - 1, index - firstWeekday + 1);
    const dateKey = formatDateInput(date);
    return {
      key: `${dateKey}-${index}`,
      dateKey,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month - 1,
      isToday: dateKey === todayKey,
    };
  });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
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
