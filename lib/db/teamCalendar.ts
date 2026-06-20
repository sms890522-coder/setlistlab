"use client";

import { getCurrentUser } from "@/lib/auth";
import { generateRecurringDates, type RecurrenceType } from "@/lib/calendar/recurrence";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Setlist } from "@/lib/types";
import { dispatchPushEvent } from "./pushEvents";
import { getApprovedMemberships, getTeamMembers, type TeamMembership } from "./teamMemberships";

export type TeamCalendarEventType = "worship" | "practice" | "event" | "etc";
export type AvailabilityStatus = "available" | "unavailable" | "maybe" | "unknown";

export type TeamCalendarEvent = {
  id: string;
  teamId: string;
  setlistId?: string;
  title: string;
  eventType: TeamCalendarEventType;
  eventDate: string;
  startTime?: string;
  gatheringTime?: string;
  location?: string;
  memo?: string;
  recurringGroupId?: string;
  recurringRule?: string;
  recurringIndex?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamEventAvailability = {
  id: string;
  eventId: string;
  teamId: string;
  userId: string;
  status: AvailabilityStatus;
  memo?: string;
  availableRoles: string[];
  createdAt: string;
  updatedAt: string;
  member?: TeamMembership;
};

export type AvailabilitySummary = Record<AvailabilityStatus, number>;

export type TeamCalendarEventWithAvailability = TeamCalendarEvent & {
  summary: AvailabilitySummary;
  myAvailability?: TeamEventAvailability;
  availabilities: TeamEventAvailability[];
  members: TeamMembership[];
  setlist?: Pick<Setlist, "id" | "title" | "worshipDate" | "serviceName">;
  teamLabel?: string;
};

export type TeamCalendarEventInput = {
  teamId: string;
  setlistId?: string;
  title: string;
  eventType: TeamCalendarEventType;
  eventDate: string;
  startTime?: string;
  gatheringTime?: string;
  location?: string;
  memo?: string;
  notifyMembers?: boolean;
};

export type RecurringTeamCalendarEventInput = TeamCalendarEventInput & {
  recurrenceType: Exclude<RecurrenceType, "none">;
  recurrenceEndDate?: string;
  recurrenceCount?: number;
};

export type RecurringTeamCalendarEventResult = {
  totalCount: number;
  createdCount: number;
  skippedCount: number;
  createdEvents: TeamCalendarEventWithAvailability[];
  skippedDates: string[];
};

type TeamCalendarEventRow = {
  id: string;
  team_id: string;
  setlist_id: string | null;
  title: string;
  event_type: TeamCalendarEventType;
  event_date: string;
  start_time: string | null;
  gathering_time: string | null;
  location: string | null;
  memo: string | null;
  recurring_group_id: string | null;
  recurring_rule: string | null;
  recurring_index: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type TeamEventAvailabilityRow = {
  id: string;
  event_id: string;
  team_id: string;
  user_id: string;
  status: AvailabilityStatus;
  memo: string | null;
  available_roles: string[] | null;
  created_at: string;
  updated_at: string;
};

type SetlistSummaryRow = {
  id: string;
  title: string;
  worship_date: string | null;
  service_name: string | null;
};

export const TEAM_CALENDAR_EVENT_TYPE_LABELS: Record<TeamCalendarEventType, string> = {
  worship: "예배",
  practice: "연습",
  event: "행사",
  etc: "기타",
};

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: "가능",
  unavailable: "어려움",
  maybe: "미정",
  unknown: "미응답",
};

export async function getTeamCalendarEvents(teamId: string, year: number, month: number) {
  const { start, end } = getMonthRange(year, month);
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_calendar_events")
    .select("*")
    .eq("team_id", teamId)
    .gte("event_date", start)
    .lte("event_date", end)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true })
    .returns<TeamCalendarEventRow[]>();

  if (error) throw new Error(error.message || "팀 캘린더를 불러오지 못했습니다.");
  return attachAvailability(teamId, data ?? []);
}

export async function getTeamCalendarEvent(eventId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_calendar_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<TeamCalendarEventRow>();

  if (error) throw new Error(error.message || "팀 일정을 불러오지 못했습니다.");
  if (!data) return null;

  const [event] = await attachAvailability(data.team_id, [data]);
  return event ?? null;
}

