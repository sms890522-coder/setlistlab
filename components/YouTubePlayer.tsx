"use client";

import { createId } from "@/lib/id";
import { COMMON_SECTION_NAMES } from "@/lib/sections";
import type { SongSection } from "@/lib/types";
import { formatSecondsToTime } from "@/lib/youtube";
import { useYouTubeIframePlayer } from "@/hooks/useYouTubeIframePlayer";
import { forwardRef, useImperativeHandle, useState } from "react";

type YouTubePlayerProps = {
  videoId: string;
  sections: SongSection[];
  onSectionsChange?: (sections: SongSection[]) => void;
  initialTime?: number;
  onTimeUpdate?: (seconds: number) => void;
};

export type YouTubePlayerHandle = {
  seekToSection: (section: SongSection) => void;
};

const SPEEDS = [0.25, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.25, 1.5, 2];

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, sections, onSectionsChange, initialTime = 0, onTimeUpdate },
  ref,
) {
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id ?? "");
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [sectionMessage, setSectionMessage] = useState("");

  const selectedSection = sections.find((section) => section.id === selectedSectionId);
  const sectionSequence = sections.map((section) => section.name || "구간").join(" - ");
  const player = useYouTubeIframePlayer({
    videoId,
    initialTime,
    onTimeUpdate,
    onTick: (nextTime, ytPlayer) => {
      const loopTarget = sections.find((section) => section.id === selectedSectionId);
      if (
        loopEnabled &&
        loopTarget &&
        typeof loopTarget.startTime === "number" &&
        typeof loopTarget.endTime === "number" &&
        nextTime >= loopTarget.endTime
      ) {
        ytPlayer.seekTo(loopTarget.startTime, true);
      }
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      seekToSection(section: SongSection) {
        setSelectedSectionId(section.id);
        player.seekTo(section.startTime ?? 0);
      },
    }),
    [player],
  );

  function addSectionAtCurrentTime(name: string) {
    if (!onSectionsChange) return;

    const timestamp = player.getCurrentTime();
    const newSection: SongSection = {
      id: createId("section"),
      name,
      startTime: timestamp,
      endTime: undefined,
      memo: "",
    };
    const nextSections = closeLatestOpenSection(sections, timestamp);
    const sortedSections = sortSectionsByStartTime([...nextSections, newSection]);

    onSectionsChange(sortedSections);
    setSelectedSectionId(newSection.id);
    setSectionMessage(`${name} 구간을 ${formatSecondsToTime(timestamp)}에 추가했습니다.`);
  }

  function deleteSelectedSection() {
    if (!onSectionsChange || !selectedSection) return;
    if (!window.confirm(`${selectedSection.name || "선택 구간"} 구간을 삭제할까요?`)) return;

    const nextSections = sections.filter((section) => section.id !== selectedSection.id);
    onSectionsChange(nextSections);
    setSelectedSectionId(nextSections[0]?.id ?? "");
    setSectionMessage("선택한 구간을 삭제했습니다.");
  }

  function deleteAllSections() {
    if (!onSectionsChange || sections.length === 0) return;
    if (!window.confirm("곡 구성 전체를 삭제할까요?")) return;

    onSectionsChange([]);
    setSelectedSectionId("");
    setSectionMessage("곡 구성 전체를 삭제했습니다.");
  }

  return (
    <div className="space-y-4">
      <div className={onSectionsChange ? "grid gap-4 lg:grid-cols-2 lg:items-start" : ""}>
        {onSectionsChange ? (
          <div className="card order-1 p-4 lg:order-2">
            <div>
              <h3 className="font-bold text-slate-950">실시간 구간 입력</h3>
              <p className="field-help">현재 위치 {formatSecondsToTime(player.currentTime)}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={deleteSelectedSection}
                disabled={!selectedSection}
                className="btn-danger min-h-10 px-3"
              >
                선택 삭제
              </button>
              <button
                type="button"
                onClick={deleteAllSections}
                disabled={sections.length === 0}
                className="btn-danger min-h-10 px-3"
              >
                전체 삭제
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {COMMON_SECTION_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addSectionAtCurrentTime(name)}
                  className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  {name}
                </button>
              ))}
            </div>

            {sectionMessage ? (
              <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                {sectionMessage}
              </p>
            ) : null}

            <div className="mt-4 hidden lg:block">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-slate-950">송폼</h4>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                  {sections.length}개
                </span>
              </div>
              {sections.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  아직 찍은 구간이 없습니다.
                </p>
              ) : (
                <p className="mt-3 max-h-20 overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">
                  {sectionSequence}
                </p>
              )}
            </div>

            <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:hidden">
              <summary className="cursor-pointer text-sm font-bold text-slate-700">
                송폼 {sections.length}개
              </summary>
              {sections.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">아직 찍은 구간이 없습니다.</p>
              ) : (
                <p className="mt-2 max-h-20 overflow-y-auto rounded-lg bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-700">
                  {sectionSequence}
                </p>
              )}
            </details>
          </div>
        ) : null}

        <div className="order-2 rounded-lg border border-slate-200 bg-slate-950 lg:order-1">
          <div className="youtube-frame-host aspect-video w-full overflow-hidden rounded-lg" ref={player.hostRef} />
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-950">재생속도</h3>
            <p className="mt-1 text-sm font-bold text-slate-700">
              현재 {formatSecondsToTime(player.currentTime)} / {player.duration ? formatSecondsToTime(player.duration) : "--:--"}
            </p>
            <p className="field-help">{player.ready ? "YouTube IFrame API로 재생 중입니다." : "플레이어를 불러오는 중입니다."}</p>
            {player.error ? <p className="mt-1 text-xs font-semibold text-rose-600">{player.error}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={player.togglePlayback} disabled={!player.ready} className="btn-primary min-h-10 px-3">
              {player.playing ? "일시정지" : "재생"}
            </button>
            <button type="button" onClick={() => player.seekRelative(-5)} className="btn-secondary min-h-10 px-3">
              5초 뒤로
            </button>
            <button type="button" onClick={() => player.seekRelative(5)} className="btn-secondary min-h-10 px-3">
              5초 앞으로
            </button>
          </div>
        </div>

        <div className="mt-4 sm:hidden">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900">속도 조절</p>
              <p className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">
                {formatSpeedLabel(player.speed)}x
              </p>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={speedToSliderValue(player.speed)}
              onChange={(event) => player.changeSpeed(sliderValueToSpeed(Number(event.target.value)))}
              className="mt-3 w-full accent-blue-600"
              aria-label="재생속도 조절"
            />
            <div className="mt-2 grid grid-cols-3 text-xs font-bold text-slate-500">
              <span>0.1x</span>
              <span className="text-center">1x</span>
              <span className="text-right">2x</span>
            </div>
          </div>
        </div>

        <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
          {SPEEDS.map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => player.changeSpeed(rate)}
              className={rate === player.speed ? "btn-primary min-h-10 px-3" : "btn-secondary min-h-10 px-3"}
            >
              {rate}x
            </button>
          ))}
        </div>
        {player.speedNotice ? <p className="mt-2 text-xs font-semibold text-amber-700">{player.speedNotice}</p> : null}

        <div className="mt-4 flex flex-col gap-3 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">구간반복</p>
            <p className="field-help">
              {selectedSection?.name
                ? `${selectedSection.name} 구간을 선택했습니다.`
                : "반복할 구간을 선택하세요."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLoopEnabled((value) => !value)}
            className={loopEnabled ? "btn-primary" : "btn-secondary"}
          >
            {loopEnabled ? "반복 ON" : "반복 OFF"}
          </button>
        </div>
      </div>

    </div>
  );
});

