export type ChordCandidateSource = "image" | "manual" | "tesseract";

export type ChordCandidate = {
  chord: string;
  rawText: string;
  confidence: number;
  source: ChordCandidateSource;
  needsReview?: boolean;
};

const CHORD_PATTERN =
  /^[A-G](?:#|b)?(?:(?:m|min|maj|dim|aug|sus|add)?\d{0,2}|(?:m|min|maj|dim|aug|sus|add)\d{0,2})?(?:\/[A-G](?:#|b)?)?$/i;

const RAW_TOKEN_SPLIT_PATTERN = /[\s,;|]+/;
const OCR_COMMON_REPLACEMENTS: Array<[RegExp, string]> = [
  [/♭/g, "b"],
  [/♯/g, "#"],
  [/\s*\/\s*/g, "/"],
  [/\b([A-Ga-g])\s+([#b])\b/g, "$1$2"],
  [/\b([A-Ga-g][#b]?)\s+(m|min|maj|dim|aug|sus|add)(\d{0,2})\b/g, "$1$2$3"],
];

export function normalizeChord(chord: string) {
  const token = sanitizeChordToken(chord);
  if (!token) return "";

  const slashParts = token.split("/");
  const normalizedRoot = normalizeRoot(slashParts[0]);
  if (!normalizedRoot) return token;

  if (slashParts.length === 1) return normalizedRoot;

  const bass = normalizeBass(slashParts[1]);
  return bass ? `${normalizedRoot}/${bass}` : normalizedRoot;
}

export function parseChordLine(input: string): string[] {
  return prepareOcrChordText(input)
    .replace(/\|/g, " ")
    .replace(/,/g, " ")
    .split(/\s+/)
    .map((token) => normalizeChord(token))
    .filter(Boolean);
}

export function isLikelyChord(token: string) {
  const normalized = normalizeChord(token);
  return CHORD_PATTERN.test(normalized);
}

export function extractChordCandidatesFromText(rawText: string): ChordCandidate[] {
  const candidates: ChordCandidate[] = [];
  const prepared = prepareOcrChordText(rawText);

  prepared.split(/\n+/).forEach((line) => {
    line
      .split(RAW_TOKEN_SPLIT_PATTERN)
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((rawToken) => {
        const normalized = normalizeChord(rawToken);
        if (!normalized || normalized.length > 14 || !isLikelyChord(normalized)) return;

        const confidence = calculateHeuristicConfidence(rawToken, normalized);
        candidates.push({
          chord: normalized,
          rawText: rawToken,
          confidence,
          source: "tesseract",
          needsReview: confidence < 0.7,
        });
      });
  });

  return dedupeChords(candidates);
}

export function dedupeChords<T extends { chord: string; confidence?: number }>(chords: T[]): T[] {
  const map = new Map<string, T>();

  chords.forEach((item) => {
    const normalized = normalizeChord(item.chord);
    if (!normalized) return;

    const normalizedItem = { ...item, chord: normalized } as T;
    const existing = map.get(normalized);
    if (!existing || (normalizedItem.confidence ?? 0) > (existing.confidence ?? 0)) {
      map.set(normalized, normalizedItem);
    }
  });

  return Array.from(map.values());
}

function prepareOcrChordText(value: string) {
  return OCR_COMMON_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function sanitizeChordToken(value: string) {
  return value
    .trim()
    .replace(/[♭]/g, "b")
    .replace(/[♯]/g, "#")
    .replace(/[|,;:[\]{}]/g, "")
    .replace(/[()]/g, "")
    .replace(/[“”"'`]/g, "")
    .replace(/\.+$/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, "");
}

function calculateHeuristicConfidence(rawToken: string, normalized: string) {
  let confidence = 0.74;

  if (rawToken === normalized) confidence += 0.12;
  if (/[#b/0-9]/.test(normalized)) confidence += 0.04;
  if (normalized.length === 1) confidence -= 0.12;
  if (rawToken !== rawToken.trim()) confidence -= 0.04;
  if (rawToken !== normalized) confidence -= 0.06;

  return Math.min(0.95, Math.max(0.45, Number(confidence.toFixed(2))));
}

function normalizeRoot(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!match) return "";

  const [, note, accidental, suffix] = match;
  return `${note.toUpperCase()}${accidental}${suffix}`;
}

function normalizeBass(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^([A-Ga-g])([#b]?)$/);
  if (!match) return "";

  return `${match[1].toUpperCase()}${match[2]}`;
}
