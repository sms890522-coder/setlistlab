import type { GuideTrackData, GuideTrackSection } from "@/lib/db/teamGuideTracks";

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

export async function renderGuideTrackToAudioBuffer(data: GuideTrackData) {
  if (typeof OfflineAudioContext === "undefined") {
    throw new Error("현재 브라우저에서는 WAV 렌더링을 지원하지 않습니다.");
  }

  const sampleRate = 44100;
  const bpm = data.bpm && data.bpm > 0 ? data.bpm : 72;
  const beatSec = 60 / bpm;
  const beatsPerBar = getBeatsPerBar(data.timeSignature);
  const countInBars = data.countIn.enabled ? data.countIn.bars : 0;
  const mainBars = data.sections.reduce((sum, section) => sum + Math.max(1, section.bars) * Math.max(1, section.repeat), 0);
  const durationSec = Math.max(1, (countInBars + mainBars) * beatsPerBar * beatSec + 1);
  const context = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);
  const countInSec = countInBars * beatsPerBar * beatSec;
  const voiceCueBuffers = data.voiceCue.enabled && data.voiceCue.announceSections ? await loadVoiceCueBuffers(context, data) : new Map<string, AudioBuffer>();

  if (data.countIn.enabled && data.countIn.click) {
    for (let beat = 0; beat < countInBars * beatsPerBar; beat += 1) {
      const strong = data.metronome.accentFirstBeat && beat % beatsPerBar === 0;
      scheduleClick(context, beat * beatSec, strong, data.metronome.volume || 0.7);
    }
  }

  let cursorSec = countInSec;
  data.sections.forEach((section) => {
    if (data.voiceCue.enabled && data.voiceCue.announceSections) {
      const cueTime = Math.max(0, cursorSec - data.voiceCue.announceBeforeBeats * beatSec);
      const cueBuffer = voiceCueBuffers.get(getVoiceCueSlug(section.label)) ?? voiceCueBuffers.get("section");
      if (cueBuffer) {
        scheduleVoiceCue(context, cueBuffer, cueTime, data.voiceCue.volume);
      }
    }

    for (let repeat = 0; repeat < Math.max(1, section.repeat); repeat += 1) {
      for (let bar = 0; bar < Math.max(1, section.bars); bar += 1) {
        const chord = getBarChord(section, bar);
        if (data.sound !== "click_only") {
          scheduleChord(context, chord, data.sound, cursorSec, beatSec * beatsPerBar * 0.9);
        }
        if (data.metronome.enabled) {
          for (let beat = 0; beat < beatsPerBar; beat += 1) {
            const strong = data.metronome.accentFirstBeat && beat === 0;
            scheduleClick(context, cursorSec + beat * beatSec, strong, data.metronome.volume);
          }
        }
        cursorSec += beatSec * beatsPerBar;
      }
    }
  });

  return context.startRendering();
}

async function loadVoiceCueBuffers(context: BaseAudioContext, data: GuideTrackData) {
  const language = data.voiceCue.language === "ko" ? "ko" : "en";
  const slugs = Array.from(new Set(data.sections.map((section) => getVoiceCueSlug(section.label)).concat("section")));
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const buffer = await fetchVoiceCueBuffer(context, language, slug);
      return [slug, buffer] as const;
    }),
  );

  const buffers = new Map<string, AudioBuffer>();
  entries.forEach(([slug, buffer]) => {
    if (buffer) buffers.set(slug, buffer);
  });
  return buffers;
}

async function fetchVoiceCueBuffer(context: BaseAudioContext, language: "en" | "ko", slug: string) {
  const paths = [`/audio/guide-cues/${language}/${slug}.m4a`, `/audio/guide-cues/en/${slug}.m4a`, "/audio/guide-cues/en/section.m4a"];

  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (!response.ok) continue;
      return await context.decodeAudioData(await response.arrayBuffer());
    } catch {
      // 샘플이 없거나 브라우저 디코딩이 실패하면 다음 fallback을 시도한다.
    }
  }

  return null;
}

function getBarChord(section: GuideTrackSection, bar: number) {
  const chords = section.chords.length > 0 ? section.chords : ["N.C."];
  return chords[bar % chords.length];
}

function getBeatsPerBar(timeSignature: string) {
  const top = Number(timeSignature.split("/")[0]);
  return Number.isFinite(top) && top > 0 ? top : 4;
}

function getVoiceCueSlug(label: string) {
  const normalized = label.trim().toLowerCase();
  if (/인트로|intro/.test(normalized)) return "intro";
  if (/pre|프리/.test(normalized)) return "pre-chorus";
  if (/후렴|chorus/.test(normalized)) return "chorus";
  if (/브릿지|bridge/.test(normalized)) return "bridge";
  if (/간주|interlude/.test(normalized)) return "interlude";
  if (/아웃트로|outro/.test(normalized)) return "outro";
  if (/엔딩|ending/.test(normalized)) return "ending";
  if (/벌스\s*2|verse\s*2|2\s*절|둘째\s*절/.test(normalized)) return "verse-2";
  if (/벌스\s*1|verse\s*1|1\s*절|첫\s*절|첫째\s*절/.test(normalized)) return "verse-1";
  if (/벌스|절|verse/.test(normalized)) return "verse";
  return "section";
}

function scheduleClick(context: BaseAudioContext, time: number, strong: boolean, volume: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = strong ? 1200 : 820;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume) * 0.22, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.09);
}

function scheduleVoiceCue(context: BaseAudioContext, buffer: AudioBuffer, time: number, volume: number) {
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)) * 0.95, time);
  source.connect(gain).connect(context.destination);
  source.start(time);
}

function scheduleChord(context: BaseAudioContext, chord: string, sound: GuideTrackData["sound"], time: number, duration: number) {
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
