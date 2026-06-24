import { completeRecordingUpload, RecordingApiError } from "@/lib/server/recordings";
import { NextResponse } from "next/server";

type CompleteUploadRequest = {
  trackId?: string;
  objectKey?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  mimeType?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompleteUploadRequest;
    if (!body.trackId || !body.objectKey) {
      return NextResponse.json({ error: "녹음 완료 정보가 부족합니다." }, { status: 400 });
    }

    const result = await completeRecordingUpload({
      request,
      trackId: body.trackId,
      objectKey: body.objectKey,
      sizeBytes: body.sizeBytes,
      durationSeconds: body.durationSeconds,
      mimeType: body.mimeType,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RecordingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "녹음 업로드를 완료하지 못했습니다." },
      { status: 500 },
    );
  }
}
