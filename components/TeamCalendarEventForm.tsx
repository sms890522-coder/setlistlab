"use client";

import {
  TEAM_CALENDAR_EVENT_TYPE_LABELS,
  type TeamCalendarEvent,
  type TeamCalendarEventInput,
  type TeamCalendarEventType,
} from "@/lib/db/teamCalendar";
import type { Setlist } from "@/lib/types";
import { FormEvent, useState } from "react";

type TeamCalendarEventFormProps = {
  teamId: string;
  initialEvent?: TeamCalendarEvent;
  mode: "create" | "edit";
  setlists?: Setlist[];
  submitting?: boolean;
  onSubmit: (input: TeamCalendarEventInput) => void | Promise<void>;
};

const EVENT_TYPES: TeamCalendarEventType[] = ["worship", "practice", "event", "etc"];

export function TeamCalendarEventForm({
  teamId,
  initialEvent,
  mode,
  setlists = [],
  submitting = false,
  onSubmit,
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          <span className="field-label">날짜</span>
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

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "저장 중" : mode === "create" ? "일정 등록" : "수정 저장"}
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
