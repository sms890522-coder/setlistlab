"use client";

import { getCurrentSession } from "@/lib/auth";
import type { RecordingInputType, TeamRecordingTrack } from "@/lib/db/teamRecordingStudio";

type UploadRecordingTrackInput = {
  sessionId: string;
  guideTrackId: string;
  blob: Blob;
  durationSeconds: number;
  part?: string;
  title?: string;
  notes?: string;
  inputType?: RecordingInputType;
  deviceLabel?: string;
  recordingOffsetMs?: number;
  latencyOffsetMs?: number;
};

type PresignUploadResponse = {
  trackId: string;
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
};

type CompleteUploadResponse = {
  track: TeamRecordingTrack;
};

export async function uploadRecordingTrack(input: UploadRecordingTrackInput) {
  const session = await getCurrentSession();
  const token = session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");

  const mimeType = input.blob.type || "audio/webm";
  const presigned = await postJson<PresignUploadResponse>(
    "/api/recordings/presign-upload",
    {
      sessionId: input.sessionId,
      guideTrackId: input.guideTrackId,
      mimeType,
      sizeBytes: input.blob.size,
      durationSeconds: input.durationSeconds,
      part: input.part,
      title: input.title,
      notes: input.notes,
      inputType: input.inputType,
      deviceLabel: input.deviceLabel,
      recordingOffsetMs: input.recordingOffsetMs ?? 0,
      latencyOffsetMs: input.latencyOffsetMs ?? 0,
    },
    token,
  );

  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    body: input.blob,
  });

  if (!uploadResponse.ok) {
    throw new Error("녹음 파일을 R2에 업로드하지 못했습니다. R2 CORS 설정을 확인해 주세요.");
  }

  const completed = await postJson<CompleteUploadResponse>(
    "/api/recordings/complete-upload",
    {
      trackId: presigned.trackId,
      objectKey: presigned.objectKey,
      sizeBytes: input.blob.size,
      durationSeconds: input.durationSeconds,
      mimeType,
    },
    token,
  );

  return completed.track;
}

export async function getRecordingReadUrl(trackId: string) {
  const session = await getCurrentSession();
  const token = session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");

  return postJson<{ readUrl: string; expiresIn: number }>("/api/recordings/presign-read", { trackId }, token);
}

export async function markRecordingTrackDeleted(trackId: string) {
  const session = await getCurrentSession();
  const token = session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");

  return postJson<{ track: TeamRecordingTrack }>("/api/recordings/delete", { trackId }, token);
}

async function postJson<T>(url: string, body: unknown, token: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = typeof payload.error === "string" ? payload.error : "요청을 처리하지 못했습니다.";
    throw new Error(errorMessage);
  }

  return payload as T;
}
