type TuningMeterProps = {
  cents?: number | null;
};

export function TuningMeter({ cents }: TuningMeterProps) {
  const hasCents = typeof cents === "number" && Number.isFinite(cents);
  const clamped = hasCents ? Math.max(-50, Math.min(50, cents)) : 0;
  const position = ((clamped + 50) / 100) * 100;
  const status = hasCents ? getTuningStatus(cents) : "음을 감지하는 중";
  const accurate = hasCents && Math.abs(cents) <= 5;

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-900">튜닝 게이지</p>
        <p className={`text-sm font-black ${accurate ? "text-emerald-600" : "text-blue-700"}`}>{status}</p>
      </div>

      <div className="relative mt-5 h-12 rounded-full bg-gradient-to-r from-blue-100 via-emerald-100 to-violet-100 px-4">
        <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-emerald-600/70" />
        <div
          className={`absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 bg-white shadow-md transition-all duration-150 ${
            accurate ? "border-emerald-500" : "border-blue-500"
          }`}
          style={{ left: `${position}%` }}
        />
      </div>

      <div className="mt-2 grid grid-cols-3 text-xs font-bold text-slate-500">
        <span>-50</span>
        <span className="text-center">0 cents</span>
        <span className="text-right">+50</span>
      </div>
    </div>
  );
}

export function getTuningStatus(cents: number) {
  if (cents <= -15) return "너무 낮음";
  if (cents < -5) return "조금 낮음";
  if (cents <= 5) return "정확해요";
  if (cents < 15) return "조금 높음";
  return "너무 높음";
}
