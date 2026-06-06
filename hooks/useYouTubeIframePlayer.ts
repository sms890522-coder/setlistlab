"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  YOUTUBE_ENDED,
  YOUTUBE_PLAYING,
  getYouTubeErrorMessage,
  isReadyPlayer,
  loadYouTubeApi,
  safeDestroy,
  type YTPlayer,
} from "@/lib/youtubeIframe";

type UseYouTubeIframePlayerOptions = {
  videoId?: string;
  autoplay?: boolean;
  initialTime?: number;
  onEnded?: () => void;
  onTimeUpdate?: (seconds: number) => void;
  onTick?: (seconds: number, player: YTPlayer) => void;
};

export function useYouTubeIframePlayer({
  videoId,
  autoplay = false,
  initialTime = 0,
  onEnded,
  onTimeUpdate,
  onTick,
}: UseYouTubeIframePlayerOptions) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const speedRef = useRef(1);
  const onEndedRef = useRef(onEnded);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onTickRef = useRef(onTick);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [speedNotice, setSpeedNotice] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(Math.max(0, initialTime));
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!videoId) {
      setReady(false);
      setError("");
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      pendingSeekRef.current = null;
      safeDestroy(playerRef.current);
      playerRef.current = null;
      hostRef.current?.replaceChildren();
      return;
    }

    let cancelled = false;
    const startTime = Math.max(0, initialTime);

    setReady(false);
    setError("");
    setSpeedNotice("");
    setPlaying(false);
    setCurrentTime(startTime);
    setDuration(0);
    pendingSeekRef.current = startTime > 0 ? startTime : null;

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
            autoplay: autoplay ? 1 : 0,
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

              if (autoplay) {
                event.target.playVideo();
              }
            },
            onError: (event) => {
              setError(getYouTubeErrorMessage(event.data));
            },
            onStateChange: (event) => {
              setPlaying(event.data === YOUTUBE_PLAYING);
              if (event.data === YOUTUBE_ENDED) {
                onEndedRef.current?.();
              }
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
  }, [autoplay, initialTime, videoId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!isReadyPlayer(player)) return;

      const nextTime = player.getCurrentTime();
      setCurrentTime(nextTime);
      setDuration(player.getDuration());
      onTimeUpdateRef.current?.(Math.max(0, Math.round(nextTime)));
      onTickRef.current?.(nextTime, player);
    }, 500);

    return () => window.clearInterval(timer);
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const nextTime = Math.max(0, seconds);
    if (isReadyPlayer(playerRef.current)) {
      playerRef.current.seekTo(nextTime, true);
    } else {
      pendingSeekRef.current = nextTime;
    }
    setCurrentTime(nextTime);
    onTimeUpdateRef.current?.(Math.round(nextTime));
  }, []);

  const seekRelative = useCallback(
    (delta: number) => {
      const baseTime = isReadyPlayer(playerRef.current) ? playerRef.current.getCurrentTime() : currentTime;
      seekTo(baseTime + delta);
    },
    [currentTime, seekTo],
  );

  const getCurrentTime = useCallback(() => {
    const playerTime = isReadyPlayer(playerRef.current) ? playerRef.current.getCurrentTime() : currentTime;
    return Math.max(0, Math.round(playerTime));
  }, [currentTime]);

  const changeSpeed = useCallback((nextSpeed: number) => {
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
  }, []);

  const togglePlayback = useCallback(() => {
    const player = playerRef.current;
    if (!isReadyPlayer(player)) return;

    if (player.getPlayerState() === YOUTUBE_PLAYING) {
      player.pauseVideo();
      setPlaying(false);
    } else {
      player.playVideo();
      setPlaying(true);
    }
  }, []);

  return {
    hostRef,
    playerRef,
    ready,
    error,
    speedNotice,
    playing,
    currentTime,
    duration,
    speed,
    seekTo,
    seekRelative,
    getCurrentTime,
    changeSpeed,
    togglePlayback,
  };
}
