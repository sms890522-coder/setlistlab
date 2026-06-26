"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { createRecordingAudioConstraints, type RecorderInputType } from "@/lib/recording/useAudioRecorder";

export type AudioInputMeterStatus = "idle" | "checking" | "too_low" | "good" | "too_high" | "clipping" | "error";

export function useAudioInputMeter() {
  const [testing, setTesting] = useState(false);
  const [hasTested, setHasTested] = useState(false);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [status, setStatus] = useState<AudioInputMeterStatus>("idle");
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const quietStartedAtRef = useRef<number | null>(null);

  const stopTest = useCallback(() => {
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close?.();
    audioContextRef.current = null;
    setTesting(false);
    quietStartedAtRef.current = null;
  }, []);

  const startTest = useCallback(
    async ({
      selectedDeviceId,
      inputType,
      rawInputMode,
    }: {
      selectedDeviceId: string;
      inputType: RecorderInputType;
      rawInputMode: boolean;
    }) => {
      stopTest();
      setError("");
      setStatus("checking");
      setTesting(true);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: createRecordingAudioConstraints({ selectedDeviceId, inputType, rawInputMode }),
        });
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        streamRef.current = stream;
        audioContextRef.current = audioContext;
        const buffer = new Float32Array(analyser.fftSize);

        const update = () => {
          analyser.getFloatTimeDomainData(buffer);
          let sum = 0;
          let nextPeak = 0;
          for (const sample of buffer) {
            sum += sample * sample;
            nextPeak = Math.max(nextPeak, Math.abs(sample));
          }
          const rms = Math.sqrt(sum / buffer.length);
          const nextLevel = Math.max(rms * 1.8, nextPeak * 0.75);
          setLevel(Math.min(1, nextLevel));
          setPeak(nextPeak);
          setStatus(getMeterStatus(nextPeak, quietStartedAtRef));
          rafRef.current = window.requestAnimationFrame(update);
        };

        update();
        setHasTested(true);
      } catch (meterError) {
        stopTest();
        setError(meterError instanceof Error ? meterError.message : "입력 장치를 확인하지 못했습니다.");
        setStatus("error");
      }
    },
    [stopTest],
  );

  useEffect(() => stopTest, [stopTest]);

  return useMemo(
    () => ({
      testing,
      hasTested,
      level,
      peak,
      status,
      error,
      startTest,
      stopTest,
    }),
    [error, hasTested, level, peak, startTest, status, stopTest, testing],
  );
}

function getMeterStatus(peak: number, quietStartedAtRef: MutableRefObject<number | null>): AudioInputMeterStatus {
  if (peak > 0.95) return "clipping";
  if (peak > 0.85) return "too_high";
  if (peak >= 0.05) {
    quietStartedAtRef.current = null;
    return "good";
  }

  quietStartedAtRef.current ??= Date.now();
  return Date.now() - quietStartedAtRef.current > 1200 ? "too_low" : "checking";
}
