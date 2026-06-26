import { RecordingApiError, updateRecordingTrackLatencyOffset } from "@/lib/server/recordings";
import { NextResponse } from "next/server";

type UpdateRecordingMixRequest = {
  trackId?: string;
  latencyOffsetMs?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateRecordingMixRequest;
    if (!body.trackId || typeof body.latencyOffsetMs !== "number") {
      return NextResponse.json({ error: "저장할 믹스 정보가 부족합니다." }, { status: 400 });
    }

    const result = await updateRecordingTrackLatencyOffset({
      request,
      trackId: body.trackId,
      latencyOffsetMs: body.latencyOffsetMs,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RecordingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "트랙 싱크를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