export async function createTeamCalendarEvent(input: TeamCalendarEventInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const payload = normalizeEventInput(input);
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_calendar_events")
    .insert({
      team_id: payload.teamId,
      setlist_id: payload.setlistId || null,
      title: payload.title,
      event_type: payload.eventType,
      event_date: payload.eventDate,
      start_time: payload.startTime || null,
      gathering_time: payload.gatheringTime || null,
      location: payload.location || null,
      memo: payload.memo || null,
      created_by: user.id,
    })
    .select("*")
    .single<TeamCalendarEventRow>();

  if (error) throw new Error(error.message || "팀 일정을 만들지 못했습니다.");

  if (payload.notifyMembers) {
    const notified = await createTeamCalendarNotifications(data.id, "team_calendar_event_created").catch(() => false);
    if (notified) {
      void dispatchPushEvent({ eventType: "team_calendar_event_created", eventId: data.id });
    }
  }

  const [event] = await attachAvailability(data.team_id, [data]);
  return event;
}

export async function createRecurringTeamCalendarEvents(
  input: RecurringTeamCalendarEventInput,
): Promise<RecurringTeamCalendarEventResult> {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const payload = normalizeEventInput(input);
  const dates = generateRecurringDates({
    startDate: payload.eventDate,
    recurrenceType: input.recurrenceType,
    endDate: input.recurrenceEndDate,
    count: input.recurrenceCount,
    maxCount: 61,
  });

  if (dates.length === 0) throw new Error("생성할 반복 일정 날짜가 없습니다.");
  if (dates.length > 60) throw new Error("한 번에 최대 60개의 반복 일정만 만들 수 있습니다.");

  const supabase = getSupabaseBrowserClient();
  const { data: duplicates, error: duplicateError } = await supabase
    .from("team_calendar_events")
    .select("event_date")
    .eq("team_id", payload.teamId)
    .eq("title", payload.title)
    .eq("event_type", payload.eventType)
    .in("event_date", dates)
    .returns<Array<{ event_date: string }>>();

  if (duplicateError) throw new Error(duplicateError.message || "기존 일정을 확인하지 못했습니다.");

  const duplicatedDates = new Set((duplicates ?? []).map((row) => row.event_date));
  const recurringGroupId = createRecurringGroupId();
  const rows = dates
    .map((date, index) => ({ date, index }))
    .filter(({ date }) => !duplicatedDates.has(date))
    .map(({ date, index }) => ({
      team_id: payload.teamId,
      setlist_id: null,
      title: payload.title,
      event_type: payload.eventType,
      event_date: date,
      start_time: payload.startTime || null,
      gathering_time: payload.gatheringTime || null,
      location: payload.location || null,
      memo: payload.memo || null,
      recurring_group_id: recurringGroupId,
      recurring_rule: input.recurrenceType,
      recurring_index: index + 1,
      created_by: user.id,
    }));

  if (rows.length === 0) {
    return {
      totalCount: dates.length,
      createdCount: 0,
      skippedCount: dates.length,
      createdEvents: [],
      skippedDates: dates,
    };
  }

  const { data, error } = await supabase.from("team_calendar_events").insert(rows).select("*").returns<TeamCalendarEventRow[]>();
  if (error) throw new Error(error.message || "반복 일정을 생성하지 못했습니다.");

  if (payload.notifyMembers) {
    const notified = await createTeamCalendarRecurringNotifications(recurringGroupId).catch(() => false);
    if (notified) {
      void dispatchPushEvent({ eventType: "team_calendar_recurring_events_created", recurringGroupId });
    }
  }

  return {
    totalCount: dates.length,
    createdCount: data?.length ?? 0,
    skippedCount: dates.length - (data?.length ?? 0),
    createdEvents: await attachAvailability(payload.teamId, data ?? []),
    skippedDates: dates.filter((date) => duplicatedDates.has(date)),
  };
}

