"use client";

import {
  TEAM_CALENDAR_EVENT_TYPE_LABELS,
  type RecurringTeamCalendarEventInput,
  type TeamCalendarEvent,
  type TeamCalendarEventInput,
  type TeamCalendarEventType,
} from "@/lib/db/teamCalendar";
import { generateRecurringDates, type RecurrenceType } from "@/lib/calendar/recurrence";
import type { Setlist } from "@/lib/types";
import { FormEvent, useMemo, useState } from "react";

type TeamCalendarEventFormProps = {
  teamId: string;
  initialEvent?: TeamCalendarEvent;
  mode: "create" | "edit";
  setlists?: Setlist[];
  submitting?: boolean;
  onSubmit: (input: TeamCalendarEventInput) => void | Promise<void>;
  onRecurringSubmit?: (input: RecurringTeamCalendarEventInput) => void | Promise<void>;
};

const EVENT_TYPES: TeamCalendarEventType[] = ["worship", "practice", "event", "etc"];
const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: "반복 안 함",
  weekly: "매주",
  biweekly: "격주",
  monthly_same_date: "매월 같은 날짜",
  monthly_nth_weekday: "매월 같은 주차/요일",
};

export function TeamCalendarEventForm({
  teamId,
  initialEvent,
  mode,
  setlists = [],
  submitting = false,
  onSubmit,
  onRecurringSubmit,
}: TeamCalendarEventFormProps) {
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [eventType, setEventType] = useState<TeamCalendarEventType>(initialEvent?.eventType ?? "worship");
  const [eventDate, setEventDate] = useState(initialEvent?.eventDate ?? formatDateInput(new Date()));
  const [startTime, setStartTime] = useState(initialEvent?.startTime ?? "");
  const [gatheringTime, setGatheringTime] = useState(initialEvent?.gatheringTime ?? "");
  const [location, setLocation] = useState(initialEvent?.location ?? "");
  const [setlistId, setSetlistId] = useState(initialEvent?.setlistId ?? "");
  const [memo, setMemo] = useState(initialEvent?.memo ?? "");
  const [notifyMembers, setNotifyMembers] = useState(mode === "create");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");
  const [recurrenceEndMode, setRecurrenceEndMode] = useState<"count" | "endDate">("count");
  const [recurrenceCount, setRecurrenceCount] = useState(12);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [recurrenceError, setRecurrenceError] = useState("");
  const recurrenceDates = useMemo(() => {
    if (mode !== "create" || recurrenceType === "none") return [];
    return generateRecurringDates({
      startDate: eventDate,
      recurrenceType,
      count: recurrenceEndMode === "count" ? recurrenceCount : undefined,
      endDate: recurrenceEndMode === "endDate" ? recurrenceEndDate : undefined,
      maxCount: 61,
    });
  }, [eventDate, mode, recurrenceCount, recurrenceEndDate, recurrenceEndMode, recurrenceType]);
  const isRecurring = mode === "create" && recurrenceType !== "none";
  const isOverLimit = recurrenceDates.length > 60;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isRecurring) {
      if (isOverLimit) {
        setRecurrenceError("한 번에 최대 60개의 반복 일정만 만들 수 있습니다.");
        return;
      }

      if (recurrenceDates.length === 0) {
        setRecurrenceError("생성할 반복 일정 날짜가 없습니다. 종료일 또는 생성 횟수를 확인해 주세요.");
        return;
      }

      setRecurrenceError("");
      await onRecurringSubmit?.({
        teamId,
        title,
        eventType,
        eventDate,
        startTime,
        gatheringTime,
        location,
        memo,
        notifyMembers,
        recurrenceType,
        recurrenceCount: recurrenceEndMode === "count" ? recurrenceCount : undefined,
        recurrenceEndDate: recurrenceEndMode === "endDate" ? recurrenceEndDate : undefined,
      });
      return;
    }

    await onSubmit({
      teamId,
      title,
      eventType,
      eventDate,
      startTime,
      gatheringTime,
      location,
      setlistId,
      memo,
      notifyMembers,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-5">
      <div className="space-y-2">
        <h2 className="section-title">{mode === "create" ? "일정 만들기" : "일정 수정"}</h2>
        <p className="field-help">
          팀 캘린더는 예배와 연습 일정을 공유하고 가능 여부를 확인하는 곳입니다. 실제 섬김 팀원 확정은 콘티 안에서 지정해 주세요.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="field-label">일정 제목</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="field-input"
          placeholder="6월 21일 주일예배"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="field-label">일정 유형</span>
          <select value={eventType} onChange={(event) => setEventType(event.target.value as TeamCalendarEventType)} className="field-input">
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {TEAM_CALENDAR_EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="field-label">{isRecurring ? "반복 시작일" : "날짜"}</span>
          <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="field-input" required />
        </label>

        <label className="block space-y-1">
          <span className="field-label">시작/예배 시간</span>
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="field-input" />
        </label>

        <label className="block space-y-1">
          <span className="field-label">모임 시간</span>
          <input type="time" value={gatheringTime} onChange={(event) => setGatheringTime(event.target.value)} className="field-input" />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="field-label">장소</span>
        <input value={location} onChange={(event) => setLocation(event.target.value)} className="field-input" placeholder="본당, 연습실" />
      </label>

      {mode === "create" ? (
        <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-4" open={isRecurring}>
          <summary className="cursor-pointer text-sm font-black text-slate-950">반복 옵션</summary>
          <div className="mt-4 space-y-4">
            <label className="block space-y-1">
              <span className="field-label">반복</span>
              <select value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value as RecurrenceType)} className="field-input">
                {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {isRecurring ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">
                    <input
                      type="radio"
                      checked={recurrenceEndMode === "count"}
                      onChange={() => setRecurrenceEndMode("count")}
                      className="h-4 w-4 text-blue-600"
                    />
                    생성 횟수로 만들기
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">
                    <input
                      type="radio"
                      checked={recurrenceEndMode === "endDate"}
                      onChange={() => setRecurrenceEndMode("endDate")}
                      className="h-4 w-4 text-blue-600"
                    />
                    종료일로 만들기
                  </label>
                </div>

                {recurrenceEndMode === "count" ? (
                  <label className="block space-y-1">
                    <span className="field-label">생성 횟수</span>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={recurrenceCount}
                      onChange={(event) => setRecurrenceCount(Number(event.target.value))}
                      className="field-input"
                    />
                  </label>
                ) : (
                  <label className="block space-y-1">
                    <span className="field-label">반복 종료일</span>
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(event) => setRecurrenceEndDate(event.target.value)}
                      className="field-input"
                    />
                  </label>
                )}

                <div className="rounded-xl border border-blue-100 bg-white p-4">
                  <p className="text-sm font-black text-slate-950">반복 일정 미리보기</p>
                  {recurrenceDates.length === 0 ? (
                    <p className="mt-3 text-sm leading-6 text-slate-500">생성할 날짜가 없습니다.</p>
                  ) : (
                    <>
                      <div className="mt-3 grid gap-2">
                        {recurrenceDates.slice(0, 10).map((date, index) => (
                          <div key={`${date}-${index}`} className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-900">
                            {formatKoreanDate(date)} {title || "일정"}
                          </div>
                        ))}
                      </div>
                      {recurrenceDates.length > 10 ? (
                        <p className="mt-2 text-xs font-bold text-slate-500">외 {recurrenceDates.length - 10}개 일정이 더 생성됩니다.</p>
                      ) : null}
                      <p className={`mt-3 text-xs font-bold ${isOverLimit ? "text-rose-600" : "text-slate-500"}`}>
                        총 {recurrenceDates.length}개
                        {isOverLimit ? " · 한 번에 최대 60개의 반복 일정만 만들 수 있습니다." : ""}
                      </p>
                    </>
                  )}
                </div>

                <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                  반복 일정은 콘티 연결 없이 생성됩니다. 각 예배 콘티는 일정 생성 후 개별 일정에서 따로 연결해 주세요.
                </p>
              </>
            ) : null}
          </div>
        </details>
      ) : null}

      {!isRecurring ? (
        <label className="block space-y-1">
          <span className="field-label">연결할 콘티</span>
          <select value={setlistId} onChange={(event) => setSetlistId(event.target.value)} className="field-input">
            <option value="">연결하지 않음</option>
            {setlists.map((setlist) => (
              <option key={setlist.id} value={setlist.id}>
                {setlist.title || "제목 없는 콘티"} {setlist.worshipDate ? `· ${setlist.worshipDate}` : ""}
              </option>
            ))}
          </select>
          <span className="field-help">일정과 콘티를 연결하면 팀원이 일정 상세에서 콘티를 바로 열 수 있습니다.</span>
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="field-label">메모</span>
        <textarea
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          className="field-input min-h-28 resize-y leading-7"
          placeholder="모임 시간, 준비물, 연습 포인트를 적어주세요."
        />
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm font-bold text-blue-950">
        <input
          type="checkbox"
          checked={notifyMembers}
          onChange={(event) => setNotifyMembers(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-blue-200 text-blue-600"
        />
        <span>
          팀원들에게 알림 보내기
          <span className="mt-1 block text-xs font-semibold leading-5 text-blue-800">
            {mode === "create" ? "새 일정 알림이 전송됩니다." : "수정사항을 팀원에게 알릴 때만 체크해 주세요."}
          </span>
        </span>
      </label>

      {recurrenceError ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{recurrenceError}</p> : null}

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "저장 중" : isRecurring ? "반복 일정 생성" : mode === "create" ? "일정 등록" : "수정 저장"}
      </button>
    </form>
  );
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatKoreanDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
