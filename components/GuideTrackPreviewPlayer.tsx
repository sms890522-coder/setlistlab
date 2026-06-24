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
  | { timeSec: number; type: "click"; strong: boolean; volume: number }
  | { timeSec: number; type: "chord"; chord: string; sectionLabel: string; durationSec: number }
  | { timeSec: number; type: "speech"; text: string; language: "en" | "ko"; volume: number };

type SectionRange = {
  startSec: number;
  endSec: number;
  label: string;
};

type PlaybackTimeline = {
  events: PlaybackEvent[];
  sectionRanges: SectionRange[];
  beatSec: number;
  beatsPerBar: number;
  countInSec: number;
  durationSec: number;
};

type PlaybackSession = {
  startAt: number;
  songStartAt: number;
  endAt: number;
  timeline: PlaybackTimeline;
};

type PlaybackPhase = "idle" | "countIn" | "playing";

export function GuideTrackPreviewPlayer({ data }: GuideTrackPreviewPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentLabel, setCurrentLabel] = useState("");
  const [speechWarning, setSpeechWarning] = useState("");
  const [phase, setPhase] = useState<PlaybackPhase>("idle");
  const [beatInBar, setBeatInBar] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timeoutRefs = useRef<number[]>([]);
  const animationRef = useRef<number | null>(null);
  const playbackRef = useRef<PlaybackSession | null>(null);

  const bpm = data.bpm && data.bpm > 0 ? data.bpm : 72;
  const beatsPerBar = getBeatsPerBar(data.timeSignature);
  const timeline = useMemo(() => buildPlaybackTimeline(data), [data]);
  const totalBars = data.totalBars || data.sections.reduce((sum, section) => sum + section.bars * section.repeat, 0);
  const showVisualCounter = playing && data.countIn.visualCounter !== false;

  useEffect(() => {
    return () => stop();
  }, []);

  function stop() {
    timeoutRefs.current.forEach((timerId) => window.clearTimeout(timerId));
    timeoutRefs.current = [];
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    window.speechSynthesis?.cancel();
    playbackRef.current = null;
    setPlaying(false);
    setCurrentLabel("");
    setPhase("idle");
    setBeatInBar(0);
  }

  async function start() {
    if (timeline.events.length === 0) return;

    stop();
    setSpeechWarning("");

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    await audioContextRef.current.resume();

    setPlaying(true);
    setCurrentLabel(data.countIn.enabled ? "카운트인" : "재생 준비");

    const context = audioContextRef.current;
    const startAt = context.currentTime + 0.08;
    const session: PlaybackSession = {
      startAt,
      songStartAt: startAt + timeline.countInSec,
      endAt: startAt + timeline.durationSec,
      timeline,
    };
    playbackRef.current = session;

    timeline.events.forEach((event) => {
      const eventTime = startAt + event.timeSec;
      if (event.type === "click") {
        playClick(context, eventTime, event.strong, event.volume);
      } else if (event.type === "chord") {
        if (data.sound !== "click_only") {
          playChord(context, eventTime, event.chord, data.sound, event.durationSec);
        }
      } else if (event.type === "speech") {
        const delayMs = Math.max(0, (eventTime - context.currentTime) * 1000);
        const timerId = window.setTimeout(() => speak(event.text, event.language, event.volume), delayMs);
        timeoutRefs.current.push(timerId);
      }
    });

    startVisualCounter();

    const endDelayMs = Math.max(0, (session.endAt - context.currentTime) * 1000) + 250;
    timeoutRefs.current.push(window.setTimeout(stop, endDelayMs));
  }

  function startVisualCounter() {
    const update = () => {
      const context = audioContextRef.current;
      const session = playbackRef.current;
      if (!context || !session) return;

      const now = context.currentTime;
      const { beatSec, beatsPerBar: timelineBeatsPerBar, sectionRanges } = session.timeline;
      if (now < session.songStartAt && data.countIn.enabled) {
        const elapsed = Math.max(0, now - session.startAt);
        const beatIndex = Math.floor(elapsed / beatSec);
        setPhase("countIn");
        setBeatInBar((beatIndex % timelineBeatsPerBar) + 1);
        setCurrentLabel("카운트인");
      } else if (now <= session.endAt) {
        const songElapsed = Math.max(0, now - session.songStartAt);
        const beatIndex = Math.floor(songElapsed / beatSec);
        const currentSection = sectionRanges.find((section) => songElapsed >= section.startSec && songElapsed < section.endSec);
        setPhase("playing");
        setBeatInBar((beatIndex % timelineBeatsPerBar) + 1);
        setCurrentLabel(currentSection?.label ?? "재생 중");
      } else {
        stop();
        return;
      }

      animationRef.current = window.requestAnimationFrame(update);
    };

    animationRef.current = window.requestAnimationFrame(update);
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
      // TODO: 다운로드까지 정확히 포함하려면 Web Speech 대신 샘플 기반 구간 안내로 교체한다.
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
            카운트인, 메트로놈, 코드 패드와 화면 박자 카운터를 브라우저에서 확인합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={playing ? stop : start} disabled={timeline.events.length === 0} className="btn-primary min-h-11">
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
      {showVisualCounter ? (
        <div className="mt-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">{phase === "countIn" ? "카운트인" : currentLabel || "재생 중"}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">현재 박자: {beatInBar || 1}</p>
            </div>
            <div className={`flex size-14 items-center justify-center rounded-full text-3xl font-black shadow-sm ${beatInBar === 1 ? "bg-blue-600 text-white" : "bg-white text-blue-700"}`}>
              {beatInBar || 1}
            </div>
          </div>
          <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${beatsPerBar}, minmax(0, 1fr))` }}>
            {Array.from({ length: beatsPerBar }, (_, index) => {
              const number = index + 1;
              const active = number === beatInBar;
              const strong = number === 1;
              return (
                <div
                  key={number}
                  className={`flex min-h-10 items-center justify-center rounded-full text-sm font-black transition-all ${
                    active
                      ? strong
                        ? "scale-105 bg-blue-600 text-white shadow-md"
                        : "scale-105 bg-blue-100 text-blue-800 ring-2 ring-blue-300"
                      : strong
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {number}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {speechWarning ? <p className="mt-2 text-xs font-semibold text-amber-700">{speechWarning}</p> : null}
    </div>
  );
}

function buildPlaybackTimeline(data: GuideTrackData): PlaybackTimeline {
  const bpm = data.bpm && data.bpm > 0 ? data.bpm : 72;
  const beatSec = 60 / bpm;
  const beatsPerBar = getBeatsPerBar(data.timeSignature);
  const events: PlaybackEvent[] = [];
  const sectionRanges: SectionRange[] = [];
  const countInBeats = data.countIn.enabled ? data.countIn.bars * beatsPerBar : 0;

  for (let beat = 0; beat < countInBeats; beat += 1) {
    const timeSec = beat * beatSec;
    const beatNumber = beat % beatsPerBar;
    if (data.countIn.click) {
      events.push({
        timeSec,
        type: "click",
        strong: data.metronome.accentFirstBeat && beatNumber === 0,
        volume: data.metronome.volume,
      });
    }
  }

  const countInSec = countInBeats * beatSec;
  let cursorSec = countInSec;
  data.sections.forEach((section) => {
    const sectionStartSec = cursorSec - countInSec;
    const cueText = normalizeSectionCue(section.label);
    if (data.voiceCue.enabled && data.voiceCue.announceSections) {
      events.push({
        timeSec: Math.max(0, cursorSec - data.voiceCue.announceBeforeBeats * beatSec),
        type: "speech",
        text: cueText,
        language: data.voiceCue.language,
        volume: data.voiceCue.volume,
      });
    }

    for (let repeat = 0; repeat < Math.max(1, section.repeat); repeat += 1) {
      for (let bar = 0; bar < Math.max(1, section.bars); bar += 1) {
        const chord = getBarChord(section, bar);
        events.push({ timeSec: cursorSec, type: "chord", chord, sectionLabel: section.label, durationSec: beatSec * beatsPerBar * 0.9 });
        if (data.metronome.enabled) {
          for (let beat = 0; beat < beatsPerBar; beat += 1) {
            events.push({
              timeSec: cursorSec + beat * beatSec,
              type: "click",
              strong: data.metronome.accentFirstBeat && beat === 0,
              volume: data.metronome.volume,
            });
          }
        }
        cursorSec += beatSec * beatsPerBar;
      }
    }
    sectionRanges.push({
      startSec: sectionStartSec,
      endSec: Math.max(sectionStartSec, cursorSec - countInSec),
      label: section.label,
    });
  });

  return {
    events: events.sort((a, b) => a.timeSec - b.timeSec),
    sectionRanges,
    beatSec,
    beatsPerBar,
    countInSec,
    durationSec: cursorSec,
  };
}

function getBarChord(section: GuideTrackSection, bar: number) {
  const chords = section.chords.length > 0 ? section.chords : ["N.C."];
  return chords[bar % chords.length];
}

function getBeatsPerBar(timeSignature: string) {
  const top = Number(timeSignature.split("/")[0]);
  return Number.isFinite(top) && top > 0 ? top : 4;
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
