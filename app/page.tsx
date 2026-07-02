import type { Metadata } from "next";
import { HomePageClient } from "@/components/HomePageClient";

const siteUrl = "https://setlistlab.vercel.app";
const title = "콘티연습실 | 찬양팀 콘티 작성 · 연습 · 팀 공유 도구";
const description =
  "찬양팀을 위한 콘티 작성, 유튜브 연습, PDF 저장, 팀 공유 도구입니다. 예배 콘티 준비와 찬양팀 연습을 콘티연습실에서 더 쉽게 관리해보세요.";
const ogDescription = "찬양팀 콘티 작성부터 팀 공유, 유튜브 연습, PDF 저장까지 한곳에서 관리하세요.";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["콘티연습실", "찬양팀 콘티", "예배 콘티", "찬양 콘티", "콘티 작성", "찬양팀 연습", "SetlistLab"],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title,
    description: ogDescription,
    url: siteUrl,
    siteName: "콘티연습실",
    type: "website",
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
