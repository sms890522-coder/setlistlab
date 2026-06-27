"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_TRACK_EFFECTS,
  dbToGain,
  getCompressorValues,
  getReverbValues,
  normalizeTrackEffects,
  type TrackEffectSettings,
} from "@/lib/audio/trackEffects";

export type MultitrackSource = {
  id: string;
  url?: string;
  duration?: number;
  defaultVolume?: number;
  offsetMs?: number;
  defaultLatencyOffsetMs?: number;
};

export type TrackMixState = {
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
  latencyOffsetMs: number;
  effects: TrackEffectSettings;
};

type AudioNodeSet = {
  source: MediaElementAudioSourceNode;
  inputGain: GainNode;
  lowEq: BiquadFilterNode;
  midEq: BiquadFilterNode;
  highEq: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  dryGain: GainNode;
  reverbDelay: DelayNode;
  reverbFeedback: GainNode;
  reverbWetGain: GainNode;
  trackGain: GainNode;
  panner?: StereoPannerNode;
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
  const [panSupported, setPanSupported] = useState(false);
  const [masterVolume, setMasterVolumeState] = useState(1);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const audioNodesRef = useRef<Record<string, AudioNodeSet>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimersRef = useRef<Record<string, number>>({});
  const currentTimeRef = useRef(0);
  const playStartMsRef = useRef(0);
  const playingRef = useRef(false);

  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const duration = useMemo(
    () => Math.max(fallbackDuration, ...sources.map((source) => source.duration ?? 0), 1),
    [fallbackDuration, sources],
  );
  const hasSolo = Object.values(mixState).some((state) => state.solo);

  useEffect(() => {
    setPanSupported(typeof window !== "undefined" && "StereoPannerNode" in window);
  }, []);

  useEffect(() => {
    setMixState((current) => {
      const next = { ...current };
      sources.forEach((source) => {
        if (!next[source.id]) {
          next[source.id] = {
            muted: false,
            solo: false,
            volume: source.defaultVolume ?? 1,
            pan: 0,
            latencyOffsetMs: source.defaultLatencyOffsetMs ?? 0,
            effects: DEFAULT_TRACK_EFFECTS,
          };
        }
      });

      Object.keys(next).forEach((trackId) => {
        if (!sourceById.has(trackId)) delete next[trackId];
      });

      return next;
    });
  }, [sourceById, sources]);

  const clearStartTimers = useCallback(() => {
    Object.values(startTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    startTimersRef.current = {};
  }, []);

  const stopAnimationFrame = useCallback(() => {
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
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

  const getEffectiveOffsetMs = useCallback(
    (trackId: string) => {
      const source = sourceById.get(trackId);
      const state = mixState[trackId];
      return (source?.offsetMs ?? 0) + (state?.latencyOffsetMs ?? 0);
    },
    [mixState, sourceById],
  );

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  }, []);

  const getMasterGain = useCallback(
    (context: AudioContext) => {
      if (!masterGainRef.current) {
        const masterGain = context.createGain();
        masterGain.gain.value = masterVolume;
        masterGain.connect(context.destination);
        masterGainRef.current = masterGain;
      }

      return masterGainRef.current;
    },
    [masterVolume],
  );

  const ensureAudioNodes = useCallback(
    (trackId: string, audio: HTMLAudioElement) => {
      if (audioNodesRef.current[trackId]) return audioNodesRef.current[trackId];

      try {
        const context = getAudioContext();
        const masterGain = getMasterGain(context);
        const source = context.createMediaElementSource(audio);
        const inputGain = context.createGain();
        const lowEq = context.createBiquadFilter();
        const midEq = context.createBiquadFilter();
        const highEq = context.createBiquadFilter();
        const compressor = context.createDynamicsCompressor();
        const dryGain = context.createGain();
        const reverbDelay = context.createDelay(1.5);
        const reverbFeedback = context.createGain();
        const reverbWetGain = context.createGain();
        const trackGain = context.createGain();
        const panner = "createStereoPanner" in context ? context.createStereoPanner() : undefined;

        lowEq.type = "lowshelf";
        lowEq.frequency.value = 120;
        midEq.type = "peaking";
        midEq.frequency.value = 1000;
        midEq.Q.value = 1;
        highEq.type = "highshelf";
        highEq.frequency.value = 8000;

        source.connect(inputGain).connect(lowEq).connect(midEq).connect(highEq).connect(compressor);
        compressor.connect(dryGain);
        compressor.connect(reverbDelay);
        reverbDelay.connect(reverbWetGain);
        reverbDelay.connect(reverbFeedback).connect(reverbDelay);

        if (panner) {
          dryGain.connect(panner);
          reverbWetGain.connect(panner);
          panner.connect(trackGain).connect(masterGain);
        } else {
          dryGain.connect(trackGain);
          reverbWetGain.connect(trackGain);
          trackGain.connect(masterGain);
        }
        audioNodesRef.current[trackId] = {
          source,
          inputGain,
          lowEq,
          midEq,
          highEq,
          compressor,
          dryGain,
          reverbDelay,
          reverbFeedback,
          reverbWetGain,
          trackGain,
          panner,
        };
        return audioNodesRef.current[trackId];
      } catch {
        return null;
      }
    },
    [getAudioContext, getMasterGain],
  );

  const applyMixToAudio = useCallback(
    (trackId: string, audio: HTMLAudioElement) => {
      const state = mixState[trackId];
      const audible = hasSolo ? Boolean(state?.solo) : !state?.muted;
      const volume = Math.max(0, Math.min(1, state?.volume ?? 1));
      const pan = Math.max(-1, Math.min(1, state?.pan ?? 0));
      const effects = normalizeTrackEffects(state?.effects);
      const nodes = audioNodesRef.current[trackId] ?? ensureAudioNodes(trackId, audio);

      if (nodes) {
        audio.muted = false;
        audio.volume = 1;
        applyEffectsToNodes(nodes, effects);
        nodes.trackGain.gain.value = audible ? volume : 0;
        if (nodes.panner) nodes.panner.pan.value = pan;
        if (masterGainRef.current) masterGainRef.current.gain.value = masterVolume;
        return;
      }

      audio.muted = !audible;
      audio.volume = volume;
    },
    [ensureAudioNodes, hasSolo, masterVolume, mixState],
  );

  const ensureAudio = useCallback(
    async (trackId: string) => {
      const source = sourceById.get(trackId);
      if (!source) throw new Error("재생할 트랙을 찾을 수 없습니다.");

      let audio = audioRefs.current[trackId];
      if (!audio) {
        audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.preload = "auto";
        audioRefs.current[trackId] = audio;
      }

      const nextUrl = source.url || (resolveSourceUrl ? await resolveSourceUrl(trackId) : "");
      if (!nextUrl) throw new Error("트랙 재생 URL을 불러오지 못했습니다.");
      if (audio.src !== nextUrl) {
        audio.src = nextUrl;
        audio.load();
      }

      ensureAudioNodes(trackId, audio);
      applyMixToAudio(trackId, audio);
      return audio;
    },
    [applyMixToAudio, ensureAudioNodes, resolveSourceUrl, sourceById],
  );

  useEffect(() => {
    Object.entries(audioRefs.current).forEach(([trackId, audio]) => applyMixToAudio(trackId, audio));
  }, [applyMixToAudio]);

  const pauseAudiosOnly = useCallback(() => {
    Object.values(audioRefs.current).forEach((audio) => audio.pause());
  }, []);

  const startProgressLoop = useCallback(() => {
    const update = () => {
      const nextTime = Math.min(duration, Math.max(0, (performance.now() - playStartMsRef.current) / 1000));
      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);

      if (playingRef.current && nextTime < duration) {
        rafRef.current = window.requestAnimationFrame(update);
      } else {
        playingRef.current = false;
        setPlaying(false);
        pauseAudiosOnly();
      }
    };

    stopAnimationFrame();
    rafRef.current = window.requestAnimationFrame(update);
  }, [duration, pauseAudiosOnly, stopAnimationFrame]);

  const scheduleAudioAtTimelineWithOffset = useCallback(
    async (trackId: string, audio: HTMLAudioElement, timelineSeconds: number, effectiveOffsetMs: number) => {
      const offsetSeconds = effectiveOffsetMs / 1000;
      const mediaTime = timelineSeconds - offsetSeconds;
      const maxAudioTime = Math.max(0, audio.duration || sourceById.get(trackId)?.duration || duration);

      if (startTimersRef.current[trackId]) {
        window.clearTimeout(startTimersRef.current[trackId]);
        delete startTimersRef.current[trackId];
      }

      if (mediaTime < 0) {
        audio.pause();
        audio.currentTime = 0;
        const delayMs = Math.min(60_000, Math.abs(mediaTime) * 1000);
        startTimersRef.current[trackId] = window.setTimeout(() => {
          if (!playingRef.current) return;
          audio.currentTime = 0;
          void audio.play();
        }, delayMs);
        return;
      }

      audio.currentTime = Math.max(0, Math.min(mediaTime, maxAudioTime));
      await audio.play();
    },
    [duration, sourceById],
  );

  const scheduleAudioAtTimeline = useCallback(
    async (trackId: string, audio: HTMLAudioElement, timelineSeconds: number) => {
      await scheduleAudioAtTimelineWithOffset(trackId, audio, timelineSeconds, getEffectiveOffsetMs(trackId));
    },
    [getEffectiveOffsetMs, scheduleAudioAtTimelineWithOffset],
  );

  const play = useCallback(async () => {
    const audibleIds = getAudibleSourceIds();
    if (audibleIds.length === 0) return;

    setLoading(true);
    try {
      clearStartTimers();
      pauseAudiosOnly();
      await audioContextRef.current?.resume?.();
      const audios = await Promise.all(audibleIds.map(async (trackId) => [trackId, await ensureAudio(trackId)] as const));
      playStartMsRef.current = performance.now() - currentTimeRef.current * 1000;
      playingRef.current = true;
      await Promise.allSettled(audios.map(([trackId, audio]) => scheduleAudioAtTimeline(trackId, audio, currentTimeRef.current)));
      setPlaying(true);
      startProgressLoop();
    } finally {
      setLoading(false);
    }
  }, [clearStartTimers, ensureAudio, getAudibleSourceIds, pauseAudiosOnly, scheduleAudioAtTimeline, startProgressLoop]);

  const pause = useCallback(() => {
    clearStartTimers();
    pauseAudiosOnly();
    stopAnimationFrame();
    playingRef.current = false;
    setPlaying(false);
  }, [clearStartTimers, pauseAudiosOnly, stopAnimationFrame]);

  const stop = useCallback(() => {
    clearStartTimers();
    Object.values(audioRefs.current).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    stopAnimationFrame();
    currentTimeRef.current = 0;
    playingRef.current = false;
    setCurrentTime(0);
    setPlaying(false);
  }, [clearStartTimers, stopAnimationFrame]);

  const seek = useCallback(
    (time: number) => {
      const nextTime = Math.max(0, Math.min(time, duration));
      const wasPlaying = playingRef.current;
      clearStartTimers();
      pauseAudiosOnly();
      Object.entries(audioRefs.current).forEach(([trackId, audio]) => {
        const mediaTime = nextTime - getEffectiveOffsetMs(trackId) / 1000;
        audio.currentTime = Math.max(0, Math.min(mediaTime, Math.max(0, audio.duration || mediaTime)));
      });
      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      if (wasPlaying) {
        playStartMsRef.current = performance.now() - nextTime * 1000;
        window.setTimeout(() => {
          if (playingRef.current) void play();
        }, 0);
      }
    },
    [clearStartTimers, duration, getEffectiveOffsetMs, pauseAudiosOnly, play],
  );

  const toggleMute = useCallback((trackId: string) => {
    setMixState((current) => ({
      ...current,
      [trackId]: {
        muted: !current[trackId]?.muted,
        solo: current[trackId]?.solo ?? false,
        volume: current[trackId]?.volume ?? 1,
        pan: current[trackId]?.pan ?? 0,
        latencyOffsetMs: current[trackId]?.latencyOffsetMs ?? 0,
        effects: current[trackId]?.effects ?? DEFAULT_TRACK_EFFECTS,
      },
    }));
  }, []);

  const toggleSolo = useCallback((trackId: string) => {
    setMixState((current) => {
      const previous = current[trackId] ?? createDefaultMixState();
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
        pan: current[trackId]?.pan ?? 0,
        latencyOffsetMs: current[trackId]?.latencyOffsetMs ?? 0,
        effects: current[trackId]?.effects ?? DEFAULT_TRACK_EFFECTS,
      },
    }));
  }, []);

  const setPan = useCallback((trackId: string, pan: number) => {
    setMixState((current) => ({
      ...current,
      [trackId]: {
        muted: current[trackId]?.muted ?? false,
        solo: current[trackId]?.solo ?? false,
        volume: current[trackId]?.volume ?? 1,
        pan: Math.max(-1, Math.min(1, pan)),
        latencyOffsetMs: current[trackId]?.latencyOffsetMs ?? 0,
        effects: current[trackId]?.effects ?? DEFAULT_TRACK_EFFECTS,
      },
    }));
  }, []);

  const setEffects = useCallback((trackId: string, effects: TrackEffectSettings) => {
    setMixState((current) => ({
      ...current,
      [trackId]: {
        muted: current[trackId]?.muted ?? false,
        solo: current[trackId]?.solo ?? false,
        volume: current[trackId]?.volume ?? 1,
        pan: current[trackId]?.pan ?? 0,
        latencyOffsetMs: current[trackId]?.latencyOffsetMs ?? 0,
        effects: normalizeTrackEffects(effects),
      },
    }));
  }, []);

  const setLatencyOffset = useCallback(
    (trackId: string, latencyOffsetMs: number) => {
      const safeValue = Math.max(-2000, Math.min(2000, Math.round(latencyOffsetMs)));
      setMixState((current) => ({
        ...current,
        [trackId]: {
          muted: current[trackId]?.muted ?? false,
          solo: current[trackId]?.solo ?? false,
          volume: current[trackId]?.volume ?? 1,
          pan: current[trackId]?.pan ?? 0,
          latencyOffsetMs: safeValue,
          effects: current[trackId]?.effects ?? DEFAULT_TRACK_EFFECTS,
        },
      }));

      const audio = audioRefs.current[trackId];
      if (audio && playingRef.current) {
        const sourceOffsetMs = sourceById.get(trackId)?.offsetMs ?? 0;
        void scheduleAudioAtTimelineWithOffset(trackId, audio, currentTimeRef.current, sourceOffsetMs + safeValue);
      }
    },
    [scheduleAudioAtTimelineWithOffset, sourceById],
  );

  const setMasterVolume = useCallback((volume: number) => {
    const safeVolume = Math.max(0, Math.min(1, volume));
    setMasterVolumeState(safeVolume);
    if (masterGainRef.current) masterGainRef.current.gain.value = safeVolume;
  }, []);

  useEffect(() => {
    return () => {
      stop();
      Object.values(audioRefs.current).forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      audioRefs.current = {};
      audioNodesRef.current = {};
      masterGainRef.current = null;
      void audioContextRef.current?.close?.();
      audioContextRef.current = null;
    };
  }, [stop]);

  return {
    mixState,
    masterVolume,
    currentTime,
    duration,
    playing,
    loading,
    hasSolo,
    panSupported,
    play,
    pause,
    stop,
    seek,
    toggleMute,
    toggleSolo,
    setVolume,
    setPan,
    setEffects,
    setLatencyOffset,
    setMasterVolume,
  };
}

