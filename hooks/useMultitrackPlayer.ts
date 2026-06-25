"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type MultitrackSource = {
  id: string;
  url?: string;
  duration?: number;
  defaultVolume?: number;
  offsetMs?: number;
};

export type TrackMixState = {
  muted: boolean;
  solo: boolean;
  volume: number;
};

type UseMultitrackPlayerInput = {
  sources: MultitrackSource[];
  resolveSourceUrl?: (trackId: string) => Promise<string>;
  fallbackDuration?: number;
};

export function useMultitrackPlayer({ sources, resolveSourceUrl, fallbackDuration = 0 }: UseMultitrackPlayerInput) {
  const [mixState, setMixState] = useState<Record<string, TrackMixState>>({});
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const rafRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);

  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const duration = useMemo(
    () => Math.max(fallbackDuration, ...sources.map((source) => source.duration ?? 0), 1),
    [fallbackDuration, sources],
  );
  const hasSolo = Object.values(mixState).some((state) => state.solo);

  useEffect(() => {
    setMixState((current) => {
      const next = { ...current };
      sources.forEach((source) => {
        if (!next[source.id]) {
          next[source.id] = {
            muted: false,
            solo: false,
            volume: source.defaultVolume ?? 1,
          };
        }
      });

      Object.keys(next).forEach((trackId) => {
        if (!sourceById.has(trackId)) delete next[trackId];
      });

      return next;
    });
  }, [sourceById, sources]);

  useEffect(() => {
    return () => {
      stop();
      Object.values(audioRefs.current).forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      audioRefs.current = {};
    };
  }, []);

  const getAudibleSourceIds = useCallback(() => {
    return sources
      .filter((source) => {
        const state = mixState[source.id];
        if (!state) return true;
        if (hasSolo) return state.solo;
        return !state.muted;
      })
      .map((source) => source.id);
  }, [hasSolo, mixState, sources]);

  const applyMixToAudio = useCallback(
    (trackId: string, audio: HTMLAudioElement) => {
      const state = mixState[trackId];
      const audible = hasSolo ? Boolean(state?.solo) : !state?.muted;
      audio.muted = !audible;
      audio.volume = Math.max(0, Math.min(1, state?.volume ?? 1));
    },
    [hasSolo, mixState],
  );

  const ensureAudio = useCallback(
    async (trackId: string) => {
      const source = sourceById.get(trackId);
      if (!source) throw new Error("재생할 트랙을 찾을 수 없습니다.");

      let audio = audioRefs.current[trackId];
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        audioRefs.current[trackId] = audio;
      }

      const nextUrl = source.url || (resolveSourceUrl ? await resolveSourceUrl(trackId) : "");
      if (!nextUrl) throw new Error("트랙 재생 URL을 불러오지 못했습니다.");
      if (audio.src !== nextUrl) {
        audio.src = nextUrl;
        audio.load();
      }

      applyMixToAudio(trackId, audio);
      return audio;
    },
    [applyMixToAudio, resolveSourceUrl, sourceById],
  );

  useEffect(() => {
    Object.entries(audioRefs.current).forEach(([trackId, audio]) => applyMixToAudio(trackId, audio));
  }, [applyMixToAudio]);

  const startProgressLoop = useCallback(() => {
    const update = () => {
      const master = pickMasterAudio(getAudibleSourceIds(), audioRefs.current);
      const nextTime = master?.currentTime ?? currentTimeRef.current;
      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);

      if (master && !master.paused && nextTime < duration) {
        rafRef.current = window.requestAnimationFrame(update);
      } else {
        setPlaying(false);
      }
    };

    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(update);
  }, [duration, getAudibleSourceIds]);

  const play = useCallback(async () => {
    const audibleIds = getAudibleSourceIds();
    if (audibleIds.length === 0) return;

    setLoading(true);
    try {
      const audios = await Promise.all(audibleIds.map((trackId) => ensureAudio(trackId)));
      audios.forEach((audio) => {
        audio.currentTime = Math.max(0, Math.min(currentTimeRef.current, Math.max(0, audio.duration || duration)));
      });
      await Promise.allSettled(audios.map((audio) => audio.play()));
      setPlaying(true);
      startProgressLoop();
    } finally {
      setLoading(false);
    }
  }, [duration, ensureAudio, getAudibleSourceIds, startProgressLoop]);

  const pause = useCallback(() => {
    Object.values(audioRefs.current).forEach((audio) => audio.pause());
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
  }, []);

  const stop = useCallback(() => {
    Object.values(audioRefs.current).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    currentTimeRef.current = 0;
    setCurrentTime(0);
    setPlaying(false);
  }, []);

  const seek = useCallback((time: number) => {
    const nextTime = Math.max(0, Math.min(time, duration));
    Object.values(audioRefs.current).forEach((audio) => {
      audio.currentTime = Math.min(nextTime, Math.max(0, audio.duration || nextTime));
    });
    currentTimeRef.current = nextTime;
    setCurrentTime(nextTime);
  }, [duration]);

  const toggleMute = useCallback((trackId: string) => {
    setMixState((current) => ({
      ...current,
      [trackId]: {
        muted: !current[trackId]?.muted,
        solo: current[trackId]?.solo ?? false,
        volume: current[trackId]?.volume ?? 1,
      },
    }));
  }, []);

  const toggleSolo = useCallback((trackId: string) => {
    setMixState((current) => {
      const previous = current[trackId] ?? { muted: false, solo: false, volume: 1 };
      return {
        ...current,
        [trackId]: {
          ...previous,
          muted: previous.solo ? previous.muted : false,
          solo: !previous.solo,
        },
      };
    });
  }, []);

  const setVolume = useCallback((trackId: string, volume: number) => {
    setMixState((current) => ({
      ...current,
      [trackId]: {
        muted: current[trackId]?.muted ?? false,
        solo: current[trackId]?.solo ?? false,
        volume: Math.max(0, Math.min(1, volume)),
      },
    }));
  }, []);

  return {
    mixState,
    currentTime,
    duration,
    playing,
    loading,
    hasSolo,
    play,
    pause,
    stop,
    seek,
    toggleMute,
    toggleSolo,
    setVolume,
  };
}

function pickMasterAudio(trackIds: string[], audios: Record<string, HTMLAudioElement>) {
  for (const trackId of trackIds) {
    const audio = audios[trackId];
    if (audio) return audio;
  }

  return Object.values(audios)[0] ?? null;
}