function formatSpeedLabel(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function speedToSliderValue(value: number) {
  if (value <= 1) {
    return ((Math.max(0.1, value) - 0.1) / 0.9) * 50;
  }

  return 50 + ((Math.min(2, value) - 1) / 1) * 50;
}

function sliderValueToSpeed(value: number) {
  const nextSpeed = value <= 50 ? 0.1 + (value / 50) * 0.9 : 1 + ((value - 50) / 50) * 1;
  return Number(nextSpeed.toFixed(2));
}

function closeLatestOpenSection(sections: SongSection[], timestamp: number) {
  let targetIndex = -1;
  let latestStartTime = -1;

  sections.forEach((section, index) => {
    if (
      typeof section.startTime === "number" &&
      typeof section.endTime !== "number" &&
      section.startTime < timestamp &&
      section.startTime >= latestStartTime
    ) {
      targetIndex = index;
      latestStartTime = section.startTime;
    }
  });

  return sections.map((section, index) => (index === targetIndex ? { ...section, endTime: timestamp } : section));
}

function sortSectionsByStartTime(sections: SongSection[]) {
  return [...sections].sort((a, b) => {
    const aStart = typeof a.startTime === "number" ? a.startTime : Number.MAX_SAFE_INTEGER;
    const bStart = typeof b.startTime === "number" ? b.startTime : Number.MAX_SAFE_INTEGER;

    if (aStart !== bStart) return aStart - bStart;
    return 0;
  });
}
