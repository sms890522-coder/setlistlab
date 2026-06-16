import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let webPushConfigured = false;

export function isWebPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return { sent: 0, failed: 0, removed: 0, subscriptions: 0 };

  configureWebPush();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .in("user_id", uniqueUserIds)
    .returns<PushSubscriptionRow[]>();

  if (error) throw new Error(error.message || "푸시 구독 정보를 불러오지 못했습니다.");

  let sent = 0;
  let failed = 0;
  let removed = 0;
  const subscriptions = data?.length ?? 0;

  await Promise.all(
    (data ?? []).map(async (subscriptionRow) => {
      const subscription: WebPushSubscription = {
        endpoint: subscriptionRow.endpoint,
        keys: {
          p256dh: subscriptionRow.p256dh,
          auth: subscriptionRow.auth,
        },
      };

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            icon: "/icons/icon-192.png",
            badge: "/icons/badge-72.png",
            ...payload,
          }),
        );
        sent += 1;
      } catch (error) {
        const statusCode = getStatusCode(error);
        if (statusCode === 404 || statusCode === 410) {
          removed += 1;
          await supabase.from("push_subscriptions").delete().eq("id", subscriptionRow.id);
          return;
        }

        failed += 1;
      }
    }),
  );

  return { sent, failed, removed, subscriptions };
}

function configureWebPush() {
  if (!isWebPushConfigured()) {
    throw new Error("푸시 알림 환경변수가 준비되지 않았습니다.");
  }

  if (webPushConfigured) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  webPushConfigured = true;
}

function getStatusCode(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === "number" ? statusCode : undefined;
  }

  return undefined;
}
