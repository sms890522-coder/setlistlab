import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "서비스 이용약관 | 콘티연습실",
  description: "콘티연습실 서비스 이용 조건, 계정, 팀 기능, 업로드 자료, 금지 행위와 책임 범위를 안내합니다.",
};

const effectiveDate = "2026년 6월 25일";

export default function TermsPage() {
  return (
    <div className="page-shell max-w-4xl space-y-6 pb-20">
      <section className="card p-6 sm:p-8">
        <p className="text-sm font-black text-blue-700">약관</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">서비스 이용약관</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          본 약관은 콘티연습실을 이용할 때 서비스 제공자와 이용자 사이의 권리, 의무, 책임 사항을 정합니다.
        </p>
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600">시행일: {effectiveDate}</p>
      </section>

      <TermsSection title="1. 서비스 목적">
        <p>
          콘티연습실은 찬양팀이 콘티 작성, 곡 보관함, 팀 초대/승인, 팀 채팅, 공지사항, 캘린더, PDF 공유,
          튜너와 메트로놈, 팀 가이드 트랙과 팀 녹음실을 활용해 예배 준비를 정리할 수 있도록 돕는 웹 서비스입니다.
        </p>
      </TermsSection>

      <TermsSection title="2. 계정과 회원가입">
        <ul className="space-y-2">
          <li>이용자는 정확한 이메일과 프로필 정보를 사용해야 합니다.</li>
          <li>Google 또는 Naver 같은 소셜 로그인을 사용할 수 있으며, 소셜 로그인 제공자의 정책도 함께 적용될 수 있습니다.</li>
          <li>계정의 관리 책임은 이용자에게 있습니다. 계정이 도용되었거나 비정상 사용이 의심되면 즉시 알려주세요.</li>
          <li>만 14세 미만 이용자는 법정대리인의 동의가 필요할 수 있습니다.</li>
        </ul>
      </TermsSection>

      <TermsSection title="3. 팀 기능과 권한">
        <p>
          팀 기능은 초대코드 또는 초대링크를 통해 참여 요청을 보내고, 리더가 승인한 뒤 사용할 수 있습니다. 승인된 팀원만
          팀 콘티, 채팅, 공지사항, 캘린더, 녹음실 등 팀 데이터에 접근할 수 있습니다.
        </p>
        <ul className="space-y-2">
          <li>리더는 팀 관리, 팀원 승인/삭제, 부리더 지정, 리더 권한 양도, 팀 콘텐츠 관리를 할 수 있습니다.</li>
          <li>부리더는 팀 콘티, 공지사항, 일정 등 운영 기능 일부를 관리할 수 있습니다.</li>
          <li>팀원은 콘티 확인, 채팅, 공지 확인, 일정 가능 여부 체크, 본인 녹음 업로드 등 허용된 기능을 사용할 수 있습니다.</li>
        </ul>
      </TermsSection>

      <TermsSection title="4. 이용자가 등록한 콘텐츠">
        <p>
          이용자는 콘티, 곡 정보, 메모, 채팅, 댓글, 공지사항, 일정, 이미지, 녹음 파일 등 본인이 등록한 콘텐츠에 대해
          필요한 권리를 가지고 있어야 합니다.
        </p>
        <ul className="space-y-2">
          <li>저작권이 있는 악보 이미지, 음원, 녹음 자료는 권리자의 허락 범위 안에서만 사용해야 합니다.</li>
          <li>콘티연습실은 악보나 음원을 직접 제공하지 않으며, 사용자가 보유하거나 허락받은 자료를 정리하는 도구입니다.</li>
          <li>팀에 공유한 콘텐츠는 해당 팀의 승인된 팀원이 볼 수 있습니다.</li>
          <li>서비스 운영, 보안, 백업, 기능 제공을 위해 필요한 범위에서 콘텐츠가 저장/처리될 수 있습니다.</li>
        </ul>
      </TermsSection>

      <TermsSection title="5. 금지 행위">
        <ul className="space-y-2">
          <li>타인의 계정 또는 팀에 무단 접근하는 행위</li>
          <li>저작권, 초상권, 개인정보 등 타인의 권리를 침해하는 자료를 업로드하거나 공유하는 행위</li>
          <li>불법, 음란, 혐오, 폭력, 스팸, 악성코드 등 부적절한 콘텐츠를 등록하는 행위</li>
          <li>서비스의 보안, 안정성, 정상 운영을 방해하는 행위</li>
          <li>자동화된 대량 요청, 크롤링, 리버스 엔지니어링 등 서비스에 과도한 부담을 주는 행위</li>
        </ul>
      </TermsSection>

      <TermsSection title="6. 실험실 기능">
        <p>
          실험실 기능은 테스트 중인 기능을 먼저 사용해볼 수 있도록 제공됩니다. 팀 가이드 트랙, 팀 녹음실 등 실험실 기능은
          예고 없이 변경, 중단, 초기화될 수 있으며 결과의 정확성이나 안정성이 보장되지 않을 수 있습니다.
        </p>
      </TermsSection>

      <TermsSection title="7. 서비스 변경과 중단">
        <p>
          서비스는 운영상, 보안상, 기술상 필요에 따라 일부 기능을 변경하거나 중단할 수 있습니다. 장애 대응, 유지보수,
          외부 서비스 장애, 법령상 요구가 있는 경우 서비스 이용이 일시적으로 제한될 수 있습니다.
        </p>
      </TermsSection>

      <TermsSection title="8. 책임의 제한">
        <p>
          콘티연습실은 예배 준비를 돕는 도구이며, 이용자가 등록한 콘텐츠의 적법성, 정확성, 완전성에 대한 최종 책임은
          해당 이용자에게 있습니다. 외부 서비스 장애, 네트워크 환경, 브라우저 제한, 사용자 기기 문제로 발생한 손해에
          대해서는 관련 법령이 허용하는 범위에서 책임이 제한될 수 있습니다.
        </p>
      </TermsSection>

      <TermsSection title="9. 탈퇴와 데이터 삭제">
        <p>
          이용자는 계정 삭제나 데이터 삭제를 요청할 수 있습니다. 다만 팀 공동 데이터, 백업, 법령상 보관이 필요한 정보는
          즉시 삭제되지 않을 수 있으며, 팀 운영 권한과 데이터 성격을 확인한 뒤 처리합니다.
        </p>
      </TermsSection>

      <TermsSection title="10. 문의">
        <p>
          약관 또는 서비스 이용과 관련한 문의는 <Link href="/contact" className="font-bold text-blue-700">문의/피드백</Link>{" "}
          페이지를 통해 접수해 주세요.
        </p>
      </TermsSection>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm font-semibold leading-7 text-blue-900">
        본 약관은 서비스 기능과 법령 변경에 따라 수정될 수 있습니다. 중요한 변경이 있을 경우 서비스 화면 또는 공지로
        안내합니다.
      </section>
    </div>
  );
}

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-7">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  );
}
