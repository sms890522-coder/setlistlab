import {
  AnnouncementApiError,
  createAdminAnnouncement,
  listAdminAnnouncements,
} from "@/lib/server/announcements";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    return NextResponse.json(await listAdminAnnouncements(request));
  } catch (error) {
    if (error instanceof AnnouncementApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "새소식 관리 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await createAdminAnnouncement(request, body));
  } catch (error) {
    if (error instanceof AnnouncementApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "새소식을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
