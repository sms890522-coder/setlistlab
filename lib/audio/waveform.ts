"use client";

export type AudioPeaksResult = {
  peaks: number[];
  duration: number;
};

let sharedAudioContext: AudioContext | null = null;

export async function getAudioPeaksFromUrl(url: string, peakCount = 320): Promise<AudioPeaksResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("오디오 파일을 불러오지 못했습니다.");
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioContext = getWaveformAudioContext();
  const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  return getAudioPeaksFromBuffer(buffer, peakCount);
}

export function getAudioPeaksFromBuffer(buffer: AudioBuffer, peakCount = 320): AudioPeaksResult {
  const channel = buffer.getChannelData(0);
  const peaks: number[] = [];
  const samplesPerPeak = Math.max(1, Math.floor(channel.length / peakCount));

  for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
    const start = peakIndex * samplesPerPeak;
    const end = Math.min(channel.length, start + samplesPerPeak);
    let max = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      max = Math.max(max, Math.abs(channel[sampleIndex] ?? 0));
    }

    peaks.push(max);
  }

  const normalizedMax = Math.max(...peaks, 0.001);
  return {
    peaks: peaks.map((peak) => Math.min(1, peak / normalizedMax)),
    duration: buffer.duration,
  };
}

export function createSyntheticGuidePeaks(peakCount = 320) {
  return Array.from({ length: peakCount }, (_, index) => {
    const pulse = index % 16 === 0 ? 0.95 : index % 8 === 0 ? 0.72 : 0.35;
    const wave = 0.18 + Math.abs(Math.sin(index * 0.22)) * 0.32;
    return Math.min(1, pulse * 0.45 + wave);
  });
}

function getWaveformAudioContext() {
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    sharedAudioContext = new AudioContextClass();
  }

  return sharedAudioContext;
}