function createDefaultMixState(): TrackMixState {
  return {
    muted: false,
    solo: false,
    volume: 1,
    pan: 0,
    latencyOffsetMs: 0,
    effects: DEFAULT_TRACK_EFFECTS,
  };
}

function applyEffectsToNodes(nodes: AudioNodeSet, effects: TrackEffectSettings) {
  const normalized = normalizeTrackEffects(effects);
  nodes.inputGain.gain.value = dbToGain(normalized.gainDb);
  nodes.lowEq.gain.value = normalized.eq.lowGainDb;
  nodes.midEq.gain.value = normalized.eq.midGainDb;
  nodes.highEq.gain.value = normalized.eq.highGainDb;

  const compressor = getCompressorValues(normalized.compressor.enabled ? normalized.compressor.preset : "off");
  nodes.compressor.threshold.value = compressor.threshold;
  nodes.compressor.ratio.value = compressor.ratio;
  nodes.compressor.attack.value = compressor.attack;
  nodes.compressor.release.value = compressor.release;

  const reverb = getReverbValues(normalized.reverb.type);
  nodes.reverbDelay.delayTime.value = reverb.delayTime;
  nodes.reverbFeedback.gain.value = normalized.reverb.type === "off" ? 0 : reverb.feedback;
  nodes.reverbWetGain.gain.value = normalized.reverb.type === "off" ? 0 : normalized.reverb.amount;
  nodes.dryGain.gain.value = normalized.reverb.type === "off" ? 1 : Math.max(0.55, 1 - normalized.reverb.amount * 0.35);
}
