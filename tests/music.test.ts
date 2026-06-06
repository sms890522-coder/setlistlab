import assert from "node:assert/strict";
import test from "node:test";
import {
  getCapoSuggestions,
  getSemitoneDistance,
  normalizeKey,
  transposeChord,
  transposeChordProgression,
} from "../lib/music.ts";

test("normalizeKey accepts flats and minor keys", () => {
  assert.equal(normalizeKey("Db"), "C#");
  assert.equal(normalizeKey("bbm"), "A#m");
  assert.equal(normalizeKey("F#m"), "F#m");
});

test("transposeChord handles suffixes and slash chords", () => {
  assert.equal(getSemitoneDistance("G", "A"), 2);
  assert.equal(transposeChord("G/B", 2), "A/C#");
  assert.equal(transposeChord("Cadd9", 2), "Dadd9");
  assert.equal(transposeChord("Em7", 2), "F#m7");
});

test("transposeChordProgression transposes common worship progressions", () => {
  assert.equal(transposeChordProgression("G - D - Em - C", "G", "A"), "A - E - F#m - D");
  assert.equal(transposeChordProgression("G/B | D/F# | Cadd9", "G", "A"), "A/C# | E/G# | Dadd9");
});

test("getCapoSuggestions returns practical guitar forms", () => {
  const suggestions = getCapoSuggestions("A");
  assert.ok(suggestions.some((item) => item.chordForm === "A" && item.capo === 0));
  assert.ok(suggestions.some((item) => item.chordForm === "G" && item.capo === 2));
});
