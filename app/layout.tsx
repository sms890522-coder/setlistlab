import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "콘티연습실",
  description: "찬양팀을 위한 유튜브 구간반복 콘티 공유 도구",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
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
              <img src="/conti-logo.svg" alt="" className="size-9 rounded-lg shadow-sm" aria-hidden="true" />
              콘티연습실
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/setlists" className="btn-secondary min-h-10 px-3">
                콘티 목록
              </Link>
              <Link href="/import" className="btn-secondary hidden min-h-10 px-3 sm:inline-flex">
                JSON 가져오기
              </Link>
            </div>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
