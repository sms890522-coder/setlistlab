import { createRecordingReadUrl, RecordingApiError } from "@/lib/server/recordings";
import { NextResponse } from "next/server";

type PresignReadRequest = {
  trackId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PresignReadRequest;
    if (!body.trackId) {
      return NextResponse.json({ error: "녹음 트랙 정보가 필요합니다." }, { status: 400 });
    }

    const result = await createRecordingReadUrl({
      request,
      trackId: body.trackId,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RecordingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "녹음 재생 URL을 만들지 못했습니다." },
      { status: 500 },
    );
  }
}
