import type { Metadata } from "next";
import Link from "next/link";
import { FaqSection } from "@/components/FaqSection";
import { faqJsonLd } from "@/lib/faq";

export const metadata: Metadata = {
  title: "문의/피드백 | 콘티연습실",
  description: "콘티연습실 문의와 피드백을 카카오톡 채널로 보내주세요.",
};

export default function ContactPage() {
  const kakaoChatUrl = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_CHAT_URL;
  const hasContactLink = Boolean(kakaoChatUrl);

  return (
    <div className="page-shell pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <section className="mx-auto max-w-2xl space-y-5 py-8">
        <Link href="/" className="text-sm font-bold text-blue-700 transition hover:text-blue-800">
          홈으로
        </Link>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50 px-5 py-6 sm:px-7">
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
              <ChatBubbleIcon />
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">문의/피드백</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              콘티연습실을 사용하면서 불편한 점이나 필요한 기능이 있다면 알려주세요.
              오류 신고, 기능 제안, 사용 방법 문의 모두 환영합니다.
            </p>
          </div>

          <div className="space-y-5 px-5 py-6 sm:px-7">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-slate-700">
              보내주신 의견은 실제 찬양팀이 쓰기 편한 방향으로 다듬는 데 큰 도움이 됩니다.
              짧게 남겨주셔도 괜찮아요.
            </div>

            {hasContactLink ? (
              <a href={kakaoChatUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full sm:w-auto">
                <ChatBubbleIcon />
                채팅으로 문의하기
              </a>
            ) : (
              <div className="space-y-2">
                <button type="button" disabled className="btn-secondary w-full sm:w-auto">
                  <ChatBubbleIcon />
                  문의 채널 준비 중입니다
                </button>
                <p className="text-xs leading-5 text-slate-500">
                  문의 링크가 아직 설정되지 않았습니다. 관리자에게 문의 채널 설정을 요청해 주세요.
                </p>
              </div>
            )}
          </div>
        </div>
        <FaqSection />
      </section>
    </div>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
    </svg>
  );
}
