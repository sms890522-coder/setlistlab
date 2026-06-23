import { notFound } from "next/navigation";
import { SongCard } from "@/components/SongCard";
import { TeamAssignmentsView } from "@/components/TeamAssignmentsView";
import { TeamNavTabs } from "@/components/TeamNavTabs";
import { TeamRoleBadge } from "@/components/TeamRoleBadge";
import type { Setlist, Song, TeamAssignment } from "@/lib/types";

type GuideDemoPageProps = {
  params: Promise<{ screen: string }>;
};

const teamId = "guide-demo-team";

const demoSongs: Song[] = [
  {
    id: "guide-song-1",
    title: "주님 말씀하시면",
    description: "말씀에 순종하는 고백으로 예배의 흐름을 여는 곡입니다.",
    youtubeUrl: "https://www.youtube.com/watch?v=guide",
    youtubeVideoId: "guide",
    originalKey: "G",
    practiceKey: "G",
    bpm: 72,
    chordForm: "G",
    capo: 0,
    sections: [
      { id: "s1-1", name: "Intro", startTime: 0, endTime: 18, memo: "어쿠스틱만 가볍게" },
      { id: "s1-2", name: "Verse 1", startTime: 19, endTime: 52, memo: "보컬은 담백하게" },
      { id: "s1-3", name: "Chorus", startTime: 53, endTime: 90, memo: "드럼은 후반 빌드업" },
      { id: "s1-4", name: "Bridge", startTime: 91, endTime: 124, memo: "일렉 패드성 톤" },
      { id: "s1-5", name: "Chorus", startTime: 125, endTime: 160, memo: "회중 유도" },
    ],
    highlights: ["첫 곡이라 과하게 몰아가지 않기", "후렴 두 번째 반복부터 다이내믹 넓히기"],
    partNotes: [
      { id: "pn1", part: "보컬", note: "후렴 화음은 두 번째 반복부터 얇게 넣기" },
      { id: "pn2", part: "일렉", note: "인트로는 딜레이 1/8D 느낌으로 공간 만들기" },
      { id: "pn3", part: "드럼", note: "브릿지 전까지 심벌 사용 절제" },
    ],
    chordMemo: "이번 주는 G키 원곡 흐름으로 진행합니다. 어쿠스틱은 G폼, 일렉은 실제 키 기준으로 연주합니다.",
    chordProgression: "G - D - Em - C",
    sheetLinks: [{ id: "sheet-1", label: "코드 악보", url: "https://example.com/sheet" }],
    transitionNote: "다음 곡으로 넘어가기 전 짧게 기도합니다.",
  },
  {
    id: "guide-song-2",
    title: "나는 예배자입니다",
    description: "고백적인 분위기로 회중이 함께 부르기 좋은 곡입니다.",
    youtubeVideoId: "guide2",
    originalKey: "F",
    practiceKey: "F",
    bpm: 68,
    sections: [
      { id: "s2-1", name: "Verse", startTime: 0, endTime: 42 },
      { id: "s2-2", name: "Chorus", startTime: 43, endTime: 84 },
      { id: "s2-3", name: "Bridge", startTime: 85, endTime: 112 },
      { id: "s2-4", name: "Chorus", startTime: 113, endTime: 150 },
    ],
    highlights: ["후렴은 너무 빠르게 올리지 않기"],
    partNotes: [{ id: "pn4", part: "건반", note: "패드 중심으로 공간 유지" }],
  },
  {
    id: "guide-song-3",
    title: "Way Maker",
    description: "선포하는 분위기로 마무리하는 곡입니다.",
    youtubeVideoId: "guide3",
    originalKey: "E",
    practiceKey: "E",
    bpm: 70,
    sections: [
      { id: "s3-1", name: "Intro", startTime: 0, endTime: 16 },
      { id: "s3-2", name: "Verse", startTime: 17, endTime: 58 },
      { id: "s3-3", name: "Chorus", startTime: 59, endTime: 100 },
      { id: "s3-4", name: "Bridge", startTime: 101, endTime: 145 },
      { id: "s3-5", name: "Chorus", startTime: 146, endTime: 190 },
    ],
    highlights: ["마지막 후렴은 회중 소리를 충분히 듣기"],
    partNotes: [{ id: "pn5", part: "베이스", note: "브릿지부터 옥타브로 열기" }],
  },
];

