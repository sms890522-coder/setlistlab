import { NextResponse } from "next/server";
import { createRecordingSessionWithLimits, RecordingApiError } from "@/lib/server/recordings";

type CreateRecordingSessionRequest = {
  teamId?: string | null;
  setlistId?: string;
  songId?: string;
  guideTrackId?: string;
  title?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateRecordingSessionRequest;
    if (!body.setlistId || !body.songId || !body.guideTrackId || !body.title) {
      return NextResponse.json({ error: "녹음실 생성 정보가 부족합니다." }, { status: 400 });
    }

    const result = await createRecordingSessionWithLimits({
      request,
      teamId: body.teamId ?? null,
      setlistId: body.setlistId,
      songId: body.songId,
      guideTrackId: body.guideTrackId,
      title: body.title,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RecordingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "녹음실을 만들지 못했습니다." },
      { status: 500 },
    );
  }
}
