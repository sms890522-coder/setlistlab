"use client";

import { audioBufferToWav } from "@/lib/audio/exportWav";
import {
  dbToGain,
  getCompressorValues,
  getReverbValues,
  normalizeTrackEffects,
  type TrackEffectSettings,
} from "@/lib/audio/trackEffects";

export type MixdownTrackSource = {
  id: string;
  url: string;
  volume: number;
  pan?: number;
  offsetMs?: number;
  effects?: TrackEffectSettings;
};

export async function renderMixdownToWavBlob({
  tracks,
  durationSeconds,
  masterVolume = 1,
  sampleRate = 44100,
}: {
  tracks: MixdownTrackSource[];
  durationSeconds: number;
  masterVolume?: number;
  sampleRate?: number;
}) {
  if (tracks.length === 0) {
    throw new Error("믹스다운할 트랙이 없습니다.");
  }

  if (typeof OfflineAudioContext === "undefined") {
    throw new Error("현재 브라우저에서는 믹스다운 다운로드를 지원하지 않습니다.");
  }

  const decodeContext = createDecodeAudioContext();
  const decodedTracks = await Promise.all(
    tracks.map(async (track) => ({
      ...track,
      buffer: await fetchAndDecodeAudioBuffer(decodeContext, track.url),
    })),
  );

  await decodeContext.close?.();

  const outputDuration = Math.max(
    1,
    durationSeconds,
    ...decodedTracks.map((track) => track.buffer.duration + Math.max(0, (track.offsetMs ?? 0) / 1000)),
  );
  const context = new OfflineAudioContext(2, Math.ceil((outputDuration + 0.25) * sampleRate), sampleRate);
  const masterGain = context.createGain();
  masterGain.gain.value = Math.max(0, Math.min(1, masterVolume));
  masterGain.connect(context.destination);

  decodedTracks.forEach((track) => {
    const offsetSec = (track.offsetMs ?? 0) / 1000;
    const startAt = Math.max(0, offsetSec);
    const bufferOffset = Math.max(0, -offsetSec);
    const availableDuration = Math.max(0, track.buffer.duration - bufferOffset);
    if (availableDuration <= 0) return;

    const source = context.createBufferSource();
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
    const pan = Math.max(-1, Math.min(1, track.pan ?? 0));
    source.buffer = track.buffer;
    trackGain.gain.value = Math.max(0, Math.min(1, track.volume));
    applyOfflineEffects({
      inputGain,
      lowEq,
      midEq,
      highEq,
      compressor,
      dryGain,
      reverbDelay,
      reverbFeedback,
      reverbWetGain,
      effects: track.effects,
    });

    const createStereoPanner =
      typeof context.createStereoPanner === "function" ? context.createStereoPanner.bind(context) : null;
    source.connect(inputGain).connect(lowEq).connect(midEq).connect(highEq).connect(compressor);
    compressor.connect(dryGain);
    compressor.connect(reverbDelay);
    reverbDelay.connect(reverbWetGain);
    reverbDelay.connect(reverbFeedback).connect(reverbDelay);

    if (createStereoPanner) {
      const panner = createStereoPanner();
      panner.pan.value = pan;
      dryGain.connect(panner);
      reverbWetGain.connect(panner);
      panner.connect(trackGain).connect(masterGain);
    } else {
      dryGain.connect(trackGain);
      reverbWetGain.connect(trackGain);
      trackGain.connect(masterGain);
    }
    source.start(startAt, bufferOffset, availableDuration);
  });

  const rendered = await context.startRendering();
  return new Blob([audioBufferToWav(rendered)], { type: "audio/wav" });
}

async function fetchAndDecodeAudioBuffer(context: AudioContext, url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("오디오 파일을 불러오지 못했습니다.");
  }

  const arrayBuffer = await response.arrayBuffer();
  return context.decodeAudioData(arrayBuffer.slice(0));
}

function createDecodeAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  return new AudioContextConstructor();
}

function applyOfflineEffects({
  inputGain,
  lowEq,
  midEq,
  highEq,
  compressor,
  dryGain,
  reverbDelay,
  reverbFeedback,
  reverbWetGain,
  effects,
}: {
  inputGain: GainNode;
  lowEq: BiquadFilterNode;
  midEq: BiquadFilterNode;
  highEq: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  dryGain: GainNode;
  reverbDelay: DelayNode;
  reverbFeedback: GainNode;
  reverbWetGain: GainNode;
  effects?: TrackEffectSettings;
}) {
  const normalized = normalizeTrackEffects(effects);
  inputGain.gain.value = dbToGain(normalized.gainDb);
  lowEq.type = "lowshelf";
  lowEq.frequency.value = 120;
  lowEq.gain.value = normalized.eq.lowGainDb;
  midEq.type = "peaking";
  midEq.frequency.value = 1000;
  midEq.Q.value = 1;
  midEq.gain.value = normalized.eq.midGainDb;
  highEq.type = "highshelf";
  highEq.frequency.value = 8000;
  highEq.gain.value = normalized.eq.highGainDb;

  const compressorValues = getCompressorValues(normalized.compressor.enabled ? normalized.compressor.preset : "off");
  compressor.threshold.value = compressorValues.threshold;
  compressor.ratio.value = compressorValues.ratio;
  compressor.attack.value = compressorValues.attack;
  compressor.release.value = compressorValues.release;

  const reverbValues = getReverbValues(normalized.reverb.type);
  reverbDelay.delayTime.value = reverbValues.delayTime;
  reverbFeedback.gain.value = normalized.reverb.type === "off" ? 0 : reverbValues.feedback;
  reverbWetGain.gain.value = normalized.reverb.type === "off" ? 0 : normalized.reverb.amount;
  dryGain.gain.value = normalized.reverb.type === "off" ? 1 : Math.max(0.55, 1 - normalized.reverb.amount * 0.35);
}