const demoAssignments: TeamAssignment[] = [
  { id: "ta1", name: "김민수", part: "인도자" },
  { id: "ta2", name: "이은혜", part: "싱어" },
  { id: "ta3", name: "정현우", part: "일렉" },
  { id: "ta4", name: "최수진", part: "건반" },
  { id: "ta5", name: "강준호", part: "드럼" },
];

const demoSetlist: Setlist = {
  id: "guide-setlist",
  teamId,
  status: "published",
  title: "6월 21일 주일예배 콘티",
  worshipDate: "2026-06-21",
  serviceName: "주일 2부예배",
  description: "이번 주는 말씀에 순종하는 고백에서 시작해 회중 선포로 이어지는 흐름입니다.",
  globalNotes: "첫 곡은 절제하고, 두 번째 곡부터 회중 고백이 살아나도록 다이내믹을 넓혀 주세요.",
  songs: demoSongs,
  teamAssignments: demoAssignments,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-15T00:00:00.000Z",
};

export default async function GuideDemoPage({ params }: GuideDemoPageProps) {
  const { screen } = await params;

  if (screen === "create-setlist") return <CreateSetlistDemo />;
  if (screen === "view-setlist") return <ViewSetlistDemo />;
  if (screen === "youtube-practice") return <YoutubePracticeDemo />;
  if (screen === "pdf-export") return <PdfExportDemo />;
  if (screen === "team-dashboard") return <TeamDashboardDemo />;
  if (screen === "team-chat") return <TeamCommunicationDemo />;
  if (screen === "team-calendar") return <TeamCalendarDemo />;
  if (screen === "practice-tools") return <PracticeToolsDemo />;

  notFound();
}

function DemoPage({ children }: { children: React.ReactNode }) {
  return <div className="page-shell space-y-5 pb-20 lg:space-y-8">{children}</div>;
}

