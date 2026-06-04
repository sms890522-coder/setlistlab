import type { CapoSuggestion } from "./types";

const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const NOTE_INDEX: Record<string, number> = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
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
  Cb: 11,
};

export const MUSIC_KEY_OPTIONS = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
  "Cm",
  "C#m",
  "Dm",
  "D#m",
  "Ebm",
  "Em",
  "Fm",
  "F#m",
  "Gm",
  "G#m",
  "Abm",
  "Am",
  "A#m",
  "Bbm",
  "Bm",
] as const;

export function normalizeKey(key: string) {
  const cleaned = key.trim().replaceAll("♯", "#").replaceAll("♭", "b");
  const match = cleaned.match(/^([A-Ga-g](?:#|b)?)(m)?$/);
  if (!match) return cleaned;

  const root = `${match[1][0].toUpperCase()}${match[1].slice(1)}`;
  const noteIndex = NOTE_INDEX[root];
  if (typeof noteIndex !== "number") return cleaned;
  return `${SHARP_NOTES[noteIndex]}${match[2] ? "m" : ""}`;
}

export function getSemitoneDistance(fromKey: string, toKey: string) {
  const fromIndex = getKeyIndex(fromKey);
  const toIndex = getKeyIndex(toKey);
  if (fromIndex < 0 || toIndex < 0) return 0;
  return (toIndex - fromIndex + 12) % 12;
}

export function transposeChord(chord: string, semitones: number) {
  const match = chord.trim().match(/^([A-Ga-g](?:#|b)?)([^/\s]*)(?:\/([A-Ga-g](?:#|b)?))?$/);
  if (!match || !isChordSuffix(match[2])) return chord;

  const root = transposeNote(match[1], semitones);
  if (!root) return chord;
  const bass = match[3] ? transposeNote(match[3], semitones) : "";
  return `${root}${match[2]}${bass ? `/${bass}` : ""}`;
}

export function transposeChordProgression(progression: string, fromKey: string, toKey: string) {
  const semitones = getSemitoneDistance(fromKey, toKey);
  return progression
    .split(/(\s+|[-|,;:()[\]])/)
    .map((token) => transposeChord(token, semitones))
    .join("");
}

export function getCapoSuggestions(targetKey: string): CapoSuggestion[] {
  const normalizedTarget = normalizeKey(targetKey);
  const isMinor = normalizedTarget.endsWith("m");
  const chordForms = isMinor ? ["Am", "Em", "Dm", "Bm"] : ["C", "D", "E", "G", "A"];

  return chordForms
    .map((chordForm) => {
      const capo = getSemitoneDistance(chordForm, normalizedTarget);
      return {
        chordForm,
        capo,
        actualKey: normalizedTarget,
        label: `${chordForm}폼 / 카포 ${capo}`,
      };
    })
    .filter((suggestion) => suggestion.capo <= 9)
    .sort((a, b) => a.capo - b.capo || a.chordForm.localeCompare(b.chordForm));
}

function getKeyIndex(key: string) {
  const normalized = normalizeKey(key).replace(/m$/, "");
  return SHARP_NOTES.indexOf(normalized as (typeof SHARP_NOTES)[number]);
}

function transposeNote(note: string, semitones: number) {
  const normalized = normalizeKey(note).replace(/m$/, "");
  const index = SHARP_NOTES.indexOf(normalized as (typeof SHARP_NOTES)[number]);
  if (index < 0) return "";
  return SHARP_NOTES[(index + semitones + 120) % 12];
}

function isChordSuffix(suffix: string) {
  return /^(?:(?:m|maj|min|dim|aug|sus|add)?\d*(?:[#b]\d+)?(?:sus\d+|add\d+)?)?$/i.test(suffix);
}
