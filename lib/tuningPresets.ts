export type TuningPreset = {
  id: "guitar-standard" | "bass-standard" | "chromatic";
  label: string;
  description: string;
  strings: TuningString[];
};

export type TuningString = {
  id: string;
  label: string;
  noteName: string;
  octave: number;
  frequency: number;
};

export const TUNING_PRESETS: TuningPreset[] = [
  {
    id: "guitar-standard",
    label: "기타 표준 튜닝",
    description: "어쿠스틱/일렉 기타 기본 튜닝입니다.",
    strings: [
      { id: "guitar-6-e2", label: "6번줄 E2", noteName: "E", octave: 2, frequency: 82.41 },
      { id: "guitar-5-a2", label: "5번줄 A2", noteName: "A", octave: 2, frequency: 110 },
      { id: "guitar-4-d3", label: "4번줄 D3", noteName: "D", octave: 3, frequency: 146.83 },
      { id: "guitar-3-g3", label: "3번줄 G3", noteName: "G", octave: 3, frequency: 196 },
      { id: "guitar-2-b3", label: "2번줄 B3", noteName: "B", octave: 3, frequency: 246.94 },
      { id: "guitar-1-e4", label: "1번줄 E4", noteName: "E", octave: 4, frequency: 329.63 },
    ],
  },
  {
    id: "bass-standard",
    label: "베이스 표준 튜닝",
    description: "4현 베이스 기본 튜닝입니다.",
    strings: [
      { id: "bass-4-e1", label: "4번줄 E1", noteName: "E", octave: 1, frequency: 41.2 },
      { id: "bass-3-a1", label: "3번줄 A1", noteName: "A", octave: 1, frequency: 55 },
      { id: "bass-2-d2", label: "2번줄 D2", noteName: "D", octave: 2, frequency: 73.42 },
      { id: "bass-1-g2", label: "1번줄 G2", noteName: "G", octave: 2, frequency: 98 },
    ],
  },
  {
    id: "chromatic",
    label: "크로매틱",
    description: "줄 선택 없이 현재 입력된 음과 가장 가까운 음을 표시합니다.",
    strings: [],
  },
];

export type TuningPresetId = (typeof TUNING_PRESETS)[number]["id"];

export function getTuningPreset(id: string) {
  return TUNING_PRESETS.find((preset) => preset.id === id) ?? TUNING_PRESETS[0];
}
