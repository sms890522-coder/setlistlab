import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "튜너 & 메트로놈 | 콘티연습실",
  description: "악기 튜닝과 BPM 박자 연습을 브라우저에서 바로 사용할 수 있는 찬양팀 연습 도구입니다.",
};

export default function TunerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
