import {
  AnnouncementApiError,
  archiveAdminAnnouncement,
  getAdminAnnouncement,
  updateAdminAnnouncement,
} from "@/lib/server/announcements";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await getAdminAnnouncement(request, id));
  } catch (error) {
    if (error instanceof AnnouncementApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "새소식을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    return NextResponse.json(await updateAdminAnnouncement(request, id, body));
  } catch (error) {
    if (error instanceof AnnouncementApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "새소식을 수정하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await archiveAdminAnnouncement(request, id));
  } catch (error) {
    if (error instanceof AnnouncementApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "새소식을 보관 처리하지 못했습니다." },
      { status: 500 },
    );
  }
}