export async function updateTeamCalendarEvent(eventId: string, input: TeamCalendarEventInput) {
  const payload = normalizeEventInput(input);
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_calendar_events")
    .update({
      setlist_id: payload.setlistId || null,
      title: payload.title,
      event_type: payload.eventType,
      event_date: payload.eventDate,
      start_time: payload.startTime || null,
      gathering_time: payload.gatheringTime || null,
      location: payload.location || null,
      memo: payload.memo || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .select("*")
    .single<TeamCalendarEventRow>();

  if (error) throw new Error(error.message || "팀 일정을 수정하지 못했습니다.");

  if (payload.notifyMembers) {
    const notified = await createTeamCalendarNotifications(data.id, "team_calendar_event_updated").catch(() => false);
    if (notified) {
      void dispatchPushEvent({ eventType: "team_calendar_event_updated", eventId: data.id });
    }
  }

  const [event] = await attachAvailability(data.team_id, [data]);
  return event;
}

export async function deleteTeamCalendarEvent(eventId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("team_calendar_events").delete().eq("id", eventId);

  if (error) throw new Error(error.message || "팀 일정을 삭제하지 못했습니다.");
}

export async function upsertMyAvailability(
  eventId: string,
  status: AvailabilityStatus,
  memo?: string,
  availableRoles: string[] = [],
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const event = await getTeamCalendarEvent(eventId);
  if (!event) throw new Error("팀 일정을 찾을 수 없습니다.");

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_event_availability")
    .upsert(
      {
        event_id: event.id,
        team_id: event.teamId,
        user_id: user.id,
        status,
        memo: memo?.trim() || null,
        available_roles: availableRoles.length > 0 ? availableRoles : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,user_id" },
    )
    .select("*")
    .single<TeamEventAvailabilityRow>();

  if (error) throw new Error(error.message || "가능 여부를 저장하지 못했습니다.");
  return rowToAvailability(data);
}

export async function sendTeamCalendarAvailabilityReminder(eventId: string) {
  const notified = await createTeamCalendarReminderNotifications(eventId);
  if (notified) {
    void dispatchPushEvent({ eventType: "team_calendar_availability_reminder", eventId });
  }
  return notified;
}

export async function getEventAvailabilitySummary(eventId: string) {
  const event = await getTeamCalendarEvent(eventId);
  if (!event) throw new Error("팀 일정을 찾을 수 없습니다.");
  return event.summary;
}

export async function getLinkedCalendarEventsForSetlist(setlistId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_calendar_events")
    .select("*")
    .eq("setlist_id", setlistId)
    .order("event_date", { ascending: true })
    .returns<TeamCalendarEventRow[]>();

  if (error) throw new Error(error.message || "연결된 팀 일정을 불러오지 못했습니다.");
  const rows = data ?? [];
  const teamIds = Array.from(new Set(rows.map((row) => row.team_id)));
  const grouped = await Promise.all(teamIds.map((teamId) => attachAvailability(teamId, rows.filter((row) => row.team_id === teamId))));
  return grouped.flat();
}

export async function getMyUpcomingTeamEvents() {
  const user = await getCurrentUser();
  if (!user) return [];

  const memberships = await getApprovedMemberships();
  const teamIds = Array.from(new Set(memberships.map((membership) => membership.teamId)));
  if (teamIds.length === 0) return [];

  const today = formatDateInput(new Date());
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_calendar_events")
    .select("*")
    .in("team_id", teamIds)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(12)
    .returns<TeamCalendarEventRow[]>();

  if (error) throw new Error(error.message || "내 팀 일정을 불러오지 못했습니다.");

  const teamById = new Map(memberships.map((membership) => [membership.teamId, membership.team]));
  const grouped = await Promise.all(
    Array.from(new Set((data ?? []).map((row) => row.team_id))).map((teamId) =>
      attachAvailability(teamId, (data ?? []).filter((row) => row.team_id === teamId)),
    ),
  );

  return grouped
    .flat()
    .map((event) => ({
      ...event,
      teamLabel: [teamById.get(event.teamId)?.churchName, teamById.get(event.teamId)?.teamName].filter(Boolean).join(" · "),
    }));
}

async function attachAvailability(teamId: string, rows: TeamCalendarEventRow[]) {
  const events = rows.map(rowToEvent);
  if (events.length === 0) return events as TeamCalendarEventWithAvailability[];

  const eventIds = events.map((event) => event.id);
  const setlistIds = Array.from(new Set(events.map((event) => event.setlistId).filter(Boolean))) as string[];
  const [members, availabilities, setlists, user] = await Promise.all([
    getTeamMembers(teamId),
    getAvailabilities(eventIds),
    getSetlistSummaries(setlistIds),
    getCurrentUser(),
  ]);

  const memberByUserId = new Map(members.map((member) => [member.userId, member]));
  const setlistById = new Map(setlists.map((setlist) => [setlist.id, setlist]));
  const availabilitiesByEventId = new Map<string, TeamEventAvailability[]>();

  for (const availability of availabilities) {
    const withMember = { ...availability, member: memberByUserId.get(availability.userId) };
    const list = availabilitiesByEventId.get(availability.eventId) ?? [];
    list.push(withMember);
    availabilitiesByEventId.set(availability.eventId, list);
  }

  return events.map((event) => {
    const eventAvailabilities = availabilitiesByEventId.get(event.id) ?? [];
    return {
      ...event,
      summary: createSummary(members, eventAvailabilities),
      myAvailability: user ? eventAvailabilities.find((availability) => availability.userId === user.id) : undefined,
      availabilities: eventAvailabilities,
      members,
      setlist: event.setlistId ? setlistById.get(event.setlistId) : undefined,
    };
  });
}

async function getAvailabilities(eventIds: string[]) {
  if (eventIds.length === 0) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_event_availability")
    .select("*")
    .in("event_id", eventIds)
    .returns<TeamEventAvailabilityRow[]>();

  if (error) throw new Error(error.message || "가능 여부를 불러오지 못했습니다.");
  return (data ?? []).map(rowToAvailability);
}

async function getSetlistSummaries(setlistIds: string[]) {
  if (setlistIds.length === 0) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlists")
    .select("id,title,worship_date,service_name")
    .in("id", setlistIds)
    .returns<SetlistSummaryRow[]>();

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    worshipDate: row.worship_date ?? "",
    serviceName: row.service_name ?? "",
  }));
}

