"use client";

import type { GuideTrackData } from "@/lib/db/teamGuideTracks";
import {
  buildStudioTimelineSegments,
  getBeatsPerBar,
  getGuideCountInSeconds,
  getGuideTrackDurationSeconds,
  getGuideTrackTotalBars,
} from "@/lib/recording/studioTimeline";

type StudioTimelineProps = {
  data: GuideTrackData;
  currentTime: number;
  duration?: number;
  onSeek: (time: number) => void;
};

export function StudioTimeline({ data, currentTime, duration, onSeek }: StudioTimelineProps) {
  const totalDuration = duration || getGuideTrackDurationSeconds(data);
  const totalBars = Math.max(1, getGuideTrackTotalBars(data));
  const countInSec = getGuideCountInSeconds(data);
  const segments = buildStudioTimelineSegments(data);
  const width = Math.max(760, (totalBars + (data.countIn.enabled ? data.countIn.bars : 0)) * 58);
  const playheadLeft = `${Math.max(0, Math.min(1, currentTime / Math.max(1, totalDuration))) * 100}%`;
  const beatsPerBar = getBeatsPerBar(data.timeSignature);

  function handleSeek(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * totalDuration);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-black text-slate-950">Timeline</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          BPM {data.bpm ?? 72} · {data.timeSignature} · {beatsPerBar}박 · 총 {totalBars}마디
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="relative min-h-28 p-4" style={{ width }}>
          <div className="grid h-8 items-center border-b border-slate-200 text-xs font-black text-slate-500" style={{ gridTemplateColumns: `repeat(${Math.max(1, totalBars)}, minmax(42px, 1fr))` }}>
            {Array.from({ length: totalBars }, (_, index) => (
              <span key={index} className="pl-2">
                {index + 1}
              </span>
            ))}
          </div>
          <div className="relative mt-4 h-12 rounded-xl bg-slate-50" onPointerDown={handleSeek}>
            {segments.map((segment) => {
              const left = `${(segment.startSec / Math.max(1, totalDuration)) * 100}%`;
              const segmentWidth = `${((segment.endSec - segment.startSec) / Math.max(1, totalDuration)) * 100}%`;
              const countIn = segment.startSec < countInSec && segment.label === "Count-in";
              return (
                <div
                  key={segment.id}
                  className={`absolute inset-y-1 overflow-hidden rounded-lg px-2 py-1 ${
                    countIn ? "bg-slate-200 text-slate-600" : "bg-blue-100 text-blue-800"
                  }`}
                  style={{ left, width: segmentWidth }}
                >
                  <p className="truncate text-xs font-black">{segment.label}</p>
                  <p className="truncate text-[10px] font-semibold opacity-75">
                    {countIn ? "카운트인" : `${segment.startBar}마디부터 · ${segment.bars}마디`}
                  </p>
                </div>
              );
            })}
            <div className="absolute inset-y-0 w-0.5 bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.16)]" style={{ left: playheadLeft }} />
          </div>
        </div>
      </div>
    </section>
  );
}
