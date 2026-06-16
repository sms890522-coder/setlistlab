import { sendPushToUsers, type PushPayload } from "@/lib/server/push";
import { NextResponse } from "next/server";

type SendPushRequest = {
  userIds?: unknown;
  payload?: Partial<PushPayload>;
};

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_API_SECRET;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!expectedSecret) {
    return NextResponse.json({ error: "푸시 발송 서버 비밀키가 설정되지 않았습니다." }, { status: 503 });
  }

  if (!token || token !== expectedSecret) {
    return NextResponse.json({ error: "푸시 발송 권한이 없습니다." }, { status: 401 });
  }

  let body: SendPushRequest;
  try {
    body = (await request.json()) as SendPushRequest;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const userIds = Array.isArray(body.userIds) ? body.userIds.filter((value): value is string => typeof value === "string") : [];
  const payload = body.payload;

  if (userIds.length === 0) {
    return NextResponse.json({ error: "알림을 보낼 사용자가 없습니다." }, { status: 400 });
  }

  if (!payload?.title || typeof payload.title !== "string") {
    return NextResponse.json({ error: "알림 제목이 필요합니다." }, { status: 400 });
  }

  try {
    const result = await sendPushToUsers(userIds, {
      title: payload.title,
      body: typeof payload.body === "string" ? payload.body : undefined,
      url: typeof payload.url === "string" ? payload.url : undefined,
      icon: typeof payload.icon === "string" ? payload.icon : undefined,
      badge: typeof payload.badge === "string" ? payload.badge : undefined,
      tag: typeof payload.tag === "string" ? payload.tag : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "푸시 알림을 보내지 못했습니다." },
      { status: 500 },
    );
  }
}
