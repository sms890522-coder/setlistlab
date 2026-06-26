"use client";

import type { StudioCurrentPosition } from "@/lib/recording/studioTimeline";

type StudioTransportBarProps = {
  playing: boolean;
  loading?: boolean;
  recording?: boolean;
  currentTime: number;
  duration: number;
  position: StudioCurrentPosition;
  syncControl?: {
    trackLabel: string;
    value: number;
    canAdjust: boolean;
    onChange: (value: number) => void;
    onCommit: (value: number) => void;
    onClear?: () => void;
  };
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
  syncControl,
  onPlayPause,
  onStop,
  onRewind,
  onSeek,
  onRecord,
}: StudioTransportBarProps) {
  return (
    <section className="sticky top-16 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="grid gap-4 lg:grid-cols-[auto_minmax(220px,300px)_minmax(280px,1fr)] lg:items-center">
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

        <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
          {syncControl ? (
            <div className={syncControl.canAdjust ? "space-y-2" : "space-y-2 opacity-55"}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase text-slate-400">Sync</p>
                  <p className="truncate text-xs font-black text-slate-700">{syncControl.trackLabel}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="min-w-12 text-right text-xs font-black text-blue-700">{syncControl.value}ms</span>
                  {syncControl.onClear ? (
                    <button
                      type="button"
                      onClick={syncControl.onClear}
                      className="rounded-lg px-2 py-1 text-[11px] font-black text-slate-400 transition hover:bg-white hover:text-slate-700"
                    >
                      닫기
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!syncControl.canAdjust}
                  onClick={() => syncControl.onCommit(syncControl.value - 50)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-600 disabled:cursor-not-allowed"
                >
                  -50
                </button>
                <input
                  type="range"
                  min={-500}
                  max={500}
                  step={10}
                  value={Math.max(-500, Math.min(500, syncControl.value))}
                  disabled={!syncControl.canAdjust}
                  onChange={(event) => syncControl.onChange(Number(event.target.value))}
                  onPointerUp={(event) => syncControl.onCommit(Number((event.target as HTMLInputElement).value))}
                  onKeyUp={(event) => syncControl.onCommit(Number((event.target as HTMLInputElement).value))}
                  className="min-w-0 flex-1 accent-blue-600 disabled:opacity-40"
                  aria-label={`${syncControl.trackLabel} 싱크 보정`}
                />
                <button
                  type="button"
                  disabled={!syncControl.canAdjust}
                  onClick={() => syncControl.onCommit(syncControl.value + 50)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-600 disabled:cursor-not-allowed"
                >
                  +50
                </button>
                <button
                  type="button"
                  disabled={!syncControl.canAdjust}
                  onClick={() => syncControl.onCommit(0)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-500 disabled:cursor-not-allowed"
                >
                  0
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-14 items-center text-xs font-bold leading-5 text-slate-500">
              트랙을 선택하면 이곳에서 싱크를 조절할 수 있습니다.
            </div>
          )}
        </div>

        <div className="min-w-0">
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
