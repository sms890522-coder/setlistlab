import { AnnouncementApiError, markAnnouncementRead } from "@/lib/server/announcements";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await markAnnouncementRead(request, id));
  } catch (error) {
    if (error instanceof AnnouncementApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "새소식을 확인 처리하지 못했습니다." },
      { status: 500 },
    );
  }
}
