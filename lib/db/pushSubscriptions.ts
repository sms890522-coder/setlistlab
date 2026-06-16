"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type PushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

export async function savePushSubscription(subscription: PushSubscription) {
  if (!isSupabaseConfigured()) throw new Error("계정 저장 기능이 준비되지 않았습니다.");

  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const payload = subscription.toJSON();
  const endpoint = payload.endpoint;
  const p256dh = payload.keys?.p256dh;
  const auth = payload.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("푸시 알림 구독 정보를 읽지 못했습니다.");
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    )
    .select("*")
    .single<PushSubscriptionRow>();

  if (error) throw new Error(error.message || "휴대폰 알림 구독 정보를 저장하지 못했습니다.");
  return rowToRecord(data);
}

export async function deletePushSubscription(endpoint: string) {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  if (error) throw new Error(error.message || "휴대폰 알림 구독을 해제하지 못했습니다.");
}

export async function getMyPushSubscriptions() {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<PushSubscriptionRow[]>();

  if (error) throw new Error(error.message || "휴대폰 알림 구독 상태를 불러오지 못했습니다.");
  return (data ?? []).map(rowToRecord);
}

function rowToRecord(row: PushSubscriptionRow): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userAgent: row.user_agent ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
