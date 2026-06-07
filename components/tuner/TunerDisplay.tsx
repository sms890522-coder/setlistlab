import type { TunerNote } from "@/lib/tuner";
import type { TuningString } from "@/lib/tuningPresets";
import { TuningMeter, getTuningStatus } from "./TuningMeter";

type TunerDisplayProps = {
  note: TunerNote | null;
  selectedTarget?: TuningString;
  selectedTargetCents?: number | null;
  statusMessage: string;
  running: boolean;
};

export function TunerDisplay({ note, selectedTarget, selectedTargetCents, statusMessage, running }: TunerDisplayProps) {
  const displayCents = selectedTarget ? selectedTargetCents : note?.cents;

  return (
    <section className="card overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 text-center sm:p-7">
        <p className="text-sm font-black text-blue-700">{running ? "마이크 입력 분석 중" : "튜너 대기 중"}</p>
        <div className="mt-5 flex items-end justify-center gap-2">
          <span className="text-7xl font-black tracking-tight text-slate-950 sm:text-8xl">
            {note ? note.noteName : "--"}
          </span>
          <span className="mb-3 text-4xl font-black text-slate-500 sm:text-5xl">{note ? note.octave : ""}</span>
        </div>
        <p className="mt-4 text-sm font-bold text-slate-600">{statusMessage}</p>
        {typeof displayCents === "number" ? (
          <p className={`mt-2 text-lg font-black ${Math.abs(displayCents) <= 5 ? "text-emerald-600" : "text-blue-700"}`}>
            {getTuningStatus(displayCents)} · {displayCents > 0 ? "+" : ""}
            {displayCents} cents
          </p>
        ) : null}
      </div>

      <div className="space-y-4 border-t border-slate-100 p-5">
        <TuningMeter cents={displayCents} />

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard label="현재 주파수" value={note ? `${formatFrequency(note.frequency)} Hz` : "-"} />
          <InfoCard
            label={selectedTarget ? "선택 목표 주파수" : "가장 가까운 음 주파수"}
            value={selectedTarget ? `${formatFrequency(selectedTarget.frequency)} Hz` : note ? `${formatFrequency(note.targetFrequency)} Hz` : "-"}
          />
          <InfoCard label="가장 가까운 음" value={note ? `${note.noteName}${note.octave}` : "-"} />
          <InfoCard label="가장 가까운 음 기준 오차" value={note ? `${formatSigned(note.cents)} cents` : "-"} />
        </div>

        {selectedTarget ? (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-black text-blue-800">선택한 목표: {selectedTarget.label}</p>
            <p className="mt-1 text-sm font-semibold text-blue-700">
              목표 기준 오차 {typeof selectedTargetCents === "number" ? `${formatSigned(selectedTargetCents)} cents` : "-"}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function formatFrequency(value: number) {
  return value.toFixed(value >= 100 ? 1 : 2);
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}
