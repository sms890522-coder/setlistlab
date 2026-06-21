import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "곡 보관함 | 콘티연습실",
  description: "자주 부르는 찬양곡의 키, BPM, 유튜브 링크, 악보 이미지와 메모를 저장하고 다시 사용할 수 있습니다.",
};

export default function SongsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
