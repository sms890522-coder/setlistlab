import { NextResponse } from "next/server";
import { DEFAULT_RECORDING_LIMITS } from "@/lib/recording/recordingLimits";
import { safeDeleteR2Object } from "@/lib/storage/r2";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type CleanupTrackRow = {
  id: string;
  status: string;
  object_key: string | null;
  updated_at: string;
};

type CleanupCounters = {
  checked: number;
  deletedObjects: number;
  markedDeleted: number;
  failed: number;
};

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization")?.trim();

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET이 설정되어 있지 않습니다." }, { status: 500 });
  }

  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const now = Date.now();
    const staleUploadingBefore = new Date(now - DEFAULT_RECORDING_LIMITS.pendingUploadCleanupHours * 60 * 60 * 1000).toISOString();
    const staleFailedBefore = new Date(now - DEFAULT_RECORDING_LIMITS.failedCleanupDays * 24 * 60 * 60 * 1000).toISOString();

    const [staleUploads, staleFailed, deletedWithObjects, replacedWithObjects] = await Promise.all([
      supabase
        .from("team_recording_tracks")
        .select("id, status, object_key, updated_at")
        .in("status", ["pending_upload", "uploading"])
        .lt("updated_at", staleUploadingBefore)
        .returns<CleanupTrackRow[]>(),
      supabase
        .from("team_recording_tracks")
        .select("id, status, object_key, updated_at")
        .eq("status", "failed")
        .lt("updated_at", staleFailedBefore)
        .returns<CleanupTrackRow[]>(),
      supabase
        .from("team_recording_tracks")
        .select("id, status, object_key, updated_at")
        .eq("status", "deleted")
        .not("object_key", "is", null)
        .returns<CleanupTrackRow[]>(),
      supabase
        .from("team_recording_tracks")
        .select("id, status, object_key, updated_at")
        .eq("status", "replaced")
        .not("object_key", "is", null)
        .returns<CleanupTrackRow[]>(),
    ]);

    const queryError = staleUploads.error ?? staleFailed.error ?? deletedWithObjects.error ?? replacedWithObjects.error;
    if (queryError) {
      return NextResponse.json({ error: queryError.message || "정리 대상 조회에 실패했습니다." }, { status: 500 });
    }

    const rowsById = new Map<string, CleanupTrackRow>();
    [
      ...(staleUploads.data ?? []),
      ...(staleFailed.data ?? []),
      ...(deletedWithObjects.data ?? []),
      ...(replacedWithObjects.data ?? []),
    ].forEach((row) => {
      rowsById.set(row.id, row);
    });

    const counters: CleanupCounters = {
      checked: rowsById.size,
      deletedObjects: 0,
      markedDeleted: 0,
      failed: 0,
    };

    for (const row of rowsById.values()) {
      const deleteResult = await safeDeleteR2Object(row.object_key);
      if (deleteResult.ok && !deleteResult.skipped) counters.deletedObjects += 1;
      if (!deleteResult.ok) counters.failed += 1;

      const nextStatus = row.status === "replaced" ? "replaced" : "deleted";
      const { error: updateError } = await supabase
        .from("team_recording_tracks")
        .update({
          status: nextStatus,
          object_key: deleteResult.ok ? null : row.object_key,
          error_message: deleteResult.ok ? null : `r2_cleanup_failed: ${deleteResult.error ?? "unknown"}`.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        counters.failed += 1;
        continue;
      }

      if (row.status !== nextStatus) counters.markedDeleted += 1;
    }

    return NextResponse.json(counters);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "녹음 파일 정리를 완료하지 못했습니다." },
      { status: 500 },
    );
  }
}
