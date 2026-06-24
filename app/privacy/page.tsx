import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 콘티연습실",
  description:
    "콘티연습실의 개인정보 수집, 이용, 보관, 제3자 서비스 이용, 이용자 권리와 문의 방법을 안내합니다.",
};

const effectiveDate = "2026년 6월 25일";

const collectedItems = [
  ["회원가입/로그인", "이메일, 사용자 식별자, 소셜 로그인 제공자가 전달하는 이름/닉네임/프로필 이미지"],
  ["프로필", "표시 이름, 역할/파트, 교회명, 찬양팀명, 예배명, 실험실 사용 여부"],
  ["팀 기능", "팀 정보, 초대/승인 내역, 팀원 역할, 채팅, 1:1 대화, 공지사항, 댓글, 캘린더 응답과 메모"],
  ["콘티/곡", "콘티 제목, 예배일, 곡 정보, 키, BPM, 송폼, 메모, 악보 이미지 링크, 유튜브 링크, PDF 설정"],
  ["알림", "앱 안 알림, 푸시 구독 endpoint와 브라우저 키 정보"],
  ["실험 기능", "팀 가이드 트랙 데이터, 녹음 세션/트랙 메타데이터, 녹음 파일의 저장 경로와 파일 정보"],
  ["자동 생성 정보", "접속 환경, 브라우저 정보, 오류 로그, 서비스 보안과 안정성 확인에 필요한 기술 정보"],
];

const processors = [
  ["Supabase", "회원 인증, 데이터베이스, Realtime, Row Level Security 기반 접근 제어"],
  ["Vercel", "웹 애플리케이션 배포와 서버 라우트 실행"],
  ["Cloudflare R2", "팀 녹음실 오디오 파일 저장"],
  ["Cloudinary", "사용자가 업로드한 이미지 저장 또는 변환 기능을 사용하는 경우 이미지 처리"],
  ["Google/YouTube", "Google 로그인, YouTube Data API 검색, YouTube 영상 임베드"],
  ["Naver", "네이버 소셜 로그인을 활성화한 경우 인증 정보 제공"],
  ["Kakao", "문의/피드백 채널 연결"],
];

export default function PrivacyPage() {
  return (
    <div className="page-shell max-w-4xl space-y-6 pb-20">
      <section className="card p-6 sm:p-8">
        <p className="text-sm font-black text-blue-700">정책</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">개인정보처리방침</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          콘티연습실은 찬양팀 예배 준비를 돕기 위해 필요한 범위에서 개인정보를 처리합니다. 본 방침은 서비스에서
          어떤 정보를 수집하고 어떻게 보호하는지 안내합니다.
        </p>
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600">시행일: {effectiveDate}</p>
      </section>

      <PolicySection title="1. 수집하는 개인정보 항목">
        <div className="grid gap-3">
          {collectedItems.map(([title, description]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="font-black text-slate-950">{title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </PolicySection>

      <PolicySection title="2. 개인정보 이용 목적">
        <ul className="space-y-2 text-sm leading-7 text-slate-600">
          <li>회원 식별, 로그인 유지, 계정 관리</li>
          <li>콘티, 곡 보관함, 팀 초대/승인, 채팅, 공지사항, 캘린더, 알림 기능 제공</li>
          <li>팀 가이드 트랙과 팀 녹음실 같은 실험 기능 제공</li>
          <li>부정 이용 방지, 보안, 장애 대응, 서비스 개선</li>
          <li>사용자 문의 응대와 공지 전달</li>
        </ul>
      </PolicySection>

      <PolicySection title="3. 보관 및 파기">
        <p>
          회원 정보와 사용자가 만든 콘텐츠는 계정 유지와 서비스 제공에 필요한 동안 보관됩니다. 사용자가 삭제하거나
          탈퇴를 요청하면 법령상 보관이 필요한 정보를 제외하고 지체 없이 삭제 또는 비식별 처리합니다.
        </p>
        <p>
          팀 채팅, 공지, 댓글, 녹음 파일 등 팀 공동 데이터는 팀 운영과 다른 팀원의 접근 권한에 영향을 줄 수 있으므로
          삭제 요청 시 팀 권한과 데이터 성격을 확인한 뒤 처리합니다.
        </p>
      </PolicySection>

      <PolicySection title="4. 외부 서비스와 처리 위탁">
        <p>
          콘티연습실은 안정적인 서비스 제공을 위해 아래 외부 서비스를 사용할 수 있습니다. 각 서비스는 필요한 범위에서만
          데이터를 처리합니다.
        </p>
        <div className="mt-4 grid gap-3">
          {processors.map(([name, purpose]) => (
            <div key={name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-950">{name}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{purpose}</p>
            </div>
          ))}
        </div>
      </PolicySection>

      <PolicySection title="5. 팀 데이터와 녹음 파일 접근">
        <p>
          팀 콘티, 채팅, 공지사항, 일정, 팀 녹음실 데이터는 해당 팀의 승인된 팀원에게만 제공되도록 설계되어 있습니다.
          팀 리더와 부리더는 팀 운영 목적상 일부 콘텐츠를 관리할 수 있습니다.
        </p>
        <p>
          팀 녹음실의 실제 오디오 파일은 Cloudflare R2에 저장되며, Supabase에는 object key, MIME type, 파일 크기,
          길이 같은 메타데이터만 저장됩니다. 오디오 파일은 짧은 만료 시간의 재생 URL을 발급받아 접근합니다.
        </p>
      </PolicySection>

      <PolicySection title="6. 이용자의 권리">
        <p>
          이용자는 본인의 개인정보 조회, 수정, 삭제, 처리 정지를 요청할 수 있습니다. 계정 정보는 내 계정 화면에서 일부
          직접 수정할 수 있으며, 추가 요청은 문의/피드백 채널로 접수할 수 있습니다.
        </p>
      </PolicySection>

      <PolicySection title="7. 만 14세 미만 이용">
        <p>
          콘티연습실은 원칙적으로 만 14세 이상 사용을 기준으로 합니다. 만 14세 미만 사용자가 팀 기능을 사용하려면
          법정대리인의 동의가 필요할 수 있습니다.
        </p>
      </PolicySection>

      <PolicySection title="8. 개인정보 보호책임자 및 문의">
        <p>
          개인정보와 서비스 이용 관련 문의는 <Link href="/contact" className="font-bold text-blue-700">문의/피드백</Link>{" "}
          페이지를 통해 접수해 주세요. 접수된 요청은 확인 후 가능한 범위에서 신속히 답변합니다.
        </p>
      </PolicySection>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-7 text-amber-900">
        본 방침은 서비스 기능과 법령 변경에 따라 수정될 수 있습니다. 중요한 변경이 있을 경우 서비스 화면 또는 공지로
        안내합니다.
      </section>
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-7">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  );
}