function CreateSetlistDemo() {
  return (
    <DemoPage>
      <section data-guide-shot="create-setlist" className="card overflow-hidden lg:grid lg:grid-cols-[0.9fr_1.35fr]">
        <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 lg:flex lg:flex-col lg:justify-between lg:p-8">
          <div>
          <p className="text-sm font-black text-blue-700">새 콘티 만들기</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">6월 21일 주일예배 콘티</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">저장 버튼을 누르기 전까지 팀원들에게 알림이 가지 않습니다.</p>
          </div>
          <div className="mt-6 hidden rounded-2xl border border-blue-100 bg-white/80 p-4 lg:block">
            <p className="text-xs font-black text-blue-700">작성 흐름</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-700">콘티 정보 입력 → 곡 추가 → 송폼 정리 → 팀에 저장</p>
          </div>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2 lg:p-6">
          <Field label="콘티 제목" value="6월 21일 주일예배 콘티" />
          <Field label="저장 위치" value="은혜교회 / 주일 2부 찬양팀" />
          <Field label="예배 날짜" value="2026-06-21" />
          <Field label="예배 이름" value="주일 2부예배" />
          <Field label="전체 설명" value="고백에서 선포로 이어지는 흐름" />
          <Field label="전체 강조사항" value="첫 곡은 절제하고 후반부에 다이내믹 넓히기" />
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-800 lg:col-span-2">
            팀에 저장하면 승인된 팀원에게 새 콘티 알림이 전송됩니다.
          </div>
          <button type="button" className="btn-primary w-full lg:col-span-2">콘티 초안 만들기</button>
        </div>
      </section>

      <section data-guide-shot="song-form-editor" className="card overflow-hidden lg:grid lg:grid-cols-[0.72fr_1.28fr]">
        <div className="border-b border-slate-100 bg-white/80 p-4 lg:border-b-0 lg:border-r lg:p-6">
          <p className="text-xs font-bold text-blue-700">곡 1</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">주님 말씀하시면</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">유튜브 링크 확인 후 바로 아래에서 송폼을 만들 수 있습니다.</p>
          <div className="mt-5 hidden space-y-2 text-sm font-bold text-slate-600 lg:block">
            <p>Key G · BPM 72</p>
            <p>어쿠스틱 G폼 · 카포 0</p>
          </div>
        </div>
        <div className="grid gap-5 p-4 lg:grid-cols-[0.85fr_1.15fr] lg:p-6">
          <div className="grid content-start gap-3">
            <Field label="곡 제목" value="주님 말씀하시면" />
            <Field label="유튜브 링크" value="https://www.youtube.com/watch?v=..." action="확인" />
            <Field label="연습키" value="G" />
            <Field label="BPM" value="72" />
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-950">유튜브로 송폼 만들기</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">영상 재생 중 Intro, Verse, Chorus 버튼으로 구간을 찍습니다.</p>
              </div>
              <button type="button" className="btn-secondary min-h-10 px-3">송폼 만들기 접기</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Intro", "Verse", "Chorus", "Bridge", "Ending"].map((name) => (
                <span key={name} className="rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-black text-blue-700">
                  {name}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-950">곡 구성</h3>
              <button type="button" className="btn-secondary min-h-10 px-3">구간 추가</button>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {demoSongs[0].sections.slice(0, 3).map((section) => (
                <div key={section.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-slate-950">{section.name}</p>
                    <p className="text-xs font-bold text-blue-700">{formatTime(section.startTime)} - {formatTime(section.endTime)}</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{section.memo}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </DemoPage>
  );
}

function ViewSetlistDemo() {
  return (
    <DemoPage>
      <section data-guide-shot="view-setlist" className="space-y-4 lg:grid lg:grid-cols-[1.4fr_0.8fr] lg:items-start lg:gap-4 lg:space-y-0">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5">
            <p className="text-sm font-bold text-blue-700">{demoSetlist.worshipDate} · {demoSetlist.serviceName}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{demoSetlist.title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-700">{demoSetlist.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="btn-primary">콘티 연속재생 시작</span>
              <span className="btn-secondary">PDF 만들기</span>
              <span className="btn-secondary">복제</span>
            </div>
          </div>
        </div>
        <TeamAssignmentsView assignments={demoAssignments} />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">곡 목록</h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">3곡</span>
          </div>
          {demoSongs.slice(0, 2).map((song, index) => (
            <SongCard key={song.id} href="#" song={song} index={index} />
          ))}
        </div>
      </section>
    </DemoPage>
  );
}

function YoutubePracticeDemo() {
  const selected = demoSongs[0].sections[2];

  return (
    <DemoPage>
      <section data-guide-shot="youtube-practice" className="space-y-4 lg:grid lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-5 lg:space-y-0">
        <div className="card p-5">
          <p className="text-sm font-bold text-blue-700">{demoSetlist.title}</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">{demoSongs[0].title}</h1>
          <p className="mt-2 text-sm text-slate-500">연습키 G · 원키 G · BPM 72</p>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">팀원은 영상과 송폼을 함께 보면서 필요한 구간을 바로 연습할 수 있습니다.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-950">
          <div className="flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-slate-950 to-slate-800 text-center text-white">
            <div>
              <p className="text-sm font-bold text-slate-300">YouTube IFrame Player</p>
              <p className="mt-2 text-2xl font-black">주님 말씀하시면</p>
            </div>
          </div>
        </div>
      </section>

      <section data-guide-shot="playback-speed" className="card p-4 lg:p-5">
        <div className="grid gap-3 lg:grid-cols-[0.8fr_1fr_1.25fr] lg:items-center">
          <div>
            <h2 className="font-bold text-slate-950">재생속도</h2>
            <p className="mt-1 text-sm font-bold text-slate-700">현재 00:56 / 03:24</p>
            <p className="field-help">YouTube IFrame API로 재생 중입니다.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["재생", "5초 뒤로", "5초 앞으로"].map((label, index) => (
              <span key={label} className={index === 0 ? "btn-primary text-center" : "btn-secondary text-center"}>{label}</span>
            ))}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">속도 조절</p>
              <p className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">0.75x</p>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-200">
              <div className="h-2 w-[42%] rounded-full bg-blue-600" />
            </div>
            <div className="mt-2 grid grid-cols-3 text-xs font-bold text-slate-500">
              <span>0.1x</span>
              <span className="text-center">1x</span>
              <span className="text-right">2x</span>
            </div>
          </div>
        </div>
      </section>

      <section data-guide-shot="loop-control" className="card p-4 lg:max-w-3xl lg:p-5">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">구간반복</p>
              <p className="field-help">{selected.name} 구간을 선택했습니다.</p>
            </div>
            <span className="btn-primary">반복 ON</span>
          </div>
        </div>
      </section>

      <section data-guide-shot="song-form-navigation" className="card p-5 lg:grid lg:grid-cols-[0.55fr_1.45fr] lg:gap-5">
        <div>
          <h2 className="font-bold text-slate-950">곡 구성 및 구간이동</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">구간을 누르면 저장된 시작 시간으로 이동합니다.</p>
        </div>
        <div className="mt-4 grid gap-3 lg:mt-0 lg:grid-cols-2">
          {demoSongs[0].sections.slice(0, 4).map((section) => (
            <div
              key={section.id}
              className={section.id === selected.id ? "rounded-xl border border-blue-200 bg-blue-50 p-4" : "rounded-xl border border-slate-200 bg-white p-4"}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-slate-950">{section.name}</p>
                <p className="text-sm font-semibold text-blue-700">{formatTime(section.startTime)} - {formatTime(section.endTime)}</p>
              </div>
              {section.memo ? <p className="mt-2 text-sm leading-6 text-slate-600">{section.memo}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section data-guide-shot="score-image" className="card p-5 lg:grid lg:grid-cols-[0.65fr_1fr] lg:items-start lg:gap-5">
        <div>
          <h2 className="font-bold text-slate-950">곡 이미지</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">외부에 저장된 이미지를 링크로 불러옵니다.</p>
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <div className="aspect-[4/5] rounded-md bg-[linear-gradient(#f8fafc_24px,#e2e8f0_25px)] bg-[length:100%_32px] p-4">
            <p className="text-lg font-black text-slate-900">주님 말씀하시면</p>
            <p className="mt-3 text-sm font-bold text-slate-700">G - D - Em - C</p>
            <p className="mt-2 text-sm font-bold text-slate-700">Verse · Chorus · Bridge</p>
          </div>
          <p className="mt-3 text-sm font-bold text-slate-800">코드 악보 이미지</p>
        </div>
      </section>
    </DemoPage>
  );
}

function PdfExportDemo() {
  return (
    <DemoPage>
      <section data-guide-shot="pdf-export" className="card overflow-hidden lg:grid lg:grid-cols-[0.85fr_1.15fr]">
        <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 lg:flex lg:flex-col lg:justify-between lg:p-7">
          <div>
          <p className="text-sm font-bold text-blue-700">콘티 PDF 미리보기</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">{demoSetlist.title}</h1>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="btn-primary">PDF로 저장/인쇄</span>
            <span className="btn-secondary">콘티로 돌아가기</span>
          </div>
        </div>
        <div className="grid gap-3 p-4 text-sm lg:grid-cols-2 lg:p-6">
          {["콘티 이름", "예배 날짜/이름", "이번 주 팀원", "곡 설명", "강조사항", "파트별 메모"].map((label) => (
            <label key={label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold text-slate-700">
              {label}
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">빼기</span>
            </label>
          ))}
        </div>
      </section>

      <section data-guide-shot="pdf-customize" className="card p-4 lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-5 lg:p-5">
        <div>
        <h2 className="font-black text-slate-950">악보 이미지</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">악보가 잘리지 않도록 출력 방식을 고를 수 있습니다.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
          {["비율 맞춰 줄이기", "위아래만 줄이기", "다음 장", "나눠서 넣기"].map((label, index) => (
            <span key={label} className={index === 1 ? "rounded-lg bg-blue-600 px-3 py-2 text-center text-white" : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-slate-700"}>
              {label}
            </span>
          ))}
        </div>
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <div className="h-72 rounded-md bg-[linear-gradient(#f8fafc_20px,#e2e8f0_21px)] bg-[length:100%_28px]" />
          <div className="mt-3 h-2 rounded-full bg-slate-200">
            <div className="h-2 w-[78%] rounded-full bg-blue-600" />
          </div>
          <p className="mt-2 text-xs font-bold text-slate-500">세로높이 80%</p>
        </div>
      </section>
    </DemoPage>
  );
}

function TeamDashboardDemo() {
  return (
    <DemoPage>
      <TeamNavTabs teamId={teamId} active="dashboard" />
      <section data-guide-shot="team-dashboard" className="space-y-4 lg:grid lg:grid-cols-[0.9fr_1.35fr_0.85fr] lg:items-start lg:gap-4 lg:space-y-0">
        <div className="card p-5">
          <p className="text-sm font-bold text-blue-700">은혜교회</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">주일 2부 찬양팀 대시보드</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">이번 주 예배 준비에 필요한 콘티, 공지, 일정, 채팅을 한곳에서 확인하세요.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <DashboardCard title="이번 주 콘티" value="6월 21일 주일예배 콘티" meta="3곡 · 주일 2부예배" action="콘티 보기" />
          <DashboardCard title="다가오는 일정" value="6월 21일 주일예배" meta="가능 6 · 어려움 1 · 미정 1" action="일정 보기" />
          <DashboardCard title="최근 공지사항" value="이번 주 주일예배 연습 안내" meta="읽지 않음" action="공지 보기" />
          <DashboardCard title="팀 채팅" value="새 메시지 2개" meta="정현우: 인트로 톤 공유드립니다." action="팀 채팅 열기" />
        </div>
        <div className="card p-4 lg:row-span-2">
          <h2 className="font-black text-slate-950">팀원 현황</h2>
          <div className="mt-3 space-y-2">
            <MemberRow name="김민수" part="찬양인도자" role="owner" />
            <MemberRow name="박지혜" part="싱어" role="admin" />
            <MemberRow name="정현우" part="일렉기타" role="member" />
          </div>
        </div>
      </section>

      <section data-guide-shot="team-invite" className="card p-5 lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:gap-5">
        <div>
        <h2 className="section-title">팀원 초대</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">초대코드는 팀을 찾기 위한 고유 코드입니다. 리더가 승인해야 팀원이 됩니다.</p>
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-black text-blue-700">초대코드</p>
          <p className="mt-1 text-3xl font-black tracking-wide text-slate-950">SL-7K92Q</p>
        </div>
        <div className="mt-4 flex gap-2">
          <span className="btn-primary flex-1 text-center">초대링크 복사</span>
          <span className="btn-secondary flex-1 text-center">코드 재발급</span>
        </div>
        </div>
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="font-black text-amber-900">새로운 팀 참여 요청이 있습니다.</p>
          <p className="mt-1 text-sm text-amber-800">이은혜 · 싱어</p>
          <div className="mt-3 flex gap-2">
            <span className="btn-primary px-4">승인</span>
            <span className="btn-secondary px-4">거절</span>
          </div>
        </div>
      </section>
    </DemoPage>
  );
}

function TeamCommunicationDemo() {
  return (
    <DemoPage>
      <TeamNavTabs teamId={teamId} active="chat" />
      <section data-guide-shot="team-chat" className="card grid h-[680px] grid-cols-1 overflow-hidden lg:h-[620px] lg:grid-cols-[300px_1fr]">
        <aside className="hidden border-r border-slate-100 bg-slate-50 p-4 lg:block">
          <h2 className="font-black text-slate-950">대화</h2>
          <div className="mt-4 space-y-2">
            {["팀 전체 채팅", "정현우 · 일렉기타", "최수진 · 건반"].map((label, index) => (
              <div key={label} className={index === 0 ? "rounded-xl bg-blue-600 p-3 text-sm font-black text-white" : "rounded-xl bg-white p-3 text-sm font-bold text-slate-700 shadow-sm"}>
                {label}
              </div>
            ))}
          </div>
        </aside>
        <div className="flex min-h-0 flex-col">
        <div className="border-b border-slate-100 p-4">
          <h1 className="text-xl font-black text-slate-950">팀 채팅</h1>
          <p className="mt-1 text-xs font-semibold text-emerald-700">온라인 4명 · 읽지 않은 메시지 2개</p>
        </div>
        <div className="flex-1 space-y-3 overflow-hidden bg-slate-50 p-4">
          <ChatBubble name="김민수" role="리더" message="오늘은 첫 곡을 조금 절제해서 시작하겠습니다." />
          <ChatBubble name="정현우" role="일렉기타" message="인트로 딜레이 톤은 리허설 때 맞춰볼게요." mine />
          <ChatBubble name="최수진" role="건반" message="브릿지는 패드로 공간을 넓혀보겠습니다." />
        </div>
        <div className="border-t border-slate-100 bg-white p-3">
          <div className="flex items-end gap-2">
            <div className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-400">메시지를 입력하세요</div>
            <span className="btn-primary">전송</span>
          </div>
        </div>
        </div>
      </section>

      <section data-guide-shot="team-notice" className="space-y-4">
        <TeamNavTabs teamId={teamId} active="posts" />
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-blue-700">고정 공지 · 연습 안내</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">이번 주 주일예배 연습 안내</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">토요일 오후 5시 본당에서 전체 리허설을 진행합니다.</p>
            </div>
            <span className="btn-secondary shrink-0">공지 작성</span>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
            읽음 5명 · 안 읽음 1명
          </div>
        </div>
      </section>
    </DemoPage>
  );
}

function TeamCalendarDemo() {
  const days = Array.from({ length: 35 }, (_, index) => index + 1);

  return (
    <DemoPage>
      <TeamNavTabs teamId={teamId} active="calendar" />
      <section data-guide-shot="team-calendar" className="card p-3 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-blue-700">팀 캘린더</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">6월</h1>
          </div>
          <span className="btn-primary">일정 만들기</span>
        </div>
        <div className="mt-4 grid grid-cols-7 border-y border-slate-200 py-2 text-center text-xs font-black text-slate-500">
          {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
            <span key={day} className={index === 0 ? "text-rose-600" : ""}>{day}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => (
            <div key={day} className="min-h-24 border-b border-slate-100 p-1">
              <p className={day % 7 === 1 ? "text-lg font-black text-rose-600" : "text-lg font-black text-slate-900"}>{day}</p>
              {day === 21 ? (
                <div className="mt-2 space-y-1 text-[10px] font-black">
                  <p className="truncate rounded bg-blue-100 px-1.5 py-1 text-blue-700">주일예배</p>
                  <p className="truncate rounded bg-emerald-100 px-1.5 py-1 text-emerald-700">가능 6</p>
                </div>
              ) : null}
              {day === 24 ? <p className="mt-2 truncate rounded bg-violet-100 px-1.5 py-1 text-[10px] font-black text-violet-700">수요연습</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section data-guide-shot="availability-check" className="card p-5 lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:gap-5">
        <div>
          <p className="text-sm font-bold text-blue-700">6월 21일</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">주일예배</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">가능 여부는 실제 섬김 배정이 아니라 리더가 콘티 팀원을 정할 때 참고하는 정보입니다.</p>
        </div>
        <div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <span className="rounded-xl bg-emerald-600 px-3 py-3 text-center text-sm font-black text-white">가능해요</span>
          <span className="rounded-xl border border-rose-200 bg-white px-3 py-3 text-center text-sm font-black text-rose-700">어려워요</span>
          <span className="rounded-xl border border-amber-200 bg-white px-3 py-3 text-center text-sm font-black text-amber-700">미정이에요</span>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500">오후 리허설 참석 가능합니다.</div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-black">
          <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">가능 6</span>
          <span className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">어려움 1</span>
          <span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">미정 1</span>
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-600">미응답 2</span>
        </div>
        </div>
      </section>
    </DemoPage>
  );
}

function PracticeToolsDemo() {
  return (
    <DemoPage>
      <section data-guide-shot="tuner" className="card p-5 lg:grid lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-5">
        <div>
        <p className="text-sm font-bold text-blue-700">튜너</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">악기 튜닝</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">기기 마이크를 악기 가까이에 두고 튜닝합니다.</p>
        <button type="button" className="btn-primary mt-4 hidden w-full lg:inline-flex">튜너 시작하기</button>
        </div>
        <div>
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-center">
          <p className="text-6xl font-black text-blue-700">G</p>
          <p className="mt-2 text-sm font-bold text-slate-600">196.00 Hz · -3 cents</p>
          <div className="mt-5 h-3 rounded-full bg-white">
            <div className="mx-auto h-3 w-2 rounded-full bg-blue-600" />
          </div>
        </div>
        <button type="button" className="btn-primary mt-4 w-full lg:hidden">튜너 시작하기</button>
        </div>
      </section>

      <section data-guide-shot="metronome" className="card p-5 lg:grid lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-5">
        <div>
        <p className="text-sm font-bold text-blue-700">메트로놈</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">BPM 72</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">합주 전 템포를 맞추고 탭 템포로 BPM을 잡습니다.</p>
        <button type="button" className="btn-primary mt-4 hidden w-full lg:inline-flex">시작</button>
        <button type="button" className="btn-secondary mt-2 hidden w-full lg:inline-flex">탭으로 BPM 맞추기</button>
        </div>
        <div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((beat) => (
            <span
              key={beat}
              className={beat === 1 ? "flex aspect-square items-center justify-center rounded-full bg-blue-600 text-xl font-black text-white" : "flex aspect-square items-center justify-center rounded-full bg-slate-100 text-xl font-black text-slate-500"}
            >
              {beat}
            </span>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-5 gap-2">
          {["-5", "-1", "72", "+1", "+5"].map((label, index) => (
            <span key={label} className={index === 2 ? "rounded-xl bg-slate-900 px-3 py-3 text-center font-black text-white" : "rounded-xl border border-slate-200 bg-white px-3 py-3 text-center font-black text-slate-700"}>
              {label}
            </span>
          ))}
        </div>
        <button type="button" className="btn-primary mt-4 w-full lg:hidden">시작</button>
        <button type="button" className="btn-secondary mt-2 w-full lg:hidden">탭으로 BPM 맞추기</button>
        </div>
      </section>
    </DemoPage>
  );
}

function Field({ label, value, action }: { label: string; value: string; action?: string }) {
  return (
    <label className="block space-y-1">
      <span className="field-label">{label}</span>
      <div className={action ? "grid grid-cols-[1fr_auto] gap-2" : ""}>
        <div className="field-input min-h-11 truncate bg-white text-slate-800">{value}</div>
        {action ? <span className="btn-secondary min-h-11 px-4">{action}</span> : null}
      </div>
    </label>
  );
}

function DashboardCard({ title, value, meta, action }: { title: string; value: string; meta: string; action: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-blue-700">{title}</p>
      <p className="mt-2 font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{meta}</p>
      <p className="mt-3 text-sm font-black text-blue-700">{action}</p>
    </article>
  );
}

function ChatBubble({ name, role, message, mine = false }: { name: string; role: string; message: string; mine?: boolean }) {
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div className={mine ? "max-w-[82%] rounded-2xl bg-blue-600 px-4 py-3 text-white" : "max-w-[82%] rounded-2xl bg-white px-4 py-3 text-slate-800 shadow-sm"}>
        <p className={mine ? "text-xs font-black text-blue-100" : "text-xs font-black text-blue-700"}>{name} · {role}</p>
        <p className="mt-1 text-sm leading-6">{message}</p>
        <p className={mine ? "mt-1 text-right text-[11px] font-bold text-blue-100" : "mt-1 text-[11px] font-bold text-slate-400"}>읽음 4 · 오후 8:42</p>
      </div>
    </div>
  );
}

function MemberRow({ name, part, role }: { name: string; part: string; role: "owner" | "admin" | "member" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div>
        <p className="font-black text-slate-950">{name}</p>
        <p className="text-xs font-bold text-slate-500">{part}</p>
      </div>
      <TeamRoleBadge role={role} />
    </div>
  );
}

function formatTime(seconds?: number) {
  if (typeof seconds !== "number") return "--:--";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
