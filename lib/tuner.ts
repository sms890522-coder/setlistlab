export type TunerNote = {
  noteName: string;
  octave: number;
  midi: number;
  frequency: number;
  targetFrequency: number;
  cents: number;
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const A4_FREQUENCY = 440;
const A4_MIDI = 69;

export function autoCorrelate(buffer: Float32Array, sampleRate: number): number | null {
  const bufferSize = buffer.length;
  if (bufferSize < 2 || sampleRate <= 0) return null;

  let rms = 0;
  for (let index = 0; index < bufferSize; index += 1) {
    rms += buffer[index] * buffer[index];
  }
  rms = Math.sqrt(rms / bufferSize);
  if (rms < 0.01) return null;

  let start = 0;
  let end = bufferSize - 1;
  const threshold = 0.2;

  for (let index = 0; index < bufferSize / 2; index += 1) {
    if (Math.abs(buffer[index]) < threshold) {
      start = index;
      break;
    }
  }

  for (let index = 1; index < bufferSize / 2; index += 1) {
    if (Math.abs(buffer[bufferSize - index]) < threshold) {
      end = bufferSize - index;
      break;
    }
  }

  const trimmed = buffer.slice(start, end);
  const size = trimmed.length;
  if (size < 2) return null;

  const correlations = new Array<number>(size).fill(0);
  for (let offset = 0; offset < size; offset += 1) {
    for (let index = 0; index < size - offset; index += 1) {
      correlations[offset] += trimmed[index] * trimmed[index + offset];
    }
  }

  let offset = 0;
  while (offset < size - 1 && correlations[offset] > correlations[offset + 1]) {
    offset += 1;
  }

  let bestOffset = -1;
  let bestCorrelation = 0;
  for (let index = offset; index < size; index += 1) {
    if (correlations[index] > bestCorrelation) {
      bestCorrelation = correlations[index];
      bestOffset = index;
    }
  }

  if (bestOffset <= 0 || bestCorrelation <= 0) return null;

  const previous = correlations[bestOffset - 1] ?? 0;
  const current = correlations[bestOffset] ?? 0;
  const next = correlations[bestOffset + 1] ?? 0;
  const adjustment = (next - previous) / (2 * (2 * current - next - previous));
  const preciseOffset = Number.isFinite(adjustment) ? bestOffset + adjustment : bestOffset;
  const frequency = sampleRate / preciseOffset;

  return Number.isFinite(frequency) ? frequency : null;
}

export function frequencyToNote(frequency: number): TunerNote {
  const midi = Math.round(12 * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI);
  const noteIndex = ((midi % 12) + 12) % 12;
  const targetFrequency = noteToFrequency(midi);

  return {
    noteName: NOTE_NAMES[noteIndex],
    octave: Math.floor(midi / 12) - 1,
    midi,
    frequency,
    targetFrequency,
    cents: getCentsOff(frequency, targetFrequency),
  };
}

export function getCentsOff(frequency: number, targetFrequency: number) {
  if (frequency <= 0 || targetFrequency <= 0) return 0;
  return Math.round(1200 * Math.log2(frequency / targetFrequency));
}

export function noteToFrequency(midi: number) {
  return A4_FREQUENCY * 2 ** ((midi - A4_MIDI) / 12);
}
