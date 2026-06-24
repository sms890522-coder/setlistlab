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

  if (data.countIn.enabled && data.countIn.click) {
    for (let beat = 0; beat < countInBars * beatsPerBar; beat += 1) {
      const strong = data.metronome.accentFirstBeat && beat % beatsPerBar === 0;
      scheduleClick(context, beat * beatSec, strong, data.metronome.volume || 0.7);
    }
  }

  let cursorSec = countInSec;
  data.sections.forEach((section) => {
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

function getBarChord(section: GuideTrackSection, bar: number) {
  const chords = section.chords.length > 0 ? section.chords : ["N.C."];
  return chords[bar % chords.length];
}

function getBeatsPerBar(timeSignature: string) {
  const top = Number(timeSignature.split("/")[0]);
  return Number.isFinite(top) && top > 0 ? top : 4;
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
