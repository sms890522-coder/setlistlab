import type { TuningPreset, TuningString } from "@/lib/tuningPresets";

type StringTargetListProps = {
  preset: TuningPreset;
  selectedTarget?: TuningString;
  onSelect: (target?: TuningString) => void;
};

export function StringTargetList({ preset, selectedTarget, onSelect }: StringTargetListProps) {
  if (preset.id === "chromatic") {
    return (
      <section className="card p-5">
        <h2 className="section-title">크로매틱 모드</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          크로매틱 모드는 기타 줄에 관계없이 현재 입력된 음과 가장 가까운 음을 표시합니다.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{preset.label}</h2>
          <p className="field-help">{preset.description}</p>
        </div>
        {selectedTarget ? (
          <button type="button" onClick={() => onSelect(undefined)} className="btn-secondary min-h-10 px-3">
            목표 해제
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {preset.strings.map((string) => {
          const selected = selectedTarget?.id === string.id;
          return (
            <button
              key={string.id}
              type="button"
              onClick={() => onSelect(string)}
              className={`rounded-lg border p-4 text-left transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                selected
                  ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-800 hover:border-blue-200 hover:bg-blue-50"
              }`}
            >
              <p className="font-black">{string.label}</p>
              <p className={`mt-1 text-sm font-bold ${selected ? "text-blue-100" : "text-slate-500"}`}>
                {string.frequency.toFixed(2)} Hz
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