async function createTeamCalendarNotifications(
  eventId: string,
  eventType: "team_calendar_event_created" | "team_calendar_event_updated",
) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("create_team_calendar_event_notifications", {
    p_event_id: eventId,
    p_event_type: eventType,
  });

  if (error) throw new Error(error.message || "팀 일정 알림을 만들지 못했습니다.");
  return Boolean(data);
}

async function createTeamCalendarReminderNotifications(eventId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("create_team_calendar_availability_reminder_notifications", {
    p_event_id: eventId,
  });

  if (error) throw new Error(error.message || "미응답 알림을 만들지 못했습니다.");
  return Boolean(data);
}

async function createTeamCalendarRecurringNotifications(recurringGroupId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("create_team_calendar_recurring_events_notifications", {
    p_recurring_group_id: recurringGroupId,
  });

  if (error) throw new Error(error.message || "반복 일정 알림을 만들지 못했습니다.");
  return Boolean(data);
}

function createSummary(members: TeamMembership[], availabilities: TeamEventAvailability[]): AvailabilitySummary {
  const summary: AvailabilitySummary = {
    available: 0,
    unavailable: 0,
    maybe: 0,
    unknown: 0,
  };
  const availabilityByUserId = new Map(availabilities.map((availability) => [availability.userId, availability]));

  for (const member of members) {
    const status = availabilityByUserId.get(member.userId)?.status ?? "unknown";
    summary[status] += 1;
  }

  return summary;
}

function normalizeEventInput(input: TeamCalendarEventInput) {
  const title = input.title.trim();
  if (!title) throw new Error("일정 제목을 입력해 주세요.");
  if (!input.eventDate) throw new Error("일정 날짜를 선택해 주세요.");

  return {
    ...input,
    title,
    eventType: input.eventType || "worship",
    setlistId: input.setlistId || undefined,
    startTime: normalizeTime(input.startTime),
    gatheringTime: normalizeTime(input.gatheringTime),
    location: input.location?.trim() || "",
    memo: input.memo?.trim() || "",
    notifyMembers: input.notifyMembers ?? true,
  };
}

function normalizeTime(value?: string) {
  if (!value) return "";
  return value.slice(0, 5);
}

function getMonthRange(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  return {
    start: formatDateInput(startDate),
    end: formatDateInput(endDate),
  };
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rowToEvent(row: TeamCalendarEventRow): TeamCalendarEvent {
  return {
    id: row.id,
    teamId: row.team_id,
    setlistId: row.setlist_id ?? undefined,
    title: row.title,
    eventType: row.event_type,
    eventDate: row.event_date,
    startTime: row.start_time?.slice(0, 5) ?? undefined,
    gatheringTime: row.gathering_time?.slice(0, 5) ?? undefined,
    location: row.location ?? undefined,
    memo: row.memo ?? undefined,
    recurringGroupId: row.recurring_group_id ?? undefined,
    recurringRule: row.recurring_rule ?? undefined,
    recurringIndex: row.recurring_index ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createRecurringGroupId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const template = "10000000-1000-4000-8000-100000000000";
  return template.replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.random() * 16) >> (Number(char) / 4)).toString(16),
  );
}

function rowToAvailability(row: TeamEventAvailabilityRow): TeamEventAvailability {
  return {
    id: row.id,
    eventId: row.event_id,
    teamId: row.team_id,
    userId: row.user_id,
    status: row.status,
    memo: row.memo ?? undefined,
    availableRoles: row.available_roles ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
