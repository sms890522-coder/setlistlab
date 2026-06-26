import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_RECORDING_UPLOAD_BYTES = 50 * 1024 * 1024;
export const RECORDING_PRESIGNED_EXPIRES_IN_SECONDS = 60 * 15;

export const ALLOWED_RECORDING_MIME_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
  "audio/wav",
] as const;

export type AllowedRecordingMimeType = (typeof ALLOWED_RECORDING_MIME_TYPES)[number];

let r2Client: S3Client | null = null;

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_RECORDINGS,
  );
}

export function getR2Client() {
  if (!isR2Configured()) {
    throw new Error("녹음 파일 저장소 설정이 준비되지 않았습니다.");
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: process.env.R2_REGION || "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  return r2Client;
}

export function getRecordingBucket() {
  const bucket = process.env.R2_BUCKET_RECORDINGS?.trim();
  if (!bucket) throw new Error("녹음 파일 버킷 설정이 필요합니다.");
  return bucket;
}

export function normalizeRecordingMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase().trim();
  const matched = ALLOWED_RECORDING_MIME_TYPES.find((allowed) => allowed === normalized);
  if (!matched) throw new Error("지원하지 않는 녹음 파일 형식입니다.");
  return matched;
}

export function getRecordingExtension(mimeType: string) {
  const normalized = normalizeRecordingMimeType(mimeType);
  if (normalized.includes("webm")) return "webm";
  if (normalized === "audio/mp4") return "m4a";
  if (normalized === "audio/aac") return "aac";
  if (normalized === "audio/mpeg") return "mp3";
  if (normalized === "audio/wav") return "wav";
  return "webm";
}

export function buildRecordingObjectKey(input: {
  teamId?: string | null;
  sessionId: string;
  setlistId: string;
  userId: string;
  trackId: string;
  mimeType: string;
}) {
  const ext = getRecordingExtension(input.mimeType);
  const safeTrackId = input.trackId.replace(/[^a-zA-Z0-9-]/g, "");
  const safeUserId = input.userId.replace(/[^a-zA-Z0-9-]/g, "");
  const safeSessionId = input.sessionId.replace(/[^a-zA-Z0-9-]/g, "");
  const safeSetlistId = input.setlistId.replace(/[^a-zA-Z0-9-]/g, "");

  if (input.teamId) {
    const safeTeamId = input.teamId.replace(/[^a-zA-Z0-9-]/g, "");
    return `teams/${safeTeamId}/sessions/${safeSessionId}/users/${safeUserId}/${safeTrackId}.${ext}`;
  }

  return `personal/${safeSetlistId}/users/${safeUserId}/${safeTrackId}.${ext}`;
}

export async function createPresignedUploadUrl(input: {
  objectKey: string;
  mimeType: string;
  expiresIn?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: getRecordingBucket(),
    Key: input.objectKey,
    ContentType: normalizeRecordingMimeType(input.mimeType),
  });

  return getSignedUrl(getR2Client(), command, {
    expiresIn: input.expiresIn ?? RECORDING_PRESIGNED_EXPIRES_IN_SECONDS,
  });
}

export async function createPresignedReadUrl(input: {
  objectKey: string;
  expiresIn?: number;
}) {
  const command = new GetObjectCommand({
    Bucket: getRecordingBucket(),
    Key: input.objectKey,
  });

  return getSignedUrl(getR2Client(), command, {
    expiresIn: input.expiresIn ?? RECORDING_PRESIGNED_EXPIRES_IN_SECONDS,
  });
}

export async function getR2ObjectMetadata(objectKey: string): Promise<HeadObjectCommandOutput> {
  const command = new HeadObjectCommand({
    Bucket: getRecordingBucket(),
    Key: objectKey,
  });

  return getR2Client().send(command);
}

export async function headR2Object(objectKey: string): Promise<HeadObjectCommandOutput> {
  return getR2ObjectMetadata(objectKey);
}

export async function deleteR2Object(objectKey: string) {
  const command = new DeleteObjectCommand({
    Bucket: getRecordingBucket(),
    Key: objectKey,
  });

  await getR2Client().send(command);
}

export async function safeDeleteR2Object(objectKey?: string | null): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!objectKey) return { ok: true, skipped: true };

  try {
    await deleteR2Object(objectKey);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "R2 object delete failed",
    };
  }
}
