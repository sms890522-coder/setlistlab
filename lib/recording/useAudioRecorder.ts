"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AudioRecorderState =
  | "idle"
  | "unsupported"
  | "requesting_permission"
  | "ready"
  | "recording"
  | "stopped"
  | "error";

export type AudioInputDevice = {
  deviceId: string;
  label: string;
};

export type RecorderInputType = "mic" | "line" | "interface" | "unknown";

const MIME_TYPE_PRIORITY = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
  "audio/wav",
];

export function getSupportedRecordingMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return "";
  return MIME_TYPE_PRIORITY.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

export function useAudioRecorder() {
  const supported = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const [state, setState] = useState<AudioRecorderState>(supported ? "idle" : "unsupported");
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState("");
  const [inputType, setInputTypeState] = useState<RecorderInputType>("mic");
  const [rawInputMode, setRawInputModeState] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [objectUrl, setObjectUrl] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [mimeType, setMimeType] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef(0);
  const durationTimerRef = useRef<number | null>(null);

  const canRecord = supported && (state === "ready" || state === "stopped" || state === "idle");

  const revokeObjectUrl = useCallback(() => {
    setObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!supported) return [];
    const nextDevices = (await navigator.mediaDevices.enumerateDevices())
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `마이크 ${index + 1}`,
      }));

    setDevices(nextDevices);
    if (!selectedDeviceId && nextDevices[0]) setSelectedDeviceIdState(nextDevices[0].deviceId);
    return nextDevices;
  }, [selectedDeviceId, supported]);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const resetInputStream = useCallback(() => {
    if (recorderRef.current?.state === "recording") return;
    cleanupStream();
    setDeviceLabel("");
    setState(supported ? "idle" : "unsupported");
  }, [cleanupStream, supported]);

  const setSelectedDeviceId = useCallback(
    (deviceId: string) => {
      setSelectedDeviceIdState(deviceId);
      resetInputStream();
    },
    [resetInputStream],
  );

  const setInputType = useCallback(
    (nextInputType: RecorderInputType) => {
      setInputTypeState(nextInputType);
      resetInputStream();
    },
    [resetInputStream],
  );

  const setRawInputMode = useCallback(
    (enabled: boolean) => {
      setRawInputModeState(enabled);
      resetInputStream();
    },
    [resetInputStream],
  );

  const requestMicrophonePermission = useCallback(async () => {
    if (!supported) {
      setState("unsupported");
      setError("이 브라우저에서는 녹음 기능을 지원하지 않을 수 있습니다.");
      return false;
    }

    setState("requesting_permission");
    setError("");

    try {
      cleanupStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: createRecordingAudioConstraints({
          selectedDeviceId,
          inputType,
          rawInputMode,
        }),
      });
      streamRef.current = stream;
      const nextDevices = await refreshDevices();
      const audioTrack = stream.getAudioTracks()[0];
      const label = audioTrack?.label || nextDevices.find((device) => device.deviceId === selectedDeviceId)?.label || "기본 마이크";
      setDeviceLabel(label);
      setState("ready");
      return true;
    } catch (permissionError) {
      setError(permissionError instanceof Error ? permissionError.message : "마이크 권한이 필요합니다.");
      setState("error");
      return false;
    }
  }, [cleanupStream, inputType, rawInputMode, refreshDevices, selectedDeviceId, supported]);

  const startRecording = useCallback(async () => {
    if (!supported) {
      setState("unsupported");
      return false;
    }

    let stream = streamRef.current;
    if (!stream) {
      const granted = await requestMicrophonePermission();
      if (!granted) return false;
      stream = streamRef.current;
    }

    if (!stream) return false;

    revokeObjectUrl();
    setBlob(null);
    setDurationSeconds(0);
    chunksRef.current = [];
    const nextMimeType = getSupportedRecordingMimeType();
    setMimeType(nextMimeType || "audio/webm");

    try {
      const recorder = nextMimeType ? new MediaRecorder(stream, { mimeType: nextMimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const recordedBlob = new Blob(chunksRef.current, { type: nextMimeType || recorder.mimeType || "audio/webm" });
        setBlob(recordedBlob);
        setMimeType(recordedBlob.type || nextMimeType || "audio/webm");
        setObjectUrl(URL.createObjectURL(recordedBlob));
        setState("stopped");
      };

      startTimeRef.current = Date.now();
      recorder.start(1000);
      setState("recording");
      durationTimerRef.current = window.setInterval(() => {
        setDurationSeconds(Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000)));
      }, 250);
      return true;
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : "녹음을 시작하지 못했습니다.");
      setState("error");
      return false;
    }
  }, [requestMicrophonePermission, revokeObjectUrl, supported]);

  const stopRecording = useCallback(() => {
    if (durationTimerRef.current) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      setDurationSeconds(Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000)));
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (durationTimerRef.current) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    chunksRef.current = [];
    setBlob(null);
    setDurationSeconds(0);
    revokeObjectUrl();
    setState(streamRef.current ? "ready" : supported ? "idle" : "unsupported");
  }, [revokeObjectUrl, supported]);

  useEffect(() => {
    if (!supported) return;
    refreshDevices().catch(() => undefined);
  }, [refreshDevices, supported]);

  useEffect(() => {
    return () => {
      if (durationTimerRef.current) window.clearInterval(durationTimerRef.current);
      recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
      cleanupStream();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cleanupStream, objectUrl]);

  return useMemo(
    () => ({
      state,
      supported,
      canRecord,
      error,
      devices,
      selectedDeviceId,
      setSelectedDeviceId,
      inputType,
      setInputType,
      rawInputMode,
      setRawInputMode,
      deviceLabel,
      blob,
      objectUrl,
      durationSeconds,
      mimeType,
      requestMicrophonePermission,
      startRecording,
      stopRecording,
      resetRecording,
      refreshDevices,
    }),
    [
      blob,
      canRecord,
      deviceLabel,
      devices,
      durationSeconds,
      error,
      mimeType,
      objectUrl,
      refreshDevices,
      requestMicrophonePermission,
      resetRecording,
      inputType,
      rawInputMode,
      selectedDeviceId,
      startRecording,
      state,
      stopRecording,
      supported,
    ],
  );
}

export function createRecordingAudioConstraints({
  selectedDeviceId,
  inputType,
  rawInputMode,
}: {
  selectedDeviceId: string;
  inputType: RecorderInputType;
  rawInputMode: boolean;
}): MediaTrackConstraints {
  const channelCount = inputType === "interface" || inputType === "line" ? 2 : 1;
  return {
    ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
    echoCancellation: !rawInputMode,
    noiseSuppression: !rawInputMode,
    autoGainControl: !rawInputMode,
    channelCount: { ideal: channelCount },
    sampleRate: { ideal: 48000 },
  };
}
