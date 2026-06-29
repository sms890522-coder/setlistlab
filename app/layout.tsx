import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";
import { TeamChatWidget } from "@/components/TeamChatWidget";
import { TopAnnouncementBar } from "@/components/announcements/TopAnnouncementBar";
import "./globals.css";

const siteUrl = "https://setlistlab.vercel.app";
const siteTitle = "콘티연습실 | 찬양팀 콘티 작성 · 연습 · 팀 공유 도구";
const siteDescription =
  "콘티연습실은 찬양팀을 위한 콘티 작성, 악보 이미지 관리, 유튜브 연습 링크, 팀 채팅, 공지사항, 캘린더, PDF 공유, 튜너와 메트로놈을 한 곳에서 사용할 수 있는 예배 준비 도구입니다.";
const socialDescription =
  "콘티 작성부터 팀 채팅, 공지사항, 캘린더, 악보 검색, PDF 공유, 튜너와 메트로놈까지 찬양팀 예배 준비를 한 곳에서 관리하세요.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s",
  },
  description: siteDescription,
  keywords: [
    "찬양팀",
    "콘티",
    "콘티 작성",
    "찬양 콘티",
    "예배 준비",
    "악보 이미지",
    "악보 검색",
    "팀 채팅",
    "공지사항",
    "팀 캘린더",
    "PDF 공유",
    "찬양팀 연습",
    "튜너",
    "메트로놈",
    "CCM",
    "교회 음악",
    "찬양인도자",
  ],
  openGraph: {
    title: siteTitle,
    description: socialDescription,
    url: "/",
    siteName: "콘티연습실",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "콘티연습실",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: socialDescription,
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "콘티연습실",
    statusBarStyle: "default",
  },
  other: {
    "naver-site-verification": "003a0e7d523a14ff4046dfc9eac90734535bcc9e",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur">
          <TopAnnouncementBar />
          <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="inline-flex items-center gap-2 text-lg font-black tracking-tight text-slate-950">
              <img
                src="/conti-logo.jpg"
                alt=""
                width="36"
                height="36"
                className="size-9 rounded-lg shadow-sm"
                aria-hidden="true"
              />
              콘티연습실
            </Link>
            <AuthNav />
          </nav>
        </header>
        <main>{children}</main>
        <TeamChatWidget />
        <footer className="px-4 pb-8 text-center text-xs text-slate-400 sm:px-6 lg:px-8">
          made by{" "}
          <a
            href="https://missionlab.work/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-slate-500 transition hover:text-blue-600"
          >
            미션랩
          </a>{" "}
          ·{" "}
          <Link href="/guide" className="font-semibold text-slate-500 transition hover:text-blue-600">
            사용설명서
          </Link>{" "}
          ·{" "}
          <Link href="/whats-new" className="font-semibold text-slate-500 transition hover:text-blue-600">
            새소식
          </Link>{" "}
          ·{" "}
          <Link href="/contact" className="font-semibold text-slate-500 transition hover:text-blue-600">
            문의/피드백
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="font-semibold text-slate-500 transition hover:text-blue-600">
            이용약관
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="font-semibold text-slate-500 transition hover:text-blue-600">
            개인정보처리방침
          </Link>
        </footer>
      </body>
    </html>
  );
}
