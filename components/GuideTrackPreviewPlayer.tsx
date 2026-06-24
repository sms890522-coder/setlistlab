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

type PlaybackEvent =
  | { timeMs: number; type: "click"; strong: boolean; volume: number }
  | { timeMs: number; type: "chord"; chord: string; sectionLabel: string; durationMs: number }
  | { timeMs: number; type: "label"; label: string }
  | { timeMs: number; type: "speech"; text: string; language: "en" | "ko"; volume: number };

export function GuideTrackPreviewPlayer({ data }: GuideTrackPreviewPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentLabel, setCurrentLabel] = useState("");
  const [speechWarning, setSpeechWarning] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const timeoutRefs = useRef<number[]>([]);

  const bpm = data.bpm && data.bpm > 0 ? data.bpm : 72;
  const beatMs = 60000 / bpm;
  const beatsPerBar = getBeatsPerBar(data.timeSignature);
  const events = useMemo(() => buildPlaybackEvents(data), [data]);
  const totalBars = data.totalBars || data.sections.reduce((sum, section) => sum + section.bars * section.repeat, 0);

  useEffect(() => {
    return () => stop();
  }, []);

  function stop() {
    timeoutRefs.current.forEach((timerId) => window.clearTimeout(timerId));
    timeoutRefs.current = [];
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setCurrentLabel("");
  }

  async function start() {
    if (events.length === 0) return;

    stop();
    setSpeechWarning("");

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    await audioContextRef.current.resume();

    setPlaying(true);
    setCurrentLabel(data.countIn.enabled ? "Count-in" : "Ready");

    const startAt = audioContextRef.current.currentTime + 0.05;
    events.forEach((event) => {
      const timerId = window.setTimeout(() => handlePlaybackEvent(event, startAt), event.timeMs);
      timeoutRefs.current.push(timerId);
    });

    const endTimeMs = Math.max(...events.map((event) => event.timeMs), 0) + beatMs * beatsPerBar + 200;
    timeoutRefs.current.push(window.setTimeout(stop, endTimeMs));
  }

  function handlePlaybackEvent(event: PlaybackEvent, startAt: number) {
    const context = audioContextRef.current;
    if (!context) return;

    const eventTime = startAt + event.timeMs / 1000;
    if (event.type === "click") {
      playClick(context, eventTime, event.strong, event.volume);
      return;
    }
    if (event.type === "chord") {
      setCurrentLabel(`${event.sectionLabel} · ${event.chord}`);
      if (data.sound !== "click_only") {
        playChord(context, eventTime, event.chord, data.sound, event.durationMs / 1000);
      }
      return;
    }
    if (event.type === "label") {
      setCurrentLabel(event.label);
      return;
    }
    if (event.type === "speech") {
      speak(event.text, event.language, event.volume);
    }
  }

  function speak(text: string, language: "en" | "ko", volume: number) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setSpeechWarning("현재 브라우저에서는 음성 안내를 지원하지 않습니다.");
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "ko" ? "ko-KR" : "en-US";
      utterance.rate = 1.15;
      utterance.pitch = 1;
      utterance.volume = Math.max(0, Math.min(1, volume));
      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeechWarning("음성 안내를 재생하지 못했습니다. 클릭과 코드 가이드는 계속 재생됩니다.");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">가이드 트랙 미리듣기</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            카운트인, 메트로놈, 코드 패드와 송폼 음성 안내를 브라우저에서 확인합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={playing ? stop : start} disabled={events.length === 0} className="btn-primary min-h-11">
            {playing ? "정지" : "재생"}
          </button>
          <button type="button" onClick={stop} className="btn-secondary min-h-11">
            처음으로
          </button>
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
        {currentLabel || `BPM ${bpm} · ${data.timeSignature} · 총 ${totalBars}마디`}
      </p>
      {speechWarning ? <p className="mt-2 text-xs font-semibold text-amber-700">{speechWarning}</p> : null}
    </div>
  );
}

