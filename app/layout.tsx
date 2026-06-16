import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";
import { TeamChatWidget } from "@/components/TeamChatWidget";
import "./globals.css";

export const metadata: Metadata = {
  title: "콘티연습실",
  description: "찬양팀을 위한 유튜브 구간반복 콘티 공유 도구",
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
          <Link href="/contact" className="font-semibold text-slate-500 transition hover:text-blue-600">
            문의/피드백
          </Link>
        </footer>
      </body>
    </html>
  );
}
