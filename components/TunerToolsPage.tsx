"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MetronomeTool } from "@/components/MetronomeTool";
import { TunerTool } from "@/components/TunerTool";

type ToolTab = "tuner" | "metronome";

export function TunerToolsPage() {
  const searchParams = useSearchParams();
  const queryTool = getToolTab(searchParams.get("tool"));
  const initialBpm = useMemo(() => parseOptionalNumber(searchParams.get("bpm")), [searchParams]);
  const initialBeats = useMemo(() => parseOptionalNumber(searchParams.get("beats")), [searchParams]);
  const [activeTool, setActiveTool] = useState<ToolTab>(queryTool);

  useEffect(() => {
    setActiveTool(queryTool);
  }, [queryTool]);

  return (
    <div className="page-shell space-y-6 pb-20">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-bold text-blue-700">
            홈으로
          </Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">튜너 & 메트로놈</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            악기 튜닝과 템포 연습을 한 페이지에서 준비하세요. 메트로놈은 브라우저 안에서만 소리를 만들며 외부 API나
            서버 업로드를 사용하지 않습니다.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" role="tablist" aria-label="연습 도구">
        <button
          type="button"
          onClick={() => setActiveTool("tuner")}
          className={`min-h-12 rounded-xl px-4 text-sm font-black transition ${
            activeTool === "tuner" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
          }`}
          role="tab"
          aria-selected={activeTool === "tuner"}
        >
          튜너
        </button>
        <button
          type="button"
          onClick={() => setActiveTool("metronome")}
          className={`min-h-12 rounded-xl px-4 text-sm font-black transition ${
            activeTool === "metronome" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
          }`}
          role="tab"
          aria-selected={activeTool === "metronome"}
        >
          메트로놈
        </button>
      </div>

      <div role="tabpanel">{activeTool === "metronome" ? <MetronomeTool initialBpm={initialBpm} initialBeats={initialBeats} /> : <TunerTool />}</div>
    </div>
  );
}

function getToolTab(value: string | null): ToolTab {
  return value === "metronome" ? "metronome" : "tuner";
}

function parseOptionalNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
