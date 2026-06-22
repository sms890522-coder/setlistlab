import type { Metadata } from "next";
import Link from "next/link";
import { existsSync } from "node:fs";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "콘티연습실 사용설명서 | 콘티 만들기와 연습 기능 가이드",
  description:
    "콘티연습실 사용법을 안내합니다. 콘티 만들기, 콘티 보는 방법, 송폼 작성, 유튜브 연습 영상, 구간 반복, 재생속도 조절, 악보 이미지, PDF 만들기, 팀 채팅, 공지사항, 캘린더 사용법을 확인하세요.",
};

const guideImages = {
  createSetlist: {
    src: "/guide/create-setlist.png",
    alt: "콘티연습실에서 새 콘티를 만드는 화면",
    caption: "콘티 제목, 예배 날짜, 저장 위치를 정하고 콘티 초안을 만듭니다.",
  },
  songFormEditor: {
    src: "/guide/song-form-editor.png",
    alt: "콘티연습실 곡 편집 화면",
    caption: "곡 제목, 키, BPM, 유튜브 링크, 송폼, 메모와 이미지를 한 곡씩 정리합니다.",
  },
  viewSetlist: {
    src: "/guide/view-setlist.png",
    alt: "콘티연습실에서 콘티를 보는 화면",
    caption: "팀원이 콘티를 열면 곡 순서와 연습 정보를 한 번에 확인할 수 있습니다.",
  },
  youtubePractice: {
    src: "/guide/youtube-practice.png",
    alt: "콘티연습실 유튜브 곡 연습 화면",
    caption: "곡 상세 화면에서 유튜브 영상, 현재 시간, 재생 버튼과 구간 정보를 확인합니다.",
  },
  loopControl: {
    src: "/guide/loop-control.png",
    alt: "콘티연습실 구간반복 컨트롤 화면",
    caption: "구간에 시작/종료 시간이 있으면 선택한 구간을 반복해서 연습할 수 있습니다.",
  },
  playbackSpeed: {
    src: "/guide/playback-speed.png",
    alt: "콘티연습실 재생속도 조절 화면",
    caption: "PC는 속도 버튼, 모바일은 슬라이더로 재생속도를 조절합니다.",
  },
  songFormNavigation: {
    src: "/guide/song-form-navigation.png",
    alt: "콘티연습실 송폼 구간 이동 화면",
    caption: "곡 구성 및 구간이동에서 Verse, Chorus 같은 구간을 선택해 해당 시간으로 이동합니다.",
  },
  scoreImage: {
    src: "/guide/score-image.png",
    alt: "콘티연습실 곡 이미지 보기 화면",
    caption: "곡에 등록된 악보 이미지나 참고 이미지를 곡 상세에서 확인합니다.",
  },
  pdfExport: {
    src: "/guide/pdf-export.png",
    alt: "콘티연습실 PDF 만들기 화면",
    caption: "PDF 미리보기에서 출력 항목과 악보 이미지 배치를 조정합니다.",
  },
  pdfCustomize: {
    src: "/guide/pdf-customize.png",
    alt: "콘티연습실 PDF 커스터마이징 화면",
    caption: "필요 없는 항목은 빼고, 악보 이미지는 비율 맞춤이나 나눠 넣기로 조정합니다.",
  },
  teamDashboard: {
    src: "/guide/team-dashboard.png",
    alt: "콘티연습실 팀 대시보드 화면",
    caption: "팀 대시보드에서 콘티, 일정, 공지, 채팅과 팀원 현황을 확인합니다.",
  },
  teamInvite: {
    src: "/guide/team-invite.png",
    alt: "콘티연습실 팀 초대 화면",
    caption: "초대코드나 초대링크를 공유하고 리더가 참여 요청을 승인합니다.",
  },
  teamChat: {
    src: "/guide/team-chat.png",
    alt: "콘티연습실 팀 채팅 화면",
    caption: "팀 전체 채팅과 팀원 간 1:1 대화로 예배 준비 내용을 나눕니다.",
  },
  teamPosts: {
    src: "/guide/team-notice.png",
    alt: "콘티연습실 팀 공지사항 화면",
    caption: "중요한 연습 안내와 예배 준비사항은 공지사항으로 남깁니다.",
  },
  teamCalendar: {
    src: "/guide/team-calendar.png",
    alt: "콘티연습실 팀 캘린더 화면",
    caption: "월간 캘린더에서 예배와 연습 일정을 확인합니다.",
  },
  availability: {
    src: "/guide/availability-check.png",
    alt: "콘티연습실 가능 여부 체크 화면",
    caption: "팀원은 일정별로 가능, 어려움, 미정을 선택하고 메모를 남깁니다.",
  },
  tuner: {
    src: "/guide/tuner.png",
    alt: "콘티연습실 튜너 화면",
    caption: "마이크 권한을 허용하면 브라우저에서 악기 음정을 확인할 수 있습니다.",
  },
  metronome: {
    src: "/guide/metronome.png",
    alt: "콘티연습실 메트로놈 화면",
    caption: "BPM, 박자, 탭 템포를 사용해 합주 전 템포를 맞춥니다.",
  },
} as const;

