import { isWebPushConfigured, sendPushToUsers } from "@/lib/server/push";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "서버 푸시 알림 환경변수가 아직 준비되지 않았습니다." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const result = await sendPushToUsers([user.id], {
      title: "콘티연습실 테스트 알림",
      body: "휴대폰 푸시 알림이 정상 연결되었습니다.",
      url: "/settings/notifications",
      tag: `push-test-${user.id}`,
    });

    if (result.subscriptions === 0) {
      return NextResponse.json({ error: "저장된 휴대폰 알림 구독이 없습니다. 알림을 다시 연결해 주세요." }, { status: 404 });
    }

    if (result.sent === 0) {
      return NextResponse.json({ error: "테스트 알림 발송에 실패했습니다. VAPID 키와 구독 상태를 확인해 주세요.", result }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "테스트 알림을 보내지 못했습니다." },
      { status: 500 },
    );
  }
}
