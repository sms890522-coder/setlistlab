import { markRecordingTrackDeleted, RecordingApiError } from "@/lib/server/recordings";
import { NextResponse } from "next/server";

type DeleteRecordingRequest = {
  trackId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeleteRecordingRequest;
    if (!body.trackId) {
      return NextResponse.json({ error: "삭제할 녹음 정보가 없습니다." }, { status: 400 });
    }

    const result = await markRecordingTrackDeleted({
      request,
      trackId: body.trackId,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RecordingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "녹음을 삭제하지 못했습니다." },
      { status: 500 },
    );
  }
}
