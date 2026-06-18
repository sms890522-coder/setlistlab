"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_BPM = 72;
const MIN_BPM = 40;
const MAX_BPM = 240;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;
const TAP_RESET_MS = 2000;
const MAX_TAP_COUNT = 6;

type TimeSignature = {
  id: string;
  label: string;
  beats: number;
  helper: string;
};

const TIME_SIGNATURES: TimeSignature[] = [
  { id: "4", label: "4/4", beats: 4, helper: "가장 많이 쓰는 기본 박자" },
  { id: "3", label: "3/4", beats: 3, helper: "왈츠 느낌의 3박 흐름" },
  { id: "6", label: "6/8", beats: 6, helper: "6개의 박을 한 마디로 표시" },
  { id: "2", label: "2/4", beats: 2, helper: "짧고 명확한 2박 흐름" },
];

type MetronomeToolProps = {
  initialBpm?: number;
  initialBeats?: number;
};

export function MetronomeTool({ initialBpm, initialBeats }: MetronomeToolProps) {
  const initialSignature = useMemo(() => getTimeSignature(initialBeats), [initialBeats]);
  const [bpm, setBpm] = useState(() => clampBpm(initialBpm ?? DEFAULT_BPM));
  const [bpmText, setBpmText] = useState(() => String(clampBpm(initialBpm ?? DEFAULT_BPM)));
  const [timeSignature, setTimeSignature] = useState<TimeSignature>(initialSignature);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [statusMessage, setStatusMessage] = useState("메트로놈을 시작하면 박자가 표시됩니다.");
  const [error, setError] = useState("");
  const [tapCount, setTapCount] = useState(0);
  const [vibrationSupported, setVibrationSupported] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const schedulerTimerRef = useRef<number | null>(null);
  const visualTimerRefs = useRef<number[]>([]);
  const nextNoteTimeRef = useRef(0);
  const nextBeatRef = useRef(1);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(timeSignature.beats);
  const runningRef = useRef(false);
  const startingRef = useRef(false);
  const vibrationEnabledRef = useRef(false);
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVibrationSupported("vibrate" in navigator);
  }, []);

  useEffect(() => {
    const nextBpm = clampBpm(initialBpm ?? DEFAULT_BPM);
    setBpm(nextBpm);
    setBpmText(String(nextBpm));
  }, [initialBpm]);

  useEffect(() => {
    setTimeSignature(getTimeSignature(initialBeats));
  }, [initialBeats]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    beatsRef.current = timeSignature.beats;
    if (currentBeat > timeSignature.beats) {
      setCurrentBeat(0);
    }
  }, [currentBeat, timeSignature.beats]);

  useEffect(() => {
    vibrationEnabledRef.current = vibrationEnabled;
  }, [vibrationEnabled]);

  const clearVisualTimers = useCallback(() => {
    visualTimerRefs.current.forEach((timerId) => window.clearTimeout(timerId));
    visualTimerRefs.current = [];
  }, []);

  const stopMetronome = useCallback(() => {
    if (schedulerTimerRef.current) {
      window.clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
    clearVisualTimers();
    runningRef.current = false;
    startingRef.current = false;
    nextBeatRef.current = 1;
    setRunning(false);
    setStarting(false);
    setCurrentBeat(0);
    setStatusMessage("메트로놈이 정지되었습니다.");
  }, [clearVisualTimers]);

  useEffect(() => {
    return () => {
      stopMetronome();
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, [stopMetronome]);

  async function startMetronome() {
    if (runningRef.current || startingRef.current) return;

    setError("");
    setStarting(true);
    startingRef.current = true;

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      setError("이 브라우저에서는 Web Audio API를 사용할 수 없습니다.");
      setStarting(false);
      startingRef.current = false;
      return;
    }

    try {
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioContextConstructor();
      }

      await resumeAudioContext(audioContextRef.current);
      clearVisualTimers();
      runningRef.current = true;
      startingRef.current = false;
      nextBeatRef.current = 1;
      nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.05;
      setRunning(true);
      setStarting(false);
      setStatusMessage("박자를 재생하는 중입니다.");
      scheduler();
      schedulerTimerRef.current = window.setInterval(scheduler, LOOKAHEAD_MS);
    } catch {
      setError("메트로놈 소리를 시작하지 못했습니다. 브라우저의 소리 권한과 기기 볼륨을 확인해 주세요.");
      stopMetronome();
    }
  }

  function scheduler() {
    const audioContext = audioContextRef.current;
    if (!audioContext || !runningRef.current) return;

    while (nextNoteTimeRef.current < audioContext.currentTime + SCHEDULE_AHEAD_SECONDS) {
      scheduleBeat(nextBeatRef.current, nextNoteTimeRef.current, audioContext);
      advanceBeat();
    }
  }

  function scheduleBeat(beat: number, time: number, audioContext: AudioContext) {
    const accent = beat === 1;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(accent ? 1200 : 820, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.42 : 0.24, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.07);

    const visualDelay = Math.max(0, (time - audioContext.currentTime) * 1000);
    const timerId = window.setTimeout(() => {
      if (!runningRef.current) return;
      setCurrentBeat(beat);
      if (vibrationEnabledRef.current) vibrateBeat(accent);
    }, visualDelay);
    visualTimerRefs.current.push(timerId);
  }

  function advanceBeat() {
    const secondsPerBeat = 60 / bpmRef.current;
    nextNoteTimeRef.current += secondsPerBeat;
    nextBeatRef.current = nextBeatRef.current >= beatsRef.current ? 1 : nextBeatRef.current + 1;
  }

  function handleBpmInput(value: string) {
    setBpmText(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && value.trim() !== "") {
      setBpm(clampBpm(parsed));
    }
  }

  function commitBpm(value: string) {
    const nextBpm = clampBpm(Number(value));
    setBpm(nextBpm);
    setBpmText(String(nextBpm));
  }

  function adjustBpm(delta: number) {
    const nextBpm = clampBpm(bpm + delta);
    setBpm(nextBpm);
    setBpmText(String(nextBpm));
  }

  function handleTapTempo() {
    const now = window.performance.now();
    const previousTap = tapTimesRef.current.at(-1);
    if (previousTap && now - previousTap > TAP_RESET_MS) {
      tapTimesRef.current = [];
    }

    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > MAX_TAP_COUNT) {
      tapTimesRef.current.shift();
    }

    setTapCount(tapTimesRef.current.length);
    if (tapTimesRef.current.length < 2) {
      setStatusMessage("한 번 더 탭하면 BPM을 계산합니다.");
      return;
    }

    const intervals = tapTimesRef.current.slice(1).map((time, index) => time - tapTimesRef.current[index]);
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const nextBpm = clampBpm(Math.round(60000 / averageInterval));
    setBpm(nextBpm);
    setBpmText(String(nextBpm));
    setStatusMessage(`탭 템포로 ${nextBpm} BPM을 계산했습니다.`);
  }

  const beats = Array.from({ length: timeSignature.beats }, (_, index) => index + 1);

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 bg-blue-50/60 p-5">
          <p className="text-xs font-bold text-blue-700">메트로놈</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">곡 BPM에 맞춰 연습하기</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            곡의 BPM에 맞춰 박자를 확인하며 연습할 수 있습니다. 찬양팀 합주 전 템포를 맞추는 용도로 사용해보세요.
          </p>
        </div>

        <div className="space-y-6 p-5">
          {error ? <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p> : null}

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="field-label">BPM</span>
                  <p className="mt-1 text-sm text-slate-500">40부터 240까지 설정할 수 있습니다.</p>
                </div>
                <p className="text-4xl font-black tabular-nums text-blue-700" aria-live="polite">
                  {bpm}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-[auto_1fr_auto] gap-2">
                <button type="button" onClick={() => adjustBpm(-5)} className="btn-secondary min-h-12 px-3">
                  -5
                </button>
                <input
                  value={bpmText}
                  onChange={(event) => handleBpmInput(event.target.value)}
                  onBlur={(event) => commitBpm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  className="field-input min-h-12 text-center text-xl font-black tabular-nums"
                  type="number"
                  inputMode="numeric"
                  min={MIN_BPM}
                  max={MAX_BPM}
                  aria-label="BPM 직접 입력"
                />
                <button type="button" onClick={() => adjustBpm(5)} className="btn-secondary min-h-12 px-3">
                  +5
                </button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => adjustBpm(-1)} className="btn-secondary min-h-11 px-3">
                  -1
                </button>
                <button type="button" onClick={() => adjustBpm(1)} className="btn-secondary min-h-11 px-3">
                  +1
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="field-label">박자</span>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {TIME_SIGNATURES.map((signature) => {
                  const selected = signature.id === timeSignature.id;
                  return (
                    <button
                      key={signature.id}
                      type="button"
                      onClick={() => {
                        setTimeSignature(signature);
                        nextBeatRef.current = 1;
                        setCurrentBeat(0);
                      }}
                      className={`min-h-16 rounded-xl border px-3 text-left transition ${
                        selected
                          ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                      }`}
                      aria-pressed={selected}
                    >
                      <span className="block text-lg font-black">{signature.label}</span>
                      <span className={selected ? "text-xs font-semibold text-blue-100" : "text-xs font-semibold text-slate-500"}>
                        {signature.helper}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-blue-700">현재 박자</p>
                <p className="mt-1 text-sm text-slate-600" aria-live="polite">
                  {running && currentBeat ? `${timeSignature.label} 중 ${currentBeat}박` : `${timeSignature.label} 대기 중`}
                </p>
              </div>
              <button
                type="button"
                onClick={running ? stopMetronome : startMetronome}
                disabled={starting}
                className={running ? "btn-danger min-h-14 px-8 text-lg" : "btn-primary min-h-14 px-8 text-lg"}
                aria-label={running ? "메트로놈 정지" : "메트로놈 시작"}
              >
                {starting ? "시작 중" : running ? "정지" : "시작"}
              </button>
            </div>

            <div className="mt-6 grid gap-3" style={{ gridTemplateColumns: `repeat(${timeSignature.beats}, minmax(0, 1fr))` }}>
              {beats.map((beat) => {
                const accent = beat === 1;
                const active = running && currentBeat === beat;
                return (
                  <div
                    key={beat}
                    className={`flex aspect-square min-h-14 items-center justify-center rounded-full border text-lg font-black tabular-nums transition ${
                      active
                        ? accent
                          ? "scale-105 border-blue-600 bg-blue-600 text-white shadow-lg"
                          : "scale-105 border-violet-500 bg-violet-500 text-white shadow-md"
                        : accent
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-500"
                    }`}
                    aria-current={active ? "true" : undefined}
                  >
                    {beat}
                  </div>
                );
              })}
            </div>

            <p className="mt-4 rounded-xl bg-white/80 p-3 text-center text-sm font-semibold text-slate-600" aria-live="polite">
              {statusMessage}
            </p>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-bold text-slate-950">탭 템포</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">최근 4~6번 탭 간격으로 BPM을 계산합니다.</p>
                </div>
                <button type="button" onClick={handleTapTempo} className="btn-secondary min-h-12 px-4">
                  탭으로 BPM 맞추기
                </button>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">
                2초 이상 쉬면 탭 기록이 초기화됩니다. 현재 탭 기록: {tapCount}회
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-bold text-slate-950">기기 옵션</h3>
              {vibrationSupported ? (
                <label className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4">
                  <span className="text-sm font-semibold text-slate-700">박자마다 진동</span>
                  <input
                    type="checkbox"
                    checked={vibrationEnabled}
                    onChange={(event) => setVibrationEnabled(event.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-blue-600"
                  />
                </label>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                  이 브라우저에서는 진동 기능을 지원하지 않습니다.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900">
            <p className="font-bold">소리는 기기 볼륨과 무음 모드 설정에 따라 들리지 않을 수 있습니다.</p>
            <p className="mt-1 text-xs font-semibold text-blue-700">
              iPhone에서는 시작 버튼을 누른 뒤 소리가 활성화됩니다. 시작/정지를 반복해도 중복 재생되지 않도록 처리했습니다.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}

function clampBpm(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
}

function getTimeSignature(beats?: number) {
  return TIME_SIGNATURES.find((signature) => signature.beats === beats) ?? TIME_SIGNATURES[0];
}

function getAudioContextConstructor() {
  const audioWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return window.AudioContext ?? audioWindow.webkitAudioContext;
}

async function resumeAudioContext(audioContext: AudioContext) {
  if (audioContext.state === "running") return;

  await Promise.race([
    audioContext.resume(),
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("AudioContext resume timeout")), 1500);
    }),
  ]);

  if ((audioContext.state as string) !== "running") {
    throw new Error("AudioContext is not running");
  }
}

function vibrateBeat(accent: boolean) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;

  try {
    if (navigator.vibrate && accent) {
      navigator.vibrate(40);
    } else if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  } catch {
    // 일부 모바일 브라우저는 권한이나 모드에 따라 진동 호출을 조용히 거부합니다.
  }
}
