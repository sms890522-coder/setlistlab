"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Setlist } from "@/lib/types";
import { getCloudSetlists } from "./setlists";
import { getTeamCalendarEvent, type TeamCalendarEventWithAvailability } from "./teamCalendar";
import { getPendingJoinRequests, getTeamMembers, type TeamMembership } from "./teamMemberships";
import { getTeamPosts, type TeamPost } from "./teamPosts";

export type TeamDashboardChatPreview = {
  id: string;
  message: string;
  userId: string;
  createdAt: string;
};

export type TeamDashboardData = {
  teamSetlists: Setlist[];
  upcomingSetlist?: Setlist;
  upcomingEvents: TeamCalendarEventWithAvailability[];
  unansweredEvents: TeamCalendarEventWithAvailability[];
  recentPosts: TeamPost[];
  unreadPostsCount: number;
  unreadNotificationsCount: number;
  unreadChatCount: number;
  recentChatMessage?: TeamDashboardChatPreview;
  members: TeamMembership[];
  pendingMembersCount: number;
  onboardingStatus: {
    hasSetlist: boolean;
    hasInvitedMembers: boolean;
    hasPost: boolean;
    hasCalendarEvent: boolean;
    hasUnansweredAvailability: boolean;
    shouldShowLeaderChecklist: boolean;
    shouldShowMemberGuide: boolean;
  };
};

type CalendarEventRow = {
  id: string;
};

type ChatMessageRow = {
  id: string;
  user_id: string;
  message: string;
  read_by: string[] | null;
  created_at: string;
};

export async function getTeamDashboard(teamId: string, myMembership: TeamMembership): Promise<TeamDashboardData> {
  const user = await getCurrentUser();
  const today = formatDateInput(new Date());
  const supabase = getSupabaseBrowserClient();

  const [
    members,
    allSetlists,
    recentPosts,
    upcomingEventIds,
    unreadNotificationsCount,
    chatMessages,
    pendingRequests,
  ] = await Promise.all([
    getTeamMembers(teamId),
    getCloudSetlists(),
    getTeamPosts(teamId),
    getUpcomingEventIds(teamId, today),
    getUnreadTeamNotificationCount(teamId),
    getRecentChatMessages(teamId),
    myMembership.role === "owner" ? getPendingJoinRequests(teamId).catch(() => []) : Promise.resolve([]),
  ]);

  const upcomingEvents = (
    await Promise.all(upcomingEventIds.map((row) => getTeamCalendarEvent(row.id).catch(() => null)))
  ).filter(Boolean) as TeamCalendarEventWithAvailability[];
  const teamSetlists = allSetlists
    .filter((setlist) => setlist.teamId === teamId)
    .sort(compareSetlistsByUpcomingDate);
  const upcomingSetlist = pickUpcomingSetlist(teamSetlists, today);
  const unansweredEvents = upcomingEvents.filter((event) => {
    const status = event.myAvailability?.status ?? "unknown";
    return status === "unknown";
  });
  const unreadPostsCount = recentPosts.filter((post) => !post.hasRead).length;
  const unreadChatCount = user
    ? chatMessages.filter((message) => message.user_id !== user.id && !(message.read_by ?? []).includes(user.id)).length
    : 0;
  const recentChatMessage = chatMessages[0]
    ? {
        id: chatMessages[0].id,
        message: chatMessages[0].message,
        userId: chatMessages[0].user_id,
        createdAt: chatMessages[0].created_at,
      }
    : undefined;

  const hasSetlist = teamSetlists.length > 0;
  const hasInvitedMembers = members.length > 1;
  const hasPost = recentPosts.length > 0;
  const hasCalendarEvent = upcomingEvents.length > 0;
  const hasUnansweredAvailability = unansweredEvents.length > 0;

  return {
    teamSetlists,
    upcomingSetlist,
    upcomingEvents,
    unansweredEvents,
    recentPosts: recentPosts.slice(0, 3),
    unreadPostsCount,
    unreadNotificationsCount,
    unreadChatCount,
    recentChatMessage,
    members,
    pendingMembersCount: pendingRequests.length,
    onboardingStatus: {
      hasSetlist,
      hasInvitedMembers,
      hasPost,
      hasCalendarEvent,
      hasUnansweredAvailability,
      shouldShowLeaderChecklist: myMembership.role !== "member" && (!hasSetlist || !hasInvitedMembers || !hasPost || !hasCalendarEvent),
      shouldShowMemberGuide: myMembership.role === "member" && (!hasSetlist || !hasPost || !hasCalendarEvent || hasUnansweredAvailability),
    },
  };

  async function getUpcomingEventIds(teamIdValue: string, startDate: string) {
    const { data, error } = await supabase
      .from("team_calendar_events")
      .select("id")
      .eq("team_id", teamIdValue)
      .gte("event_date", startDate)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(3)
      .returns<CalendarEventRow[]>();

    if (error) return [];
    return data ?? [];
  }

  async function getUnreadTeamNotificationCount(teamIdValue: string) {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamIdValue)
      .is("read_at", null);

    if (error) return 0;
    return count ?? 0;
  }

  async function getRecentChatMessages(teamIdValue: string) {
    const { data, error } = await supabase
      .from("team_chat_messages")
      .select("id,user_id,message,read_by,created_at")
      .eq("team_id", teamIdValue)
      .order("created_at", { ascending: false })
      .limit(40)
      .returns<ChatMessageRow[]>();

    if (error) return [];
    return data ?? [];
  }
}

function pickUpcomingSetlist(setlists: Setlist[], today: string) {
  const upcoming = setlists.filter((setlist) => isFutureOrToday(setlist.worshipDate, today)).sort(compareSetlistsByUpcomingDate);
  if (upcoming[0]) return upcoming[0];

  return [...setlists].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

function compareSetlistsByUpcomingDate(a: Setlist, b: Setlist) {
  const aTime = dateSortValue(a.worshipDate);
  const bTime = dateSortValue(b.worshipDate);
  if (aTime !== bTime) return aTime - bTime;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function dateSortValue(date?: string) {
  if (!date) return Number.MAX_SAFE_INTEGER;
  const time = new Date(`${date}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function isFutureOrToday(date: string | undefined, today: string) {
  return Boolean(date && date >= today);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
