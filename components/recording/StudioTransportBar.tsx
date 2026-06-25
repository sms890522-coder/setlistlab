"use client";

import type { StudioCurrentPosition } from "@/lib/recording/studioTimeline";

type StudioTransportBarProps = {
  playing: boolean;
  loading?: boolean;
  recording?: boolean;
  currentTime: number;
  duration: number;
  position: StudioCurrentPosition;
  onPlayPause: () => void;
  onStop: () => void;
  onRewind: () => void;
  onSeek: (time: number) => void;
  onRecord: () => void;
};

export function StudioTransportBar({
  playing,
  loading = false,
  recording = false,
  currentTime,
  duration,
  position,
  onPlayPause,
  onStop,
  onRewind,
  onSeek,
  onRecord,
}: StudioTransportBarProps) {
  return (
    <section className="sticky top-16 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRewind} className="btn-secondary min-h-11">
            처음으로
          </button>
          <button type="button" onClick={onPlayPause} disabled={loading} className="btn-primary min-h-11">
            {loading ? "준비 중..." : playing ? "일시정지" : "재생"}
          </button>
          <button type="button" onClick={onStop} className="btn-secondary min-h-11">
            정지
          </button>
          <button
            type="button"
            onClick={onRecord}
            className={
              recording
                ? "min-h-11 rounded-xl bg-rose-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-rose-700"
                : "min-h-11 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
            }
          >
            {recording ? "녹음 중지" : "녹음"}
          </button>
        </div>

        <div className="min-w-0 flex-1 lg:max-w-xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-950">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </p>
            <p className="truncate text-xs font-bold text-blue-700">
              {position.label} · {position.bar > 0 ? `${position.bar}마디` : "카운트인"} · {position.beat}박
            </p>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.01}
            value={Math.min(currentTime, Math.max(1, duration))}
            onChange={(event) => onSeek(Number(event.target.value))}
            className="mt-2 w-full accent-blue-600"
            aria-label="재생 위치"
          />
        </div>
      </div>
    </section>
  );
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
