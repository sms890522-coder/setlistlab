import { AnnouncementApiError, listPublishedAnnouncements } from "@/lib/server/announcements";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    return NextResponse.json(await listPublishedAnnouncements(request));
  } catch (error) {
    if (error instanceof AnnouncementApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "새소식 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
