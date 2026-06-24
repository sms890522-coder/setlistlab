import { createPresignedRecordingUpload, RecordingApiError } from "@/lib/server/recordings";
import { NextResponse } from "next/server";

type PresignUploadRequest = {
  sessionId?: string;
  guideTrackId?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  part?: string;
  title?: string;
  notes?: string;
  deviceLabel?: string;
  recordingOffsetMs?: number;
  latencyOffsetMs?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PresignUploadRequest;
    if (!body.sessionId || !body.guideTrackId || !body.mimeType || !body.sizeBytes) {
      return NextResponse.json({ error: "녹음 업로드 정보가 부족합니다." }, { status: 400 });
    }

    const result = await createPresignedRecordingUpload({
      request,
      sessionId: body.sessionId,
      guideTrackId: body.guideTrackId,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      durationSeconds: body.durationSeconds,
      part: body.part,
      title: body.title,
      notes: body.notes,
      deviceLabel: body.deviceLabel,
      recordingOffsetMs: body.recordingOffsetMs,
      latencyOffsetMs: body.latencyOffsetMs,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RecordingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "녹음 업로드 URL을 만들지 못했습니다." },
      { status: 500 },
    );
  }
}
