import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "콘티연습실",
  description: "찬양팀을 위한 유튜브 구간반복 콘티 공유 도구",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
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
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white/75 p-1 shadow-sm">
              <Link
                href="/setlists"
                className="rounded-lg px-2.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:px-3"
              >
                콘티
              </Link>
              <Link
                href="/setlists"
                className="rounded-lg px-2.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:px-3"
              >
                곡 연습
              </Link>
              <Link
                href="/tools/tuner"
                className="rounded-lg px-2.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:px-3"
              >
                튜너
              </Link>
            </div>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="px-4 pb-8 text-center text-xs text-slate-400 sm:px-6 lg:px-8">
          made by{" "}
          <a
            href="https://missionlab.work/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-slate-500 transition hover:text-blue-600"
          >
            미션랩
          </a>
        </footer>
      </body>
    </html>
  );
}
