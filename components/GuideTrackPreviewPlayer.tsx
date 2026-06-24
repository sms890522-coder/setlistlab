"use client";

import type { GuideTrackData, GuideTrackSection } from "@/lib/db/teamGuideTracks";
import { useEffect, useMemo, useRef, useState } from "react";

type GuideTrackPreviewPlayerProps = {
  data: GuideTrackData;
};

const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

export function GuideTrackPreviewPlayer({ data }: GuideTrackPreviewPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentLabel, setCurrentLabel] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepIndexRef = useRef(0);

  const steps = useMemo(() => buildPlaybackSteps(data.sections), [data.sections]);
  const bpm = data.bpm && data.bpm > 0 ? data.bpm : 72;
  const beatMs = 60000 / bpm;

  useEffect(() => {
    return () => stop();
  }, []);

  function stop() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPlaying(false);
    setCurrentLabel("");
    stepIndexRef.current = 0;
  }

  async function start() {
    if (steps.length === 0) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    await audioContextRef.current.resume();

    stepIndexRef.current = 0;
    setPlaying(true);
    playNextStep();
  }

  function playNextStep() {
    const context = audioContextRef.current;
    if (!context) return;

    const step = steps[stepIndexRef.current];
    if (!step) {
      stop();
      return;
    }

    setCurrentLabel(`${step.sectionLabel} · ${step.chord}`);
    playClick(context, stepIndexRef.current === 0);
    if (data.sound !== "click_only") {
      playChord(context, step.chord, data.sound);
    }

    stepIndexRef.current += 1;
    timerRef.current = window.setTimeout(playNextStep, beatMs * 4);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">가이드 트랙 미리듣기</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            브라우저에서 코드 진행과 클릭을 간단히 확인합니다. 실제 오디오 파일 생성은 이후 팀 녹음실 단계에서 확장할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={playing ? stop : start} disabled={steps.length === 0} className="btn-primary min-h-11">
            {playing ? "정지" : "재생"}
          </button>
          <button type="button" onClick={stop} className="btn-secondary min-h-11">
            처음으로
          </button>
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
        {currentLabel || `BPM ${bpm} · ${data.timeSignature} · 총 ${data.totalBars}마디`}
      </p>
    </div>
  );
}

function buildPlaybackSteps(sections: GuideTrackSection[]) {
  return sections.flatMap((section) => {
    const chords = section.chords.length > 0 ? section.chords : ["N.C."];
    const steps: Array<{ sectionLabel: string; chord: string }> = [];
    for (let repeat = 0; repeat < Math.max(1, section.repeat); repeat += 1) {
      for (let bar = 0; bar < Math.max(1, section.bars); bar += 1) {
        steps.push({ sectionLabel: section.label, chord: chords[bar % chords.length] });
      }
    }
    return steps;
  });
}

function playClick(context: AudioContext, strong: boolean) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = strong ? 1200 : 820;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.08);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.09);
}

function playChord(context: AudioContext, chord: string, sound: GuideTrackData["sound"]) {
  const root = chord.match(/^([A-G](?:#|b)?)/)?.[1];
  if (!root || chord === "N.C.") return;

  const rootFrequency = noteToFrequency(root, 3);
  const minor = /m(?!aj)/.test(chord);
  const tones = minor ? [0, 3, 7] : [0, 4, 7];
  const duration = sound === "pad" || sound === "piano_pad" ? 1.6 : 0.75;

  tones.forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = sound === "pad" ? "sine" : "triangle";
    oscillator.frequency.value = rootFrequency * 2 ** (offset / 12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.08 : 0.045, context.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.05);
  });
}

function noteToFrequency(note: string, octave: number) {
  const offset = NOTE_OFFSETS[note] ?? 0;
  const midi = 12 * (octave + 1) + offset;
  return 440 * 2 ** ((midi - 69) / 12);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
