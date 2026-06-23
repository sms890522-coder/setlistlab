"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type PushEventInput =
  | { eventType: "team_chat_message"; messageId: string }
  | { eventType: "team_calendar_event_created"; eventId: string }
  | { eventType: "team_calendar_event_updated"; eventId: string }
  | { eventType: "team_calendar_availability_reminder"; eventId: string }
  | { eventType: "team_calendar_recurring_events_created"; recurringGroupId: string }
  | { eventType: "team_notice_created"; postId: string }
  | { eventType: "team_notice_updated"; postId: string }
  | { eventType: "team_notice_comment_created"; commentId: string }
  | { eventType: "team_setlist_created"; setlistId: string }
  | { eventType: "team_setlist_comment_created"; commentId: string }
  | { eventType: "team_invite_requested"; membershipId: string }
  | { eventType: "team_invite_approved"; membershipId: string };

export async function dispatchPushEvent(input: PushEventInput) {
  try {
    if (!isSupabaseConfigured() || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;
    if (!token) return;

    await fetch("/api/push/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
  } catch {
    // 휴대폰 푸시 실패가 채팅/콘티 저장 흐름을 막지 않게 둔다.
  }
}
