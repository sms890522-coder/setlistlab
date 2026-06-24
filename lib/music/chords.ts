const CHORD_PATTERN =
  /^([A-Ga-g])([#b]?)(m|maj|min|dim|aug|sus|add)?([0-9]{0,2})?([#b][0-9])?(\/([A-Ga-g])([#b]?))?$/;

export function normalizeChord(chord: string) {
  const token = chord.trim().replace(/[|,;]/g, "");
  if (!token) return "";

  const slashParts = token.split("/");
  const normalizedRoot = normalizeRoot(slashParts[0]);
  if (!normalizedRoot) return token;

  if (slashParts.length === 1) return normalizedRoot;

  const bass = normalizeBass(slashParts[1]);
  return bass ? `${normalizedRoot}/${bass}` : normalizedRoot;
}

export function parseChordLine(input: string): string[] {
  return input
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
