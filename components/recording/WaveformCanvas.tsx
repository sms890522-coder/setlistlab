"use client";

import { useEffect, useRef } from "react";

type WaveformCanvasProps = {
  peaks?: number[];
  duration: number;
  currentTime: number;
  height?: number;
  muted?: boolean;
  solo?: boolean;
  waveColor?: string;
  backgroundColor?: string;
  playheadColor?: string;
  loading?: boolean;
  error?: string;
  onSeek?: (time: number) => void;
};

export function WaveformCanvas({
  peaks,
  duration,
  currentTime,
  height = 72,
  muted = false,
  solo = false,
  waveColor = "#64748b",
  backgroundColor = "#f8fafc",
  playheadColor = "#2563eb",
  loading = false,
  error,
  onSeek,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));

      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(dpr, dpr);
      context.clearRect(0, 0, rect.width, height);

      context.fillStyle = muted ? "#f1f5f9" : solo ? "#eff6ff" : backgroundColor;
      context.fillRect(0, 0, rect.width, height);

      if (loading) {
        drawCenteredText(context, rect.width, height, "파형을 불러오는 중입니다.", "#64748b");
        return;
      }

      if (error) {
        drawCenteredText(context, rect.width, height, "파형을 표시하지 못했지만 재생은 가능합니다.", "#9f1239");
        return;
      }

      const nextPeaks = peaks?.length ? peaks : createPlaceholderPeaks();
      const barWidth = Math.max(1, rect.width / nextPeaks.length);
      const centerY = height / 2;
      context.fillStyle = muted ? "#cbd5e1" : waveColor;

      nextPeaks.forEach((peak, index) => {
        const x = index * barWidth;
        const barHeight = Math.max(2, peak * (height - 18));
        context.fillRect(x, centerY - barHeight / 2, Math.max(1, barWidth * 0.72), barHeight);
      });

      if (duration > 0) {
        const progressX = Math.max(0, Math.min(1, currentTime / duration)) * rect.width;
        context.fillStyle = playheadColor;
        context.fillRect(progressX, 0, 2, height);
      }
    };

    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [backgroundColor, currentTime, duration, error, height, loading, muted, peaks, playheadColor, solo, waveColor]);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!onSeek || duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  }

  return (
    <canvas
      ref={canvasRef}
      className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50"
      style={{ height }}
      onPointerDown={handlePointerDown}
      role="img"
      aria-label="오디오 파형"
    />
  );
}

function drawCenteredText(context: CanvasRenderingContext2D, width: number, height: number, text: string, color: string) {
  context.fillStyle = color;
  context.font = "700 12px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, width / 2, height / 2);
}

function createPlaceholderPeaks() {
  return Array.from({ length: 120 }, (_, index) => 0.2 + Math.abs(Math.sin(index * 0.35)) * 0.45);
}
