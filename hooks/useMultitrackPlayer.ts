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
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const audioNodesRef = useRef<Record<string, AudioNodeSet>>({});
  const activeSourcesRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | null>(null);
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

  const stopActiveSources = useCallback(() => {
    Object.values(activeSourcesRef.current).forEach((source) => {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped or disconnected.
      }
    });
    activeSourcesRef.current = {};
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

  const startAudioEngine = useCallback(async () => {
    try {
      const context = getAudioContext();
      if (context.state === "suspended") {
        await context.resume();
      }
      return true;
    } catch {
      return false;
    }
  }, [getAudioContext]);

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
    (trackId: string) => {
      if (audioNodesRef.current[trackId]) return audioNodesRef.current[trackId];

      try {
        const context = getAudioContext();
        const masterGain = getMasterGain(context);
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

        inputGain.connect(lowEq).connect(midEq).connect(highEq).connect(compressor);
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

  const applyMixToTrack = useCallback(
    (trackId: string) => {
      const state = mixState[trackId];
      const audible = hasSolo ? Boolean(state?.solo) : !state?.muted;
      const volume = Math.max(0, Math.min(1, state?.volume ?? 1));
      const pan = Math.max(-1, Math.min(1, state?.pan ?? 0));
      const effects = normalizeTrackEffects(state?.effects);
      const nodes = audioNodesRef.current[trackId] ?? ensureAudioNodes(trackId);

      if (nodes) {
        applyEffectsToNodes(nodes, effects);
        const now = nodes.trackGain.context.currentTime;
        setAudioParamValue(nodes.trackGain.gain, audible ? volume : 0, now);
        if (nodes.panner) setAudioParamValue(nodes.panner.pan, pan, now);
        if (masterGainRef.current) setAudioParamValue(masterGainRef.current.gain, masterVolume, now);
      }
    },
    [ensureAudioNodes, hasSolo, masterVolume, mixState],
  );

  const loadAudioBuffer = useCallback(
    async (trackId: string) => {
      const source = sourceById.get(trackId);
      if (!source) throw new Error("재생할 트랙을 찾을 수 없습니다.");

      if (audioBuffersRef.current[trackId]) return audioBuffersRef.current[trackId];

      const nextUrl = source.url || (resolveSourceUrl ? await resolveSourceUrl(trackId) : "");
      if (!nextUrl) throw new Error("트랙 재생 URL을 불러오지 못했습니다.");
      const response = await fetch(nextUrl);
      if (!response.ok) {
        throw new Error("트랙 오디오를 불러오지 못했습니다. R2 CORS 설정을 확인해 주세요.");
      }

      const arrayBuffer = await response.arrayBuffer();
      const context = getAudioContext();
      const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
      audioBuffersRef.current[trackId] = buffer;
      ensureAudioNodes(trackId);
      applyMixToTrack(trackId);
      return buffer;
    },
    [applyMixToTrack, ensureAudioNodes, getAudioContext, resolveSourceUrl, sourceById],
  );

  useEffect(() => {
    sources.forEach((source) => applyMixToTrack(source.id));
  }, [applyMixToTrack, sources]);

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
        stopActiveSources();
      }
    };

    stopAnimationFrame();
    rafRef.current = window.requestAnimationFrame(update);
  }, [duration, stopActiveSources, stopAnimationFrame]);

  const scheduleAudioAtTimelineWithOffset = useCallback(
    async (trackId: string, buffer: AudioBuffer, timelineSeconds: number, effectiveOffsetMs: number) => {
      const offsetSeconds = effectiveOffsetMs / 1000;
      const mediaTime = timelineSeconds - offsetSeconds;
      const startDelaySeconds = Math.max(0, -mediaTime);
      const bufferOffsetSeconds = Math.max(0, mediaTime);
      const availableDuration = Math.max(0, buffer.duration - bufferOffsetSeconds);
      if (availableDuration <= 0) return;

      const context = getAudioContext();
      const nodes = ensureAudioNodes(trackId);
      if (!nodes) return;

      const existingSource = activeSourcesRef.current[trackId];
      if (existingSource) {
        try {
          existingSource.onended = null;
          existingSource.stop();
          existingSource.disconnect();
        } catch {
          // Already stopped.
        }
      }

      applyMixToTrack(trackId);
      const bufferSource = context.createBufferSource();
      bufferSource.buffer = buffer;
      bufferSource.connect(nodes.inputGain);
      activeSourcesRef.current[trackId] = bufferSource;
      bufferSource.onended = () => {
        if (activeSourcesRef.current[trackId] === bufferSource) {
          delete activeSourcesRef.current[trackId];
        }
        try {
          bufferSource.disconnect();
        } catch {
          // Already disconnected.
        }
      };
      bufferSource.start(context.currentTime + startDelaySeconds, bufferOffsetSeconds, availableDuration);
    },
    [applyMixToTrack, ensureAudioNodes, getAudioContext],
  );

  const scheduleAudioAtTimeline = useCallback(
    async (trackId: string, buffer: AudioBuffer, timelineSeconds: number) => {
      await scheduleAudioAtTimelineWithOffset(trackId, buffer, timelineSeconds, getEffectiveOffsetMs(trackId));
    },
    [getEffectiveOffsetMs, scheduleAudioAtTimelineWithOffset],
  );

  const play = useCallback(async () => {
    const audibleIds = getAudibleSourceIds();
    if (audibleIds.length === 0) return;

    setLoading(true);
    try {
      stopActiveSources();
      await startAudioEngine();
      const buffers = await Promise.all(audibleIds.map(async (trackId) => [trackId, await loadAudioBuffer(trackId)] as const));
      playStartMsRef.current = performance.now() - currentTimeRef.current * 1000;
      playingRef.current = true;
      await Promise.allSettled(buffers.map(([trackId, buffer]) => scheduleAudioAtTimeline(trackId, buffer, currentTimeRef.current)));
      setPlaying(true);
      startProgressLoop();
    } finally {
      setLoading(false);
    }
  }, [getAudibleSourceIds, loadAudioBuffer, scheduleAudioAtTimeline, startAudioEngine, startProgressLoop, stopActiveSources]);

  useEffect(() => {
    if (!playing) return;
    let cancelled = false;

    async function syncAudibleTracks() {
      await startAudioEngine();
      const audibleIds = getAudibleSourceIds();
      await Promise.allSettled(
        audibleIds.map(async (trackId) => {
          const buffer = await loadAudioBuffer(trackId);
          if (cancelled || !playingRef.current) return;
          if (!activeSourcesRef.current[trackId]) {
            await scheduleAudioAtTimeline(trackId, buffer, currentTimeRef.current);
          }
        }),
      );
    }

    void syncAudibleTracks();
    return () => {
      cancelled = true;
    };
  }, [getAudibleSourceIds, loadAudioBuffer, playing, scheduleAudioAtTimeline, startAudioEngine]);

  const pause = useCallback(() => {
    stopActiveSources();
    stopAnimationFrame();
    playingRef.current = false;
    setPlaying(false);
  }, [stopActiveSources, stopAnimationFrame]);

  const stop = useCallback(() => {
    stopActiveSources();
    stopAnimationFrame();
    currentTimeRef.current = 0;
    playingRef.current = false;
    setCurrentTime(0);
    setPlaying(false);
  }, [stopActiveSources, stopAnimationFrame]);

  const seek = useCallback(
    (time: number) => {
      const nextTime = Math.max(0, Math.min(time, duration));
      const wasPlaying = playingRef.current;
      stopActiveSources();
      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      if (wasPlaying) {
        playStartMsRef.current = performance.now() - nextTime * 1000;
        window.setTimeout(() => {
          if (playingRef.current) void play();
        }, 0);
      }
    },
    [duration, play, stopActiveSources],
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

      const buffer = audioBuffersRef.current[trackId];
      if (buffer && playingRef.current) {
        const sourceOffsetMs = sourceById.get(trackId)?.offsetMs ?? 0;
        void scheduleAudioAtTimelineWithOffset(trackId, buffer, currentTimeRef.current, sourceOffsetMs + safeValue);
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
      audioBuffersRef.current = {};
      audioNodesRef.current = {};
      activeSourcesRef.current = {};
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
  const now = nodes.inputGain.context.currentTime;
  setAudioParamValue(nodes.inputGain.gain, dbToGain(normalized.gainDb), now);
  setAudioParamValue(nodes.lowEq.gain, normalized.eq.lowGainDb, now);
  setAudioParamValue(nodes.midEq.gain, normalized.eq.midGainDb, now);
  setAudioParamValue(nodes.highEq.gain, normalized.eq.highGainDb, now);

  const compressor = getCompressorValues(normalized.compressor.enabled ? normalized.compressor.preset : "off");
  setAudioParamValue(nodes.compressor.threshold, compressor.threshold, now);
  setAudioParamValue(nodes.compressor.ratio, compressor.ratio, now);
  setAudioParamValue(nodes.compressor.attack, compressor.attack, now);
  setAudioParamValue(nodes.compressor.release, compressor.release, now);

  const reverb = getReverbValues(normalized.reverb.type);
  setAudioParamValue(nodes.reverbDelay.delayTime, reverb.delayTime, now);
  setAudioParamValue(nodes.reverbFeedback.gain, normalized.reverb.type === "off" ? 0 : reverb.feedback, now);
  setAudioParamValue(nodes.reverbWetGain.gain, normalized.reverb.type === "off" ? 0 : normalized.reverb.amount, now);
  setAudioParamValue(nodes.dryGain.gain, normalized.reverb.type === "off" ? 1 : Math.max(0.55, 1 - normalized.reverb.amount * 0.35), now);
}

function setAudioParamValue(param: AudioParam, value: number, currentTime: number) {
  try {
    param.cancelScheduledValues(currentTime);
    param.setValueAtTime(value, currentTime);
  } catch {
    param.value = value;
  }
}