function buildPlaybackEvents(data: GuideTrackData): PlaybackEvent[] {
  const bpm = data.bpm && data.bpm > 0 ? data.bpm : 72;
  const beatMs = 60000 / bpm;
  const beatsPerBar = getBeatsPerBar(data.timeSignature);
  const events: PlaybackEvent[] = [];
  const countInBeats = data.countIn.enabled ? data.countIn.bars * beatsPerBar : 0;
  const countWords = getCountWords(data.voiceCue.language, beatsPerBar);

  for (let beat = 0; beat < countInBeats; beat += 1) {
    const timeMs = beat * beatMs;
    const beatNumber = beat % beatsPerBar;
    events.push({ timeMs, type: "label", label: `Count-in ${beatNumber + 1}` });
    if (data.countIn.click) {
      events.push({
        timeMs,
        type: "click",
        strong: data.metronome.accentFirstBeat && beatNumber === 0,
        volume: data.metronome.volume,
      });
    }
    if (data.countIn.voice) {
      events.push({
        timeMs: timeMs + 10,
        type: "speech",
        text: countWords[beatNumber] ?? String(beatNumber + 1),
        language: data.voiceCue.language,
        volume: data.voiceCue.volume,
      });
    }
  }

  let cursorMs = countInBeats * beatMs;
  data.sections.forEach((section) => {
    const cueText = normalizeSectionCue(section.label);
    if (data.voiceCue.enabled && data.voiceCue.announceSections) {
      events.push({
        timeMs: Math.max(0, cursorMs - data.voiceCue.announceBeforeBeats * beatMs),
        type: "speech",
        text: cueText,
        language: data.voiceCue.language,
        volume: data.voiceCue.volume,
      });
    }

    for (let repeat = 0; repeat < Math.max(1, section.repeat); repeat += 1) {
      for (let bar = 0; bar < Math.max(1, section.bars); bar += 1) {
        const chord = getBarChord(section, bar);
        events.push({ timeMs: cursorMs, type: "chord", chord, sectionLabel: section.label, durationMs: beatMs * beatsPerBar * 0.9 });
        if (data.metronome.enabled) {
          for (let beat = 0; beat < beatsPerBar; beat += 1) {
            events.push({
              timeMs: cursorMs + beat * beatMs,
              type: "click",
              strong: data.metronome.accentFirstBeat && beat === 0,
              volume: data.metronome.volume,
            });
          }
        }
        cursorMs += beatMs * beatsPerBar;
      }
    }
  });

  return events.sort((a, b) => a.timeMs - b.timeMs);
}

function getBarChord(section: GuideTrackSection, bar: number) {
  const chords = section.chords.length > 0 ? section.chords : ["N.C."];
  return chords[bar % chords.length];
}

function getBeatsPerBar(timeSignature: string) {
  const top = Number(timeSignature.split("/")[0]);
  return Number.isFinite(top) && top > 0 ? top : 4;
}

function getCountWords(language: "en" | "ko", beatsPerBar: number) {
  const words =
    language === "ko"
      ? ["하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟"]
      : ["one", "two", "three", "four", "five", "six", "seven", "eight"];
  return words.slice(0, Math.max(1, beatsPerBar));
}

function normalizeSectionCue(label: string) {
  const normalized = label.trim().toLowerCase();
  if (/인트로|intro/.test(normalized)) return "Intro";
  if (/pre|프리/.test(normalized)) return "Pre-Chorus";
  if (/후렴|chorus/.test(normalized)) return "Chorus";
  if (/브릿지|bridge/.test(normalized)) return "Bridge";
  if (/간주|interlude/.test(normalized)) return "Interlude";
  if (/아웃트로|outro/.test(normalized)) return "Outro";
  if (/엔딩|ending/.test(normalized)) return "Ending";
  if (/벌스|절|verse\s*2/.test(normalized)) return /2/.test(normalized) ? "Verse 2" : "Verse";
  return label || "Section";
}

function playClick(context: AudioContext, time: number, strong: boolean, volume: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = strong ? 1200 : 820;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume) * 0.16, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.09);
}

function playChord(context: AudioContext, time: number, chord: string, sound: GuideTrackData["sound"], duration: number) {
  const root = chord.match(/^([A-G](?:#|b)?)/)?.[1];
  if (!root || chord === "N.C.") return;

  const rootFrequency = noteToFrequency(root, 3);
  const minor = /m(?!aj)/.test(chord);
  const tones = minor ? [0, 3, 7] : [0, 4, 7];
  const oscillatorType: OscillatorType = sound === "pad" ? "sine" : "triangle";

  tones.forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = oscillatorType;
    oscillator.frequency.value = rootFrequency * 2 ** (offset / 12);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.08 : 0.045, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.2, duration));
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + Math.max(0.25, duration) + 0.05);
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
