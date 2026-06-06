import assert from "node:assert/strict";
import test from "node:test";
import { extractYouTubeVideoId, formatSecondsToTime, parseTimeToSeconds } from "../lib/youtube.ts";

test("extractYouTubeVideoId supports common YouTube URL shapes", () => {
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=w9QvvOj1dn4"), "w9QvvOj1dn4");
  assert.equal(extractYouTubeVideoId("https://youtu.be/WC8LKCbumyE?si=share"), "WC8LKCbumyE");
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/embed/QOI-kywg2yA"), "QOI-kywg2yA");
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/shorts/QOI-kywg2yA"), "QOI-kywg2yA");
});

test("extractYouTubeVideoId ignores empty and placeholder links", () => {
  assert.equal(extractYouTubeVideoId(""), undefined);
  assert.equal(extractYouTubeVideoId("https://youtube.com/placeholder"), undefined);
  assert.equal(extractYouTubeVideoId("not-a-url"), undefined);
});

test("time helpers parse and format practice timestamps", () => {
  assert.equal(parseTimeToSeconds("00:18"), 18);
  assert.equal(parseTimeToSeconds("01:30"), 90);
  assert.equal(parseTimeToSeconds("1:02:03"), 3723);
  assert.equal(parseTimeToSeconds("01:80"), undefined);
  assert.equal(formatSecondsToTime(18), "00:18");
  assert.equal(formatSecondsToTime(90), "01:30");
  assert.equal(formatSecondsToTime(3723), "1:02:03");
});
