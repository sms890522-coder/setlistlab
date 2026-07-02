import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";
import { TeamChatWidget } from "@/components/TeamChatWidget";
import { TopAnnouncementBar } from "@/components/announcements/TopAnnouncementBar";
import "./globals.css";

const siteUrl = "https://setlistlab.vercel.app";
const siteTitle = "콘티연습실 | 찬양팀 콘티 작성 · 연습 · 팀 공유 도구";
const siteDescription =
  "찬양팀을 위한 콘티 작성, 유튜브 연습, PDF 저장, 팀 공유 도구입니다. 예배 콘티 준비와 찬양팀 연습을 콘티연습실에서 더 쉽게 관리해보세요.";
const socialDescription =
  "찬양팀 콘티 작성부터 팀 공유, 유튜브 연습, PDF 저장까지 한곳에서 관리하세요.";
const ogImageUrl = "/og-image.png?v=20260630";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s",
  },
  description: siteDescription,
  keywords: [
    "콘티연습실",
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
    "SetlistLab",
    "튜너",
    "메트로놈",
    "CCM",
    "교회 음악",
    "찬양인도자",
  ],
  openGraph: {
    title: siteTitle,
    description: socialDescription,
    url: siteUrl,
    siteName: "콘티연습실",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: ogImageUrl,
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
    images: [ogImageUrl],
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

const socialLinks = [
  {
    label: "Instagram",
    href: getSocialUrl(process.env.NEXT_PUBLIC_INSTAGRAM_URL, "https://www.instagram.com/setlistlab"),
    ariaLabel: "콘티연습실 Instagram 열기",
    icon: "◎",
  },
  {
    label: "Threads",
    href: getSocialUrl(process.env.NEXT_PUBLIC_THREADS_URL, "https://www.threads.net/@setlistlab"),
    ariaLabel: "콘티연습실 Threads 열기",
    icon: "T",
  },
].filter((link): link is { label: string; href: string; ariaLabel: string; icon: string } => Boolean(link.href));

function getSocialUrl(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

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
            <Link href="/" aria-label="콘티연습실 홈" className="inline-flex items-center gap-2 text-lg font-black tracking-tight text-slate-950">
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
          {socialLinks.length > 0 ? (
            <div className="mx-auto mb-4 flex max-w-6xl flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 shadow-sm">
              <p className="text-sm font-black text-slate-700">콘티연습실 소식은 SNS에서도 확인해보세요</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.ariaLabel}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-700" aria-hidden="true">
                      {link.icon}
                    </span>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <div className="leading-6">
            <Link href="/" className="font-semibold text-slate-500 transition hover:text-blue-600">
              콘티연습실
            </Link>{" "}
            ·{" "}
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
          </div>
        </footer>
      </body>
    </html>
  );
}
