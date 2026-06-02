"use client";

import { createId } from "@/lib/id";
import { COMMON_SECTION_NAMES } from "@/lib/sections";
import type { SongSection } from "@/lib/types";
import { formatSecondsToTime } from "@/lib/youtube";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

type YouTubePlayerProps = {
  videoId: string;
  sections: SongSection[];
  onSectionsChange?: (sections: SongSection[]) => void;
};

export type YouTubePlayerHandle = {
  seekToSection: (section: SongSection) => void;
};

type YTPlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlaybackRate: () => number;
  getPlayerState: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate: (rate: number) => void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: { target: YTPlayer }) => void;
        onError?: (event: { data: number }) => void;
        onStateChange?: (event: { data: number }) => void;
        onPlaybackRateChange?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SPEEDS = [0.25, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.25, 1.5, 2];
const YOUTUBE_PLAYING = 1;

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, sections, onSectionsChange },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const speedRef = useRef(1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [speedNotice, setSpeedNotice] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id ?? "");
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [sectionMessage, setSectionMessage] = useState("");

  const selectedSection = sections.find((section) => section.id === selectedSectionId);
  const sectionSequence = sections.map((section) => section.name || "구간").join(" - ");

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useImperativeHandle(
    ref,
    () => ({
      seekToSection(section: SongSection) {
        setSelectedSectionId(section.id);
        seekTo(section.startTime ?? 0);
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError("");
    setSpeedNotice("");
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    pendingSeekRef.current = null;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;

        safeDestroy(playerRef.current);
        hostRef.current.replaceChildren(document.createElement("div"));
        const mountNode = hostRef.current.firstElementChild;
        if (!(mountNode instanceof HTMLElement)) return;

        playerRef.current = new YT.Player(mountNode, {
          videoId,
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              playerRef.current = event.target;
              setReady(true);
              setDuration(event.target.getDuration());
              event.target.setPlaybackRate(speedRef.current);

              if (typeof pendingSeekRef.current === "number") {
                event.target.seekTo(pendingSeekRef.current, true);
                setCurrentTime(pendingSeekRef.current);
                pendingSeekRef.current = null;
              }
            },
            onError: (event) => {
              setError(getYouTubeErrorMessage(event.data));
            },
            onStateChange: (event) => {
              setPlaying(event.data === YOUTUBE_PLAYING);
            },
            onPlaybackRateChange: (event) => {
              setSpeed(event.data);
              speedRef.current = event.data;
              setSpeedNotice("");
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError("유튜브 플레이어를 불러오지 못했습니다. 네트워크 또는 브라우저 설정을 확인해 주세요.");
        }
      });

    return () => {
      cancelled = true;
      safeDestroy(playerRef.current);
      playerRef.current = null;
      hostRef.current?.replaceChildren();
    };
  }, [videoId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!isReadyPlayer(player)) return;

      const nextTime = player.getCurrentTime();
      setCurrentTime(nextTime);
      setDuration(player.getDuration());

      const loopTarget = sections.find((section) => section.id === selectedSectionId);
      if (
        loopEnabled &&
        loopTarget &&
        typeof loopTarget.startTime === "number" &&
        typeof loopTarget.endTime === "number" &&
        nextTime >= loopTarget.endTime
      ) {
        player.seekTo(loopTarget.startTime, true);
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [loopEnabled, sections, selectedSectionId]);

  function seekTo(seconds: number) {
    const nextTime = Math.max(0, seconds);
    if (isReadyPlayer(playerRef.current)) {
      playerRef.current.seekTo(nextTime, true);
    } else {
      pendingSeekRef.current = nextTime;
    }
    setCurrentTime(nextTime);
  }

  function seekRelative(delta: number) {
    const baseTime = isReadyPlayer(playerRef.current) ? playerRef.current.getCurrentTime() : currentTime;
    seekTo(baseTime + delta);
  }

  function getPlayerTime() {
    const playerTime = isReadyPlayer(playerRef.current) ? playerRef.current.getCurrentTime() : currentTime;
    return Math.max(0, Math.round(playerTime));
  }

  function changeSpeed(nextSpeed: number) {
    if (isReadyPlayer(playerRef.current)) {
      playerRef.current.setPlaybackRate(nextSpeed);
      window.setTimeout(() => {
        const appliedSpeed = playerRef.current?.getPlaybackRate();
        if (typeof appliedSpeed === "number") {
          setSpeed(appliedSpeed);
          speedRef.current = appliedSpeed;
          setSpeedNotice(
            appliedSpeed === nextSpeed ? "" : `이 영상은 ${nextSpeed}x 대신 ${appliedSpeed}x 배속으로 재생됩니다.`,
          );
        }
      }, 250);
    }
    setSpeed(nextSpeed);
    setSpeedNotice("");
  }

  function togglePlayback() {
    const player = playerRef.current;
    if (!isReadyPlayer(player)) return;

    if (player.getPlayerState() === YOUTUBE_PLAYING) {
      player.pauseVideo();
      setPlaying(false);
    } else {
      player.playVideo();
      setPlaying(true);
    }
  }

  function addSectionAtCurrentTime(name: string) {
    if (!onSectionsChange) return;

    const timestamp = getPlayerTime();
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
              <p className="field-help">현재 위치 {formatSecondsToTime(currentTime)}</p>
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
          <div className="youtube-frame-host aspect-video w-full overflow-hidden rounded-lg" ref={hostRef} />
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-950">재생속도</h3>
            <p className="mt-1 text-sm font-bold text-slate-700">
              현재 {formatSecondsToTime(currentTime)} / {duration ? formatSecondsToTime(duration) : "--:--"}
            </p>
            <p className="field-help">{ready ? "YouTube IFrame API로 재생 중입니다." : "플레이어를 불러오는 중입니다."}</p>
            {error ? <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={togglePlayback} disabled={!ready} className="btn-primary min-h-10 px-3">
              {playing ? "일시정지" : "재생"}
            </button>
            <button type="button" onClick={() => seekRelative(-5)} className="btn-secondary min-h-10 px-3">
              5초 뒤로
            </button>
            <button type="button" onClick={() => seekRelative(5)} className="btn-secondary min-h-10 px-3">
              5초 앞으로
            </button>
          </div>
        </div>

        <div className="mt-4 sm:hidden">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900">속도 조절</p>
              <p className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">
                {formatSpeedLabel(speed)}x
              </p>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={speedToSliderValue(speed)}
              onChange={(event) => changeSpeed(sliderValueToSpeed(Number(event.target.value)))}
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
              onClick={() => changeSpeed(rate)}
              className={rate === speed ? "btn-primary min-h-10 px-3" : "btn-secondary min-h-10 px-3"}
            >
              {rate}x
            </button>
          ))}
        </div>
        {speedNotice ? <p className="mt-2 text-xs font-semibold text-amber-700">{speedNotice}</p> : null}

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

function isReadyPlayer(player: YTPlayer | null): player is YTPlayer {
  return Boolean(
    player &&
      typeof player.getCurrentTime === "function" &&
      typeof player.getDuration === "function" &&
      typeof player.getPlaybackRate === "function" &&
      typeof player.getPlayerState === "function" &&
      typeof player.pauseVideo === "function" &&
      typeof player.playVideo === "function" &&
      typeof player.seekTo === "function" &&
      typeof player.setPlaybackRate === "function",
  );
}

function safeDestroy(player: YTPlayer | null) {
  if (player && typeof player.destroy === "function") {
    player.destroy();
  }
}

function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    const previousCallback = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      reject(new Error("YouTube IFrame API load timeout"));
    }, 12000);

    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (window.YT?.Player) {
        window.clearTimeout(timeout);
        resolve(window.YT);
      }
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("YouTube IFrame API script failed"));
      };
      document.head.appendChild(script);
    }
  });
}

function getYouTubeErrorMessage(code: number) {
  if (code === 2) return "유튜브 영상 ID가 올바르지 않습니다. 링크를 다시 확인해 주세요.";
  if (code === 5) return "이 브라우저에서 재생할 수 없는 유튜브 영상입니다.";
  if (code === 100) return "삭제되었거나 공개되지 않은 유튜브 영상입니다.";
  if (code === 101 || code === 150) return "이 영상은 외부 사이트 임베드를 허용하지 않습니다.";
  return "유튜브 영상을 재생할 수 없습니다. 다른 링크로 다시 시도해 주세요.";
}

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