const guideSections = [
  ["intro", "콘티연습실 소개"],
  ["start", "처음 시작하기"],
  ["setlists", "콘티 만들기"],
  ["view-setlist-practice", "콘티 보는 방법과 연습 기능"],
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
    question: "팀원이 콘티를 어떻게 확인하나요?",
    answer:
      "팀에 승인된 팀원은 내 팀에서 공유된 콘티를 열어 곡 순서, 키, BPM, 송폼, 악보 이미지, 유튜브 연습 영상을 확인할 수 있습니다.",
  },
  {
    question: "유튜브 구간 반복은 어떻게 사용하나요?",
    answer:
      "곡 구성에 시작 시간과 종료 시간이 저장되어 있으면 곡 상세 화면에서 해당 구간을 선택하고 반복 ON을 눌러 같은 구간을 반복해서 들을 수 있습니다.",
  },
  {
    question: "송폼은 무엇인가요?",
    answer:
      "송폼은 Intro, Verse, Chorus, Bridge처럼 곡의 진행 순서를 정리한 것입니다. 팀원들이 곡의 흐름을 쉽게 이해하고 같은 구조로 연습할 수 있게 도와줍니다.",
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
        <GuideImage image={guideImages.createSetlist} />
        <StepList
          items={[
            ["새 콘티 만들기", "상단 메뉴 콘티 또는 팀 대시보드에서 새 콘티 만들기로 들어갑니다."],
            ["콘티 제목 입력", "콘티 제목, 예배 날짜, 예배 이름, 전체 설명, 전체 강조사항을 입력합니다."],
            ["저장 위치 선택", "로그인한 사용자는 개인 콘티 또는 승인된 팀의 팀 콘티로 저장 위치를 선택합니다."],
            ["팀 콘티 저장", "팀 콘티는 편집 화면에서 팀에 저장 버튼을 눌렀을 때 팀원에게 새 콘티 알림이 갑니다."],
            ["곡 추가", "곡 목록에서 새 곡 추가 또는 첫 곡 추가를 눌러 곡을 추가합니다."],
            ["곡 제목 입력", "각 곡 카드에서 곡 제목을 입력합니다. 제목은 콘티 보기와 곡 상세 화면에 표시됩니다."],
            ["키 입력", "카포/조옮김 도우미에서 원키, 연습키, 코드폼, 카포와 조옮김 메모를 정리합니다."],
            ["BPM 입력", "BPM 입력칸에 곡 템포를 숫자로 입력합니다."],
            ["유튜브 링크 입력", "유튜브 링크를 입력하고 확인 버튼을 누르면 영상 재생 중 송폼을 찍을 수 있는 영역이 열립니다."],
            ["악보 이미지 등록", "코드 메모/악보/이미지 섹션에서 이미지 직접 넣기 또는 이미지 링크로 곡 이미지를 등록합니다."],
            ["파트별 메모", "파트별 메모에서 보컬, 일렉, 건반, 드럼 등 파트별 안내를 추가합니다."],
          ]}
        />
        <GuideImage image={guideImages.songFormEditor} />
        <p>
          송폼은 곡의 진행 순서를 정리하는 기능입니다. 예를 들어
          <InlineCode>Intro - Verse 1 - Chorus - Verse 2 - Chorus - Bridge - Chorus</InlineCode>처럼 곡의 흐름을
          저장해두면 팀원들이 연습할 때 어느 구간을 연주하는지 쉽게 확인할 수 있습니다.
        </p>
        <StepList
          items={[
            ["직접 추가", "곡 구성에서 구간 추가를 누르거나 Intro, Verse, Chorus 같은 프리셋 버튼을 눌러 구간을 추가합니다."],
            ["시간 입력", "각 구간에는 시작 시간, 종료 시간, 메모를 입력할 수 있습니다. 시간은 00:18 또는 01:30 형식으로 입력합니다."],
            ["순서 변경", "구간 카드의 위로, 아래로 버튼으로 송폼 순서를 바꿀 수 있습니다."],
            ["영상 보면서 찍기", "유튜브 링크 확인 후 송폼 만들기 열기를 누르면 영상을 보면서 Intro, Verse, Chorus 버튼으로 현재 시간을 구간 시작점으로 찍을 수 있습니다."],
            ["자동 종료 시간", "영상 재생 중 새 구간을 찍으면 직전에 열려 있던 구간의 종료 시간이 현재 시간으로 저장됩니다."],
            ["삭제", "실시간 구간 입력에서는 선택 삭제와 전체 삭제를 사용할 수 있고, 직접 입력한 곡 구성에서는 구간별 삭제를 사용할 수 있습니다."],
          ]}
        />
        <Callout>
          편집 중 변경사항은 임시저장됩니다. 팀 콘티는 <InlineCode>팀에 저장</InlineCode>을 누르기 전까지 팀원에게
          새 콘티 알림이 가지 않습니다. 이미 팀에 저장된 콘티를 수정 저장해도 새 콘티 알림은 다시 가지 않습니다.
        </Callout>
      </GuideSection>

      <GuideSection id="view-setlist-practice" index={4} title="콘티 보는 방법과 연습 기능">
        <p>
          팀원이 공유받은 콘티를 열면 곡 순서, 키, BPM, 송폼, 악보 이미지, 유튜브 연습 영상을 한 번에 확인할 수
          있습니다. 팀에 승인된 사용자는 <InlineCode>내 팀</InlineCode>에서 팀 대시보드로 들어가 팀 콘티를 열 수
          있고, 공유 링크를 받은 경우 <InlineCode>/s/[shareSlug]</InlineCode> 공유 화면에서 읽기 전용 콘티를 확인할
          수 있습니다.
        </p>
        <GuideImage image={guideImages.viewSetlist} />
        <StepList
          items={[
            ["콘티 열기", "상단 메뉴 내 팀에서 팀을 선택한 뒤 대시보드 또는 콘티 탭에서 원하는 콘티를 엽니다. 개인 콘티는 상단 메뉴 콘티의 목록에서 선택합니다."],
            ["공유 링크로 열기", "공유하기로 만든 링크는 공유 콘티 화면으로 열립니다. 원본 콘티가 수정되면 공유 화면도 최신 내용으로 보입니다."],
            ["곡 순서 확인", "콘티 보기 화면의 곡 목록에서 예배 흐름에 따른 곡 순서를 확인합니다."],
            ["곡 정보 확인", "곡 카드에는 곡 제목, 연습키, BPM, 코드폼/카포, 곡 설명, 송폼 요약, 강조사항 요약, YouTube 표시가 나타납니다."],
            ["연습 완료 체크", "곡 카드와 곡 상세 화면에서 연습 완료를 체크할 수 있습니다. 이 체크는 개인별 브라우저 저장 상태로 관리됩니다."],
            ["곡 상세로 이동", "곡 카드를 누르면 해당 곡의 연습 화면으로 이동합니다. 하단의 이전곡, 곡 목록, 다음곡 버튼으로 곡 사이를 이동합니다."],
          ]}
        />

        <h3 className="pt-2 text-lg font-black text-slate-950">유튜브 영상 재생</h3>
        <p>
          곡에 유튜브 링크가 저장되어 있으면 곡 상세 화면에 YouTube IFrame 플레이어가 표시됩니다. 링크가 없으면
          <InlineCode>유튜브 링크가 필요합니다</InlineCode> 안내와 <InlineCode>링크 입력하기</InlineCode> 버튼이
          표시됩니다.
        </p>
        <GuideImage image={guideImages.youtubePractice} />
        <p>
          곡 편집 화면에서는 <InlineCode>유튜브에서 찾기</InlineCode>로 검색 결과를 선택해 유튜브 링크 입력값에 넣을
          수 있습니다. 선택 후에는 저장 버튼을 눌러야 콘티에 반영됩니다.
        </p>

        <h3 className="pt-2 text-lg font-black text-slate-950">구간 반복과 송폼 구간 이동</h3>
        <p>
          곡 상세 화면의 <InlineCode>곡 구성 및 구간이동</InlineCode>에서 Intro, Verse, Chorus, Bridge 같은 구간을
          누르면 저장된 시작 시간으로 이동합니다. 구간에 시작 시간과 종료 시간이 모두 있으면
          <InlineCode>반복 ON</InlineCode>을 눌러 선택한 구간을 반복 재생할 수 있습니다.
        </p>
        <GuideImage image={guideImages.loopControl} />
        <GuideImage image={guideImages.songFormNavigation} />
        <Callout>
          후렴이나 브릿지처럼 반복해서 연습하고 싶은 구간이 있다면, 곡 구성에 시작 시간과 종료 시간을 저장해두세요.
          영상과 연결된 구간 버튼을 누른 뒤 반복 ON을 켜면 해당 구간을 집중해서 연습할 수 있습니다.
        </Callout>

        <h3 className="pt-2 text-lg font-black text-slate-950">재생속도 조절</h3>
        <p>
          곡 상세의 <InlineCode>재생속도</InlineCode> 영역에서 재생, 일시정지, 5초 뒤로, 5초 앞으로를 사용할 수
          있습니다. PC 화면에서는 <InlineCode>0.25x</InlineCode>, <InlineCode>0.5x</InlineCode>,
          <InlineCode>0.6x</InlineCode>, <InlineCode>0.65x</InlineCode>, <InlineCode>0.7x</InlineCode>,
          <InlineCode>0.75x</InlineCode>, <InlineCode>0.8x</InlineCode>, <InlineCode>0.85x</InlineCode>,
          <InlineCode>0.9x</InlineCode>, <InlineCode>0.95x</InlineCode>, <InlineCode>1x</InlineCode>,
          <InlineCode>1.25x</InlineCode>, <InlineCode>1.5x</InlineCode>, <InlineCode>2x</InlineCode> 버튼이
          제공됩니다. 모바일에서는 0.1x부터 2x까지 조절하는 슬라이더가 표시됩니다.
        </p>
        <GuideImage image={guideImages.playbackSpeed} />
        <Callout>
          속도 적용은 YouTube IFrame API에서 지원하는 범위 안에서 동작합니다. 처음 연습할 때는 속도를 낮춰 천천히
          맞춰보고, 익숙해지면 <InlineCode>1x</InlineCode>로 돌아와 원래 속도로 연습하면 됩니다.
        </Callout>

        <h3 className="pt-2 text-lg font-black text-slate-950">악보 이미지, 메모, 코드 정보 확인</h3>
        <p>
          곡 상세 화면에서는 곡 설명, 강조사항, 파트별 메모, 코드 메모/악보 링크, 곡 이미지, 카포/조옮김 정보를
          확인할 수 있습니다. 곡 이미지가 등록되어 있으면 <InlineCode>곡 이미지</InlineCode> 영역에 표시되고,
          이미지를 누르면 새 탭에서 원본 링크를 열 수 있습니다.
        </p>
        <GuideImage image={guideImages.scoreImage} />
        <p>
          파트별 메모에는 보컬, 일렉, 건반, 드럼 등 각 파트가 확인해야 할 내용을 적어둘 수 있습니다. 곡 뒤
          멘트/기도 메모가 있으면 곡 상세 하단과 콘티 곡 목록 사이에 표시됩니다.
        </p>

        <h3 className="pt-2 text-lg font-black text-slate-950">PDF와 연속재생</h3>
        <p>
          수정 권한이 있는 사용자는 콘티 보기 화면에서 <InlineCode>PDF 만들기</InlineCode>를 눌러 인쇄용 PDF를 만들
          수 있습니다. 콘티 보기 화면의 <InlineCode>콘티 연속재생 시작</InlineCode>을 누르면 유튜브 링크가 있는 곡을
          콘티 순서대로 이어서 재생합니다.
        </p>
        <p>
          현재 코드에는 연습 중 화면이 꺼지지 않게 유지하는 별도 기능은 없습니다. 휴대폰 브라우저의 화면 자동 잠금은
          기기 설정과 브라우저 정책의 영향을 받습니다.
        </p>
      </GuideSection>

      <GuideSection id="library" index={5} title="곡 보관함">
        <p>
          상단 메뉴 <InlineCode>곡 보관함</InlineCode>에서 자주 부르는 곡을 저장할 수 있습니다. 곡 제목, 유튜브
          링크, 키, BPM, 설명과 메모를 저장해두면 다음 콘티에서 다시 사용할 수 있습니다.
        </p>
        <p>
          콘티 수정 화면의 곡 목록에서는 <InlineCode>보관함에서 불러오기</InlineCode>로 저장된 곡을 가져올 수 있고,
          곡 카드 안의 <InlineCode>보관함 저장</InlineCode> 버튼으로 현재 곡 정보를 보관함에 저장할 수 있습니다.
        </p>
      </GuideSection>

      <GuideSection id="pdf" index={6} title="악보 이미지와 PDF">
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
        <GuideImage image={guideImages.pdfExport} />
        <p>
          악보 이미지는 <InlineCode>비율 맞춰 줄이기</InlineCode>, <InlineCode>위아래만 줄이기</InlineCode>,
          <InlineCode>다음 장</InlineCode>, <InlineCode>나눠서 넣기</InlineCode> 옵션으로 출력 방식을 조정한 뒤
          <InlineCode>PDF로 저장/인쇄</InlineCode>를 누릅니다.
        </p>
        <GuideImage image={guideImages.pdfCustomize} />
        <Callout tone="warning">
          콘티연습실은 악보를 직접 제공하지 않습니다. 사용자가 보유한 악보 이미지나 허락된 자료를 정리할 수 있도록
          돕는 도구입니다. 저작권이 있는 악보는 권리자의 허락 범위 안에서만 사용해 주세요.
        </Callout>
      </GuideSection>

      <GuideSection id="search" index={7} title="악보 검색 / 유튜브 검색">
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

      <GuideSection id="team" index={8} title="팀 기능">
        <StepList
          items={[
            ["팀 생성", "내 팀에서 새 팀 만들기로 팀을 만들면 고유 초대코드가 발급됩니다."],
            ["초대", "팀 대시보드에서 초대코드 또는 초대링크를 복사해 팀원에게 보냅니다."],
            ["참여 요청", "팀원은 초대코드로 팀 참여 요청을 보냅니다. 초대코드를 알아도 바로 팀원이 되지는 않습니다."],
            ["리더 승인", "리더가 팀 대시보드의 참여 요청을 승인하면 팀원이 됩니다."],
            ["팀 대시보드", "팀에 들어가면 이번 주 콘티, 일정, 공지사항, 채팅, 팀원 현황을 한 화면에서 확인합니다."],
          ]}
        />
        <GuideImage image={guideImages.teamDashboard} />
        <GuideImage image={guideImages.teamInvite} />
      </GuideSection>

      <GuideSection id="roles" index={9} title="리더/부리더/팀원 권한">
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

      <GuideSection id="chat" index={10} title="팀 채팅과 1:1 대화">
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
        <GuideImage image={guideImages.teamChat} />
      </GuideSection>

      <GuideSection id="posts" index={11} title="공지사항">
        <p>
          팀 탭 메뉴 <InlineCode>공지사항</InlineCode>에서 팀 공지를 확인합니다. 리더와 부리더는
          <InlineCode>공지 작성</InlineCode>으로 공지를 등록할 수 있고, 작성 시 <InlineCode>팀원들에게 알림 보내기</InlineCode>를
          선택할 수 있습니다.
        </p>
        <p>
          공지 상세를 열면 읽음 처리됩니다. 리더/부리더는 공지를 수정할 수 있고, 리더는 삭제할 수 있습니다.
        </p>
        <GuideImage image={guideImages.teamPosts} />
      </GuideSection>

      <GuideSection id="calendar" index={12} title="팀 캘린더와 가능 여부 체크">
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
        <GuideImage image={guideImages.teamCalendar} />
        <GuideImage image={guideImages.availability} />
        <Callout>
          팀 캘린더는 누가 가능한지 확인하는 용도이고, 실제 섬김 팀원 지정은 콘티 안에서 진행합니다.
        </Callout>
      </GuideSection>

      <GuideSection id="notifications" index={13} title="알림">
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

      <GuideSection id="tools" index={14} title="튜너 & 메트로놈">
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
        <GuideImage image={guideImages.tuner} />
        <GuideImage image={guideImages.metronome} />
        <Callout>
          튜너의 마이크 입력은 브라우저 안에서만 분석되며 서버로 업로드되지 않습니다. 휴대폰에서는 기기 마이크를
          악기 가까이에 두면 감지가 더 안정적입니다.
        </Callout>
      </GuideSection>

      <GuideSection id="mobile" index={15} title="휴대폰에서 사용하기">
        <p>
          휴대폰에서도 콘티 보기, 곡 상세 연습, 팀 채팅, 1:1 대화, 공지 확인, 가능 여부 체크, 튜너와 메트로놈을
          사용할 수 있습니다. PDF 미리보기와 인쇄 저장 화면도 모바일 화면에 맞춰 표시됩니다.
        </p>
        <p>
          알림 기능을 사용하려면 알림 설정에서 휴대폰 푸시 알림을 켭니다. iPhone에서는 Safari에서 홈 화면에 추가한
          뒤 알림을 허용해야 할 수 있습니다.
        </p>
      </GuideSection>

      <GuideSection id="faq" index={16} title="자주 묻는 질문">
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

function GuideImage({ image }: { image: (typeof guideImages)[keyof typeof guideImages] }) {
  const publicFilePath = `${process.cwd()}/public${image.src}`;

  if (!existsSync(publicFilePath)) return null;

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <img src={image.src} alt={image.alt} className="h-auto w-full" loading="lazy" />
      {image.caption ? (
        <figcaption className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-500">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
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
