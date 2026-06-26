"use client";

import { audioBufferToWav } from "@/lib/audio/exportWav";

export type MixdownTrackSource = {
  id: string;
  url: string;
  volume: number;
  pan?: number;
  offsetMs?: number;
};

export async function renderMixdownToWavBlob({
  tracks,
  durationSeconds,
  sampleRate = 44100,
}: {
  tracks: MixdownTrackSource[];
  durationSeconds: number;
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

  decodedTracks.forEach((track) => {
    const offsetSec = (track.offsetMs ?? 0) / 1000;
    const startAt = Math.max(0, offsetSec);
    const bufferOffset = Math.max(0, -offsetSec);
    const availableDuration = Math.max(0, track.buffer.duration - bufferOffset);
    if (availableDuration <= 0) return;

    const source = context.createBufferSource();
    const gain = context.createGain();
    const pan = Math.max(-1, Math.min(1, track.pan ?? 0));
    const destination = context.destination;
    source.buffer = track.buffer;
    gain.gain.value = Math.max(0, Math.min(1, track.volume));
    const createStereoPanner =
      typeof context.createStereoPanner === "function" ? context.createStereoPanner.bind(context) : null;
    if (createStereoPanner) {
      const panner = createStereoPanner();
      panner.pan.value = pan;
      source.connect(gain).connect(panner).connect(destination);
    } else {
      source.connect(gain).connect(destination);
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
