import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "콘티연습실 사용설명서 | 찬양팀 콘티 작성과 팀 공유 가이드",
  description:
    "콘티연습실 사용법을 안내합니다. 콘티 작성, 팀 초대, 팀 채팅, 공지사항, 캘린더, PDF 만들기, 악보 검색, 유튜브 검색, 튜너와 메트로놈 사용 방법을 확인하세요.",
};

const guideSections = [
  ["intro", "콘티연습실 소개"],
  ["start", "처음 시작하기"],
  ["setlists", "콘티 만들기"],
  ["library", "곡 보관함"],
  ["pdf", "악보 이미지와 PDF"],
  ["search", "악보 검색 / 유튜브 검색"],
  ["team", "팀 기능"],
  ["roles", "리더/부리더/팀원 권한"],
  ["chat", "팀 채팅과 1:1 대화"],
  ["posts", "공지사항"],
  ["calendar", "팀 캘린더와 가능 여부 체크"],
  ["notifications", "알림"],
  ["tools", "튜너 & 메트로놈"],
  ["mobile", "휴대폰에서 사용하기"],
  ["faq", "자주 묻는 질문"],
] as const;

const guideFaqItems = [
  {
    question: "앱 설치가 필요한가요?",
    answer: "별도 설치 없이 웹에서 사용할 수 있습니다. 휴대폰에서도 같은 주소로 접속해 사용할 수 있습니다.",
  },
  {
    question: "팀원도 로그인해야 하나요?",
    answer: "팀 초대, 팀 채팅, 1:1 대화, 공지사항, 캘린더 같은 팀 기능을 사용하려면 로그인이 필요합니다.",
  },
  {
    question: "악보를 직접 제공하나요?",
    answer: "콘티연습실은 악보를 직접 제공하지 않습니다. 사용자가 보유한 자료나 허락된 자료를 정리하는 도구입니다.",
  },
  {
    question: "팀원이 아무나 들어올 수 있나요?",
    answer: "아닙니다. 초대코드나 초대링크로 참여 요청을 보낸 뒤 리더가 승인해야 팀 기능을 사용할 수 있습니다.",
  },
  {
    question: "팀 콘티를 만들면 바로 알림이 가나요?",
    answer: "새 콘티 화면에서는 초안만 만들어집니다. 편집 화면에서 팀에 저장 버튼을 눌러야 새 콘티 알림이 한 번 전송됩니다.",
  },
  {
    question: "휴대폰으로도 사용할 수 있나요?",
    answer: "네. 콘티 확인, 채팅, 공지 확인, 가능 여부 체크, 튜너와 메트로놈을 휴대폰에서 사용할 수 있습니다.",
  },
  {
    question: "튜너의 마이크 소리가 서버로 올라가나요?",
    answer: "튜너의 마이크 입력은 브라우저 안에서 분석되며 서버로 업로드되지 않습니다.",
  },
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: guideFaqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function GuidePage() {
  return (
    <div className="page-shell space-y-8 pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 sm:p-8">
          <p className="text-sm font-black text-blue-700">사용설명서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">콘티연습실 사용설명서</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
            찬양팀 콘티 작성부터 팀 공유, 채팅, 공지사항, 일정 확인, PDF 만들기, 연습도구 사용까지 한눈에
            확인하세요.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/setlists/new" className="btn-primary">새 콘티 만들기</Link>
            <Link href="/teams" className="btn-secondary">내 팀</Link>
            <Link href="/tools/tuner" className="btn-secondary">연습도구</Link>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="section-title">목차</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {guideSections.map(([id, label], index) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <span className="mr-2 text-blue-700">{index + 1}.</span>
              {label}
            </a>
          ))}
        </div>
      </section>

      <GuideSection id="intro" index={1} title="콘티연습실 소개">
        <p>
          콘티연습실은 찬양팀이 예배 콘티를 만들고, 곡별 송폼과 메모, 악보 이미지, 유튜브 연습 링크를 한곳에
          정리하는 웹 도구입니다. 팀 기능을 사용하면 초대된 팀원과 콘티, 공지사항, 채팅, 일정과 가능 여부를 함께
          확인할 수 있습니다.
        </p>
        <Callout>
          PC와 휴대폰 모두 사용할 수 있습니다. 로그인 전 콘티는 이 브라우저에 임시 저장되고, 로그인하면 계정
          클라우드에 저장해 다른 기기에서도 이어서 사용할 수 있습니다.
        </Callout>
      </GuideSection>

      <GuideSection id="start" index={2} title="처음 시작하기">
        <StepList
          items={[
            ["회원가입/로그인", "상단 메뉴의 로그인 또는 회원가입에서 계정을 만듭니다. 팀 기능은 로그인이 필요합니다."],
            ["팀 만들기", "상단 메뉴 내 팀에서 새 팀 만들기로 이동해 교회 이름과 찬양팀 이름을 입력합니다."],
            ["팀원 초대하기", "팀 대시보드의 초대코드 또는 초대링크를 복사해 팀원에게 전달합니다."],
            ["팀원 승인하기", "팀원이 초대코드로 참여 요청을 보내면 리더가 팀 대시보드에서 승인합니다."],
            ["첫 콘티 만들기", "콘티 메뉴 또는 팀 대시보드의 콘티 만들기에서 콘티 초안을 만듭니다."],
          ]}
        />
      </GuideSection>

      <GuideSection id="setlists" index={3} title="콘티 만들기">
        <p>
          상단 메뉴 <InlineCode>콘티</InlineCode>에서 <InlineCode>새 콘티 만들기</InlineCode>로 이동합니다. 제목과
          저장 위치를 선택한 뒤 <InlineCode>콘티 초안 만들기</InlineCode>를 누르면 편집 화면으로 이동합니다.
        </p>
        <StepList
          items={[
            ["기본 정보 입력", "콘티 제목, 예배 날짜, 예배 이름, 전체 설명, 전체 강조사항을 입력합니다."],
            ["곡 추가", "곡 목록에서 새 곡 추가 또는 첫 곡 추가를 눌러 곡을 추가합니다."],
            ["곡 정보 입력", "곡 제목, BPM, 원키/연습키, 카포, 코드폼, 코드 진행, 곡 설명, 강조사항, 파트별 메모를 정리합니다."],
            ["유튜브 링크 확인", "유튜브 링크를 입력하고 확인을 누르면 영상 재생 중 송폼을 찍을 수 있는 영역이 열립니다."],
            ["송폼 만들기", "송폼 만들기 열기에서 Intro, Verse, Chorus 같은 구간 버튼으로 곡 구성을 만들 수 있습니다."],
            ["저장", "개인 콘티는 콘티 저장, 팀 콘티는 팀에 저장 버튼을 사용합니다."],
          ]}
        />
        <Callout>
          편집 중 변경사항은 임시저장됩니다. 팀 콘티는 <InlineCode>팀에 저장</InlineCode>을 누르기 전까지 팀원에게
          새 콘티 알림이 가지 않습니다. 이미 팀에 저장된 콘티를 수정 저장해도 새 콘티 알림은 다시 가지 않습니다.
        </Callout>
      </GuideSection>

      <GuideSection id="library" index={4} title="곡 보관함">
        <p>
          상단 메뉴 <InlineCode>곡 보관함</InlineCode>에서 자주 부르는 곡을 저장할 수 있습니다. 곡 제목, 유튜브
          링크, 키, BPM, 설명과 메모를 저장해두면 다음 콘티에서 다시 사용할 수 있습니다.
        </p>
        <p>
          콘티 수정 화면의 곡 목록에서는 <InlineCode>보관함에서 불러오기</InlineCode>로 저장된 곡을 가져올 수 있고,
          곡 카드 안의 <InlineCode>보관함 저장</InlineCode> 버튼으로 현재 곡 정보를 보관함에 저장할 수 있습니다.
        </p>
      </GuideSection>

      <GuideSection id="pdf" index={5} title="악보 이미지와 PDF">
        <p>
          곡 편집 화면의 <InlineCode>코드 메모/악보/이미지</InlineCode> 섹션에서 코드 메모, 코드 진행, 악보/참고
          링크와 곡 이미지를 관리합니다. 이미지 영역에는 <InlineCode>이미지 직접 넣기</InlineCode> 또는 링크 추가를
          사용할 수 있습니다.
        </p>
        <p>
          콘티 보기 화면에서 <InlineCode>PDF 만들기</InlineCode>를 누르면 PDF 미리보기 페이지로 이동합니다. 미리보기에서는
          콘티 이름, 예배 날짜, 팀원, 곡 설명, 강조사항, 파트별 메모, 악보 이미지 같은 항목을 <InlineCode>빼기</InlineCode>로
          제외할 수 있습니다.
        </p>
        <p>
          악보 이미지는 <InlineCode>비율 맞춰 줄이기</InlineCode>, <InlineCode>위아래만 줄이기</InlineCode>,
          <InlineCode>다음 장</InlineCode>, <InlineCode>나눠서 넣기</InlineCode> 옵션으로 출력 방식을 조정한 뒤
          <InlineCode>PDF로 저장/인쇄</InlineCode>를 누릅니다.
        </p>
        <Callout tone="warning">
          콘티연습실은 악보를 직접 제공하지 않습니다. 사용자가 보유한 악보 이미지나 허락된 자료를 정리할 수 있도록
          돕는 도구입니다. 저작권이 있는 악보는 권리자의 허락 범위 안에서만 사용해 주세요.
        </Callout>
      </GuideSection>

      <GuideSection id="search" index={6} title="악보 검색 / 유튜브 검색">
        <p>
          곡 편집 화면의 유튜브 링크 영역에는 <InlineCode>유튜브에서 찾기</InlineCode> 기능이 있습니다. 곡 제목을
          기준으로 YouTube Data API 검색 결과를 앱 안에 표시하고, 선택한 영상 URL을 유튜브 링크 입력값에 넣습니다.
          검색 결과를 넣은 뒤에는 기존 저장 버튼으로 콘티에 반영합니다.
        </p>
        <p>
          <InlineCode>악보 검색 도우미</InlineCode>는 앱 안에서 악보를 수집하지 않습니다. <InlineCode>구글 이미지에서 악보 찾기</InlineCode>와
          <InlineCode>코드 악보 검색</InlineCode> 버튼으로 새 탭의 검색 결과를 열어 사용자가 직접 확인하도록 돕습니다.
        </p>
      </GuideSection>

      <GuideSection id="team" index={7} title="팀 기능">
        <StepList
          items={[
            ["팀 생성", "내 팀에서 새 팀 만들기로 팀을 만들면 고유 초대코드가 발급됩니다."],
            ["초대", "팀 대시보드에서 초대코드 또는 초대링크를 복사해 팀원에게 보냅니다."],
            ["참여 요청", "팀원은 초대코드로 팀 참여 요청을 보냅니다. 초대코드를 알아도 바로 팀원이 되지는 않습니다."],
            ["리더 승인", "리더가 팀 대시보드의 참여 요청을 승인하면 팀원이 됩니다."],
            ["팀 대시보드", "팀에 들어가면 이번 주 콘티, 일정, 공지사항, 채팅, 팀원 현황을 한 화면에서 확인합니다."],
          ]}
        />
      </GuideSection>

      <GuideSection id="roles" index={8} title="리더/부리더/팀원 권한">
        <div className="grid gap-3 md:grid-cols-3">
          <RoleCard
            title="리더"
            badge="금색 왕관"
            items={[
              "팀 관리 권한",
              "팀원 승인/거절/삭제",
              "부리더 지정/해제",
              "리더 권한 양도",
              "팀 콘티, 공지사항, 일정 관리",
            ]}
          />
          <RoleCard
            title="부리더"
            badge="은색 왕관"
            items={[
              "팀 콘티 작성 및 수정",
              "공지사항 작성 및 수정",
              "일정 생성 및 수정",
              "팀원 승인/삭제 불가",
              "리더 양도 불가",
            ]}
          />
          <RoleCard
            title="팀원"
            badge="일반 팀원"
            items={["콘티 확인", "팀 채팅 사용", "1:1 대화 사용", "공지 확인", "일정 가능 여부 체크"]}
          />
        </div>
      </GuideSection>

      <GuideSection id="chat" index={9} title="팀 채팅과 1:1 대화">
        <p>
          팀 안에서는 탭 메뉴 <InlineCode>채팅</InlineCode>에서 팀 전체 채팅을 사용할 수 있습니다. 승인된 팀원만
          접근할 수 있고, 메시지 읽음 표시와 온라인 팀원 표시가 제공됩니다.
        </p>
        <p>
          탭 메뉴 <InlineCode>1:1</InlineCode>에서는 같은 팀의 승인된 팀원과 개인 대화를 시작할 수 있습니다. 메시지
          알림과 읽음 처리가 적용됩니다.
        </p>
        <p>
          화면 오른쪽 아래의 팀 채팅 버튼은 승인된 팀이 있을 때 빠르게 팀 채팅을 열 수 있는 보조 진입점입니다.
        </p>
      </GuideSection>

      <GuideSection id="posts" index={10} title="공지사항">
        <p>
          팀 탭 메뉴 <InlineCode>공지사항</InlineCode>에서 팀 공지를 확인합니다. 리더와 부리더는
          <InlineCode>공지 작성</InlineCode>으로 공지를 등록할 수 있고, 작성 시 <InlineCode>팀원들에게 알림 보내기</InlineCode>를
          선택할 수 있습니다.
        </p>
        <p>
          공지 상세를 열면 읽음 처리됩니다. 리더/부리더는 공지를 수정할 수 있고, 리더는 삭제할 수 있습니다.
        </p>
      </GuideSection>

      <GuideSection id="calendar" index={11} title="팀 캘린더와 가능 여부 체크">
        <p>
          팀 탭 메뉴 <InlineCode>캘린더</InlineCode>에서 예배, 연습, 행사 일정을 확인합니다. 리더와 부리더는
          <InlineCode>일정 만들기</InlineCode>로 새 일정을 등록하고, 반복 옵션으로 매주, 격주, 매월 같은 날짜,
          매월 같은 주차/요일 일정을 한 번에 만들 수 있습니다.
        </p>
        <p>
          일정 상세에서 팀원은 <InlineCode>가능해요</InlineCode>, <InlineCode>어려워요</InlineCode>,
          <InlineCode>미정이에요</InlineCode>를 선택하고 <InlineCode>가능 여부 저장</InlineCode>을 누릅니다.
          리더/부리더는 미응답자에게 가능 여부 요청 알림을 보낼 수 있습니다.
        </p>
        <Callout>
          팀 캘린더는 누가 가능한지 확인하는 용도이고, 실제 섬김 팀원 지정은 콘티 안에서 진행합니다.
        </Callout>
      </GuideSection>

      <GuideSection id="notifications" index={12} title="알림">
        <p>
          상단 종 아이콘에서 앱 안 알림을 확인합니다. 알림에는 팀 채팅, 1:1 대화, 새 팀 콘티, 공지사항, 일정,
          가능 여부 요청, 팀 초대 승인, 부리더 지정/해제, 리더 변경이 포함됩니다.
        </p>
        <p>
          알림 드롭다운의 알림 설정 링크로 이동하면 휴대폰 푸시 알림을 켤 수 있습니다. iPhone은 홈 화면에 추가한
          PWA 환경에서 알림 허용이 필요할 수 있습니다.
        </p>
        <Callout>
          빈 콘티 생성이나 자동 임시저장만으로는 팀원에게 새 콘티 알림이 가지 않습니다. 팀 콘티는
          <InlineCode>팀에 저장</InlineCode>을 눌렀을 때 최초 1회 알림을 보냅니다.
        </Callout>
      </GuideSection>

      <GuideSection id="tools" index={13} title="튜너 & 메트로놈">
        <p>
          상단 메뉴 <InlineCode>연습도구</InlineCode>는 <InlineCode>/tools/tuner</InlineCode> 페이지로 연결됩니다.
          페이지 안에서 <InlineCode>튜너</InlineCode>와 <InlineCode>메트로놈</InlineCode> 탭을 전환합니다.
        </p>
        <StepList
          items={[
            ["튜너", "튜너 시작하기를 누르고 마이크 권한을 허용하면 현재 음, 주파수, 센트 오차를 확인합니다."],
            ["메트로놈", "BPM을 40~240 사이에서 입력하거나 -1/+1, -5/+5 버튼으로 조정합니다."],
            ["박자", "4/4, 3/4, 6/8, 2/4 박자를 선택할 수 있습니다."],
            ["탭 템포", "탭으로 BPM 맞추기 버튼을 여러 번 눌러 최근 탭 간격으로 BPM을 계산합니다."],
            ["진동", "브라우저가 지원하면 박자마다 진동 옵션을 사용할 수 있습니다."],
          ]}
        />
        <Callout>
          튜너의 마이크 입력은 브라우저 안에서만 분석되며 서버로 업로드되지 않습니다. 휴대폰에서는 기기 마이크를
          악기 가까이에 두면 감지가 더 안정적입니다.
        </Callout>
      </GuideSection>

      <GuideSection id="mobile" index={14} title="휴대폰에서 사용하기">
        <p>
          휴대폰에서도 콘티 보기, 곡 상세 연습, 팀 채팅, 1:1 대화, 공지 확인, 가능 여부 체크, 튜너와 메트로놈을
          사용할 수 있습니다. PDF 미리보기와 인쇄 저장 화면도 모바일 화면에 맞춰 표시됩니다.
        </p>
        <p>
          알림 기능을 사용하려면 알림 설정에서 휴대폰 푸시 알림을 켭니다. iPhone에서는 Safari에서 홈 화면에 추가한
          뒤 알림을 허용해야 할 수 있습니다.
        </p>
      </GuideSection>

      <GuideSection id="faq" index={15} title="자주 묻는 질문">
        <div className="grid gap-3">
          {guideFaqItems.map((item) => (
            <details key={item.question} className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer font-black text-slate-950">{item.question}</summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </GuideSection>
    </div>
  );
}

function GuideSection({ id, index, title, children }: { id: string; index: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 p-5 sm:p-7">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
          {index}
        </span>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
        </div>
      </div>
      <div className="space-y-4 text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">{children}</div>
    </section>
  );
}

function StepList({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-3">
      {items.map(([title, description]) => (
        <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-black text-slate-950">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      ))}
    </div>
  );
}

function RoleCard({ title, badge, items }: { title: string; badge: string; items: string[] }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-lg font-black text-slate-950">{title}</p>
      <p className="mt-1 text-xs font-black text-blue-700">{badge}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </article>
  );
}

function Callout({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return (
    <div
      className={
        tone === "warning"
          ? "rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-7 text-amber-900"
          : "rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold leading-7 text-blue-900"
      }
    >
      {children}
    </div>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-bold text-slate-800">{children}</code>;
}
