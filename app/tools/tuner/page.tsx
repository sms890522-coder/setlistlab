"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StringTargetList } from "@/components/tuner/StringTargetList";
import { TunerDisplay } from "@/components/tuner/TunerDisplay";
import { TuningModeSelector } from "@/components/tuner/TuningModeSelector";
import { autoCorrelate, frequencyToNote, getCentsOff, type TunerNote } from "@/lib/tuner";
import {
  TUNING_PRESETS,
  getTuningPreset,
  type TuningPresetId,
  type TuningString,
} from "@/lib/tuningPresets";

const TUNER_MODE_KEY = "conti-practice-room:tuner-mode";
const MIN_FREQUENCY = 40;
const MAX_FREQUENCY = 1200;

export default function TunerPage() {
  const [modeId, setModeId] = useState<TuningPresetId>("guitar-standard");
  const [selectedTargetId, setSelectedTargetId] = useState("guitar-6-e2");
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("튜너를 시작하면 현재 음을 분석합니다.");
  const [note, setNote] = useState<TunerNote | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recentFrequenciesRef = useRef<number[]>([]);

  const activePreset = useMemo(() => getTuningPreset(modeId), [modeId]);
  const selectedTarget = activePreset.strings.find((string) => string.id === selectedTargetId);
  const selectedTargetCents = note && selectedTarget ? getCentsOff(note.frequency, selectedTarget.frequency) : null;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedMode = window.localStorage.getItem(TUNER_MODE_KEY);
    const savedPreset = savedMode ? getTuningPreset(savedMode) : TUNING_PRESETS[0];
    setModeId(savedPreset.id);
    setSelectedTargetId(savedPreset.strings[0]?.id ?? "");
  }, []);

  const stopTuner = useCallback(() => {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();

    sourceRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    recentFrequenciesRef.current = [];
    setRunning(false);
    setStarting(false);
    setStatusMessage("튜너가 중지되었습니다.");
  }, []);

  useEffect(() => stopTuner, [stopTuner]);

  async function startTuner() {
    setError("");
    setStarting(true);

    if (!canUseMicrophone()) {
      setError("튜너는 안전한 접속 환경에서만 정상 동작합니다.");
      setStarting(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("이 브라우저에서는 마이크 입력을 사용할 수 없습니다.");
      setStarting(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextConstructor = getAudioContextConstructor();
      if (!AudioContextConstructor) {
        throw new Error("AudioContext를 사용할 수 없습니다.");
      }

      const audioContext = new AudioContextConstructor();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.15;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamRef.current = stream;
      recentFrequenciesRef.current = [];

      setRunning(true);
      setStarting(false);
      setStatusMessage("음을 감지하는 중...");
      analyseInput(analyser, audioContext.sampleRate);
    } catch {
      stopTuner();
      setError("마이크 권한이 필요합니다. 브라우저 설정에서 마이크 접근을 허용해 주세요.");
      setStatusMessage("튜너를 시작하지 못했습니다.");
    }
  }

  function analyseInput(analyser: AnalyserNode, sampleRate: number) {
    const buffer = new Float32Array(analyser.fftSize);
    let lastAnalysisAt = 0;

    function tick(timestamp: number) {
      if (timestamp - lastAnalysisAt >= 80) {
        lastAnalysisAt = timestamp;
        analyser.getFloatTimeDomainData(buffer);
        const rms = getRms(buffer);

        if (rms < 0.012) {
          recentFrequenciesRef.current = [];
          setNote(null);
          setStatusMessage("소리를 조금 더 크게 내주세요.");
        } else {
          const detectedFrequency = autoCorrelate(buffer, sampleRate);
          if (!detectedFrequency || detectedFrequency < MIN_FREQUENCY || detectedFrequency > MAX_FREQUENCY) {
            setNote(null);
            setStatusMessage("음을 감지하는 중...");
          } else {
            const smoothedFrequency = smoothFrequency(detectedFrequency, recentFrequenciesRef.current);
            setNote(frequencyToNote(smoothedFrequency));
            setStatusMessage("현재 입력되는 음을 분석하고 있습니다.");
          }
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    }

    animationFrameRef.current = window.requestAnimationFrame(tick);
  }

  function handleModeChange(nextModeId: TuningPresetId) {
    const nextPreset = getTuningPreset(nextModeId);
    setModeId(nextPreset.id);
    setSelectedTargetId(nextPreset.strings[0]?.id ?? "");
    recentFrequenciesRef.current = [];

    if (typeof window !== "undefined") {
      window.localStorage.setItem(TUNER_MODE_KEY, nextPreset.id);
    }
  }

  function handleTargetSelect(target?: TuningString) {
    setSelectedTargetId(target?.id ?? "");
    recentFrequenciesRef.current = [];
  }

  return (
    <div className="page-shell space-y-6 pb-20">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-bold text-blue-700">
            홈으로
          </Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">튜너</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            마이크 입력을 브라우저 안에서 분석해 현재 음, 주파수, 센트 오차를 확인합니다.
            휴대폰에서는 기기 마이크를 악기 가까이에 두면 더 안정적으로 감지됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {running ? (
            <button type="button" onClick={stopTuner} className="btn-danger">
              튜너 중지하기
            </button>
          ) : (
            <button type="button" onClick={startTuner} disabled={starting} className="btn-primary">
              {starting ? "마이크 요청 중" : "튜너 시작하기"}
            </button>
          )}
        </div>
      </section>

      {error ? <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p> : null}

      <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900">
        <p className="font-bold">튜너는 안전한 접속 환경에서만 정상 동작합니다.</p>
        <p className="mt-1 text-xs font-semibold text-blue-700">
          브라우저 주소창에 자물쇠 표시가 있는 페이지에서 마이크 권한을 허용해 주세요.
        </p>
        <p className="mt-1 text-xs font-semibold text-blue-700">
          모바일에서는 휴대폰을 악기 가까이에 두고 사용해 주세요. 블루투스나 이어폰 마이크를 쓰면 감지 결과가 달라질 수 있습니다.
        </p>
      </section>

      <TuningModeSelector presets={TUNING_PRESETS} selectedId={modeId} onChange={handleModeChange} />

      <TunerDisplay
        note={note}
        selectedTarget={selectedTarget}
        selectedTargetCents={selectedTargetCents}
        statusMessage={statusMessage}
        running={running}
      />

      <StringTargetList preset={activePreset} selectedTarget={selectedTarget} onSelect={handleTargetSelect} />

      <section className="card p-5">
        <h2 className="section-title">안내</h2>
        <div className="mt-3 space-y-2 text-xs leading-5 text-slate-500">
          <p>마이크 입력은 브라우저 안에서만 분석되며 서버로 업로드되지 않습니다.</p>
          <p>주변 소음이 적은 환경에서 사용하면 더 정확합니다.</p>
          <p>휴대폰 마이크를 기타 사운드홀이나 악기 소리가 나는 쪽에 가까이 두면 감지가 더 안정적입니다.</p>
          <p>블루투스 이어폰, 유선 이어폰, 외장 마이크 환경에서는 입력 장치가 달라져 감지 결과가 달라질 수 있습니다.</p>
          <p>튜너 정확도는 기기 마이크와 브라우저 환경에 따라 달라질 수 있습니다.</p>
          <p>녹음 파일 저장, 음성 업로드, 외부 오디오 API 전송은 하지 않습니다.</p>
        </div>
      </section>
    </div>
  );
}

function canUseMicrophone() {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  const localhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  return window.isSecureContext || localhost;
}

function getAudioContextConstructor() {
  const audioWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return window.AudioContext ?? audioWindow.webkitAudioContext;
}

function getRms(buffer: Float32Array) {
  let sum = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    sum += buffer[index] * buffer[index];
  }
  return Math.sqrt(sum / buffer.length);
}

function smoothFrequency(frequency: number, recentFrequencies: number[]) {
  recentFrequencies.push(frequency);
  if (recentFrequencies.length > 6) {
    recentFrequencies.shift();
  }

  const sorted = [...recentFrequencies].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}
