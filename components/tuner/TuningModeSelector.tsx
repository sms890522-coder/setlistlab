import type { TuningPreset, TuningPresetId } from "@/lib/tuningPresets";

type TuningModeSelectorProps = {
  presets: TuningPreset[];
  selectedId: TuningPresetId;
  onChange: (id: TuningPresetId) => void;
};

export function TuningModeSelector({ presets, selectedId, onChange }: TuningModeSelectorProps) {
  return (
    <section className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">튜닝 모드</h2>
          <p className="field-help">기타, 베이스, 크로매틱 모드를 선택하세요.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.id)}
              className={`min-h-11 rounded-lg px-3 text-sm font-black transition ${
                selectedId === preset.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-transparent text-slate-600 hover:bg-white hover:text-blue-700"
              }`}
            >
              {preset.id === "guitar-standard" ? "기타" : preset.id === "bass-standard" ? "베이스" : "크로매틱"}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
