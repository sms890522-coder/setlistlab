import assert from "node:assert/strict";
import test from "node:test";
import { frequencyToNote, getCentsOff, noteToFrequency } from "../lib/tuner.ts";

test("noteToFrequency returns A4 at 440Hz", () => {
  assert.equal(noteToFrequency(69), 440);
});

test("frequencyToNote detects common guitar string notes", () => {
  const lowE = frequencyToNote(82.41);
  assert.equal(lowE.noteName, "E");
  assert.equal(lowE.octave, 2);
  assert.equal(Math.round(lowE.targetFrequency * 100) / 100, 82.41);

  const highE = frequencyToNote(329.63);
  assert.equal(highE.noteName, "E");
  assert.equal(highE.octave, 4);
});

test("getCentsOff reports pitch direction", () => {
  assert.equal(getCentsOff(440, 440), 0);
  assert.ok(getCentsOff(445, 440) > 0);
  assert.ok(getCentsOff(435, 440) < 0);
});
