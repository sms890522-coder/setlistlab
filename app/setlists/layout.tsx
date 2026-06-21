import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "콘티 목록 | 콘티연습실",
  description: "예배 콘티를 만들고 곡 순서, 키, BPM, 송폼, 악보 이미지와 PDF 공유를 관리할 수 있습니다.",
};

export default function SetlistsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
