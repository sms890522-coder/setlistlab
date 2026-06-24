"use client";

import Link from "next/link";
import { GuideTrackPreviewPlayer } from "@/components/GuideTrackPreviewPlayer";
import { audioBufferToWav, downloadBlob } from "@/lib/audio/exportWav";
import { renderGuideTrackToAudioBuffer } from "@/lib/audio/renderGuideTrack";
import { getCurrentUser } from "@/lib/auth";
import {
  getFirstGuideTrackForSong,
  normalizeGuideTrackData,
  saveGuideTrack,
  type ExtractedChord,
  type GuideTrackData,
  type GuideTrackSection,
  type TeamGuideTrack,
} from "@/lib/db/teamGuideTracks";
import { getMyProfile, type Profile } from "@/lib/db/profiles";
import { getCloudSetlist, type CloudSetlist } from "@/lib/db/setlists";
import { getMyRoleInTeam } from "@/lib/db/teamMemberships";
import { canUseFeature } from "@/lib/features";
import { getFirstImageLink, getImagePreviewUrl } from "@/lib/images";
import { parseChordLine } from "@/lib/music/chords";
import { canManageTeamSetlist } from "@/lib/permissions/teamPermissions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Song } from "@/lib/types";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type SectionDraft = {
  sectionId: string;
  label: string;
  chordText: string;
  bars: number;
  repeat: number;
  memo: string;
};

export default function SongGuideTrackPage() {
  const params = useParams<{ id: string; songId: string }>();
  const [loaded, setLoaded] = useState(false);
  const [setlist, setSetlist] = useState<CloudSetlist | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [track, setTrack] = useState<TeamGuideTrack | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractedChords, setExtractedChords] = useState<ExtractedChord[]>([]);
  const [manualChord, setManualChord] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>([]);
  const [bpm, setBpm] = useState(72);
  const [key, setKey] = useState("");
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [sound, setSound] = useState<GuideTrackData["sound"]>("piano_pad");
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [metronomeAccent, setMetronomeAccent] = useState(true);
  const [metronomeVolume, setMetronomeVolume] = useState(0.7);
  const [countInEnabled, setCountInEnabled] = useState(true);
  const [countInBars, setCountInBars] = useState(1);
  const [countInClick, setCountInClick] = useState(true);
  const [countInVoice, setCountInVoice] = useState(true);
  const [voiceCueEnabled, setVoiceCueEnabled] = useState(true);
  const [voiceLanguage, setVoiceLanguage] = useState<"en" | "ko">("en");
  const [announceBeforeBeats, setAnnounceBeforeBeats] = useState<1 | 4>(1);
  const [voiceVolume, setVoiceVolume] = useState(0.9);
  const [downloading, setDownloading] = useState(false);

  const sourceImage = getFirstImageLink(song?.imageLinks);
  const canUseGuideTrack = canUseFeature(profile, "teamGuideTrack");
  const hasScoreImage = Boolean(sourceImage?.url);
  const hasSongForm = Boolean(song?.sections?.length);
  const guideData = useMemo(
    () =>
      buildGuideTrackData({
        bpm,
        key,
        timeSignature,
        sound,
        metronomeEnabled,
        metronomeAccent,
        metronomeVolume,
        countInEnabled,
        countInBars,
        countInClick,
        countInVoice,
        voiceCueEnabled,
        voiceLanguage,
        announceBeforeBeats,
        voiceVolume,
        sections,
      }),
    [
      bpm,
      key,
      timeSignature,
      sound,
      metronomeEnabled,
      metronomeAccent,
      metronomeVolume,
      countInEnabled,
      countInBars,
      countInClick,
      countInVoice,
      voiceCueEnabled,
      voiceLanguage,
      announceBeforeBeats,
      voiceVolume,
      sections,
    ],
  );

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setError("가이드 트랙은 로그인 저장소가 설정된 콘티에서 사용할 수 있습니다.");
        setLoaded(true);
        return;
      }

      const user = await getCurrentUser();
      if (!user) {
        setError("로그인이 필요합니다.");
        setLoaded(true);
        return;
      }

      const [nextProfile, nextSetlist] = await Promise.all([getMyProfile(), getCloudSetlist(params.id)]);
      if (!nextSetlist) {
        setError("콘티를 찾을 수 없습니다.");
        setLoaded(true);
        return;
      }

      const nextSong = nextSetlist.songs.find((item) => item.id === params.songId) ?? null;
      if (!nextSong) {
        setError("곡을 찾을 수 없습니다.");
        setLoaded(true);
        return;
      }

      const nextMembership = nextSetlist.teamId ? await getMyRoleInTeam(nextSetlist.teamId) : null;
      const nextCanManage = Boolean(nextSetlist.ownerId === user.id || canManageTeamSetlist(nextMembership));
      const nextTrack = await getFirstGuideTrackForSong(nextSetlist.id, nextSong.id).catch(() => null);

      setProfile(nextProfile);
      setSetlist(nextSetlist);
      setSong(nextSong);
      setCanManage(nextCanManage);
      setTrack(nextTrack);
      setExtractedChords(nextTrack?.extractedChords ?? []);
      setSections(createSectionDrafts(nextSong, nextTrack));
      const normalizedGuideData = normalizeGuideTrackData(nextTrack?.guideTrackData);
      setBpm(normalizedGuideData.bpm ?? nextSong.bpm ?? 72);
      setKey(normalizedGuideData.key ?? nextSong.practiceKey ?? nextSong.originalKey ?? "");
      setTimeSignature(normalizedGuideData.timeSignature);
      setSound(normalizedGuideData.sound);
      setMetronomeEnabled(normalizedGuideData.metronome.enabled);
      setMetronomeAccent(normalizedGuideData.metronome.accentFirstBeat);
      setMetronomeVolume(normalizedGuideData.metronome.volume);
      setCountInEnabled(normalizedGuideData.countIn.enabled);
      setCountInBars(normalizedGuideData.countIn.bars);
      setCountInClick(normalizedGuideData.countIn.click);
      setCountInVoice(normalizedGuideData.countIn.voice);
      setVoiceCueEnabled(normalizedGuideData.voiceCue.enabled);
      setVoiceLanguage(normalizedGuideData.voiceCue.language);
      setAnnounceBeforeBeats(normalizedGuideData.voiceCue.announceBeforeBeats);
      setVoiceVolume(normalizedGuideData.voiceCue.volume);
      setLoaded(true);
    }

    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "가이드 트랙 화면을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.id, params.songId]);

  async function handleExtractChords() {
    if (!sourceImage?.url || !song) return;
    setExtracting(true);
    setError("");
    setMessage("");
    setWarnings([]);

    try {
      const response = await fetch("/api/guide-track/extract-chords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: sourceImage.url, songTitle: song.title, key }),
      });
      const data = (await response.json()) as {
        chords?: ExtractedChord[];
        manualMode?: boolean;
        warnings?: string[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "코드 추출에 실패했습니다.");
      }

      const nextChords = dedupeChords(data.chords ?? []);
      setExtractedChords(nextChords);
      setWarnings(data.warnings ?? []);
      if (nextChords.length > 0) {
        setSections((current) => distributeChordsToSections(current, nextChords));
      }
      setMessage(data.manualMode ? "자동 추출 설정이 없어 수동 입력 모드로 진행합니다." : "코드 추출 결과를 불러왔습니다.");
    } catch (extractError) {
      setWarnings(["자동 추출에 실패했습니다. 송폼별 코드를 직접 입력해 주세요."]);
      setError(extractError instanceof Error ? extractError.message : "코드 추출에 실패했습니다.");
    } finally {
      setExtracting(false);
    }
  }

  function addManualChord() {
    const chords = parseChordLine(manualChord).map((chord) => ({ chord, rawText: chord, confidence: 1, source: "manual" as const }));
    if (chords.length === 0) return;
    setExtractedChords((current) => dedupeChords([...current, ...chords]));
    setManualChord("");
  }

  function removeChord(chord: string) {
    setExtractedChords((current) => current.filter((item) => item.chord !== chord));
  }

  function updateSection(index: number, patch: Partial<SectionDraft>) {
    setSections((current) => current.map((section, sectionIndex) => (sectionIndex === index ? { ...section, ...patch } : section)));
  }

  function applyExtractedChords() {
    setSections((current) => distributeChordsToSections(current, extractedChords));
  }

  async function handleSaveGuideTrack() {
    if (!setlist || !song || !sourceImage?.url) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const songFormMap = sections.map(sectionDraftToGuideSection);
      const saved = await saveGuideTrack({
        id: track?.id,
        teamId: setlist.teamId,
        setlistId: setlist.id,
        songId: song.id,
        title: `${song.title || "곡"} 가이드 트랙`,
        status: "ready",
        sourceScoreImageUrl: sourceImage.url,
        extractionStatus: extractedChords.length > 0 ? "extracted" : "manual",
        extractedChords,
        songFormMap,
        guideTrackData: {
          ...guideData,
          sections: songFormMap,
          totalBars: calculateTotalBars(songFormMap),
        },
      });
      setTrack(saved);
      setMessage("가이드 트랙이 생성되었습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "가이드 트랙을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadWav() {
    const data = track?.guideTrackData ?? guideData;
    setDownloading(true);
    setError("");
    setMessage("");

    try {
      const buffer = await renderGuideTrackToAudioBuffer(data);
      const wav = audioBufferToWav(buffer);
      const blob = new Blob([wav], { type: "audio/wav" });
      downloadBlob(blob, createGuideTrackFilename(song?.title || "guide-track", "wav"));
      setMessage("가이드 트랙 WAV 파일을 내려받았습니다. 브라우저 음성 안내는 다운로드 파일에 포함되지 않을 수 있습니다.");
    } catch (downloadError) {
      handleDownloadJson();
      setMessage("WAV 다운로드가 어려워 가이드 트랙 데이터 JSON을 내려받았습니다.");
      setError(downloadError instanceof Error ? downloadError.message : "WAV 다운로드에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  }

  function handleDownloadJson() {
    const data = track?.guideTrackData ?? guideData;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, createGuideTrackFilename(song?.title || "guide-track", "json"));
  }

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-sm text-slate-500">가이드 트랙 화면을 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!setlist || !song) {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">가이드 트랙을 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-rose-700">{error || "콘티 또는 곡 정보를 찾을 수 없습니다."}</p>
          <Link href="/setlists" className="btn-primary mt-5">콘티 목록으로</Link>
        </section>
      </div>
    );
  }

  if (!canUseGuideTrack) {
    return (
      <div className="page-shell">
        <section className="card p-8">
          <p className="text-sm font-black text-violet-700">실험실 기능</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">팀 가이드 트랙 만들기</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            이 기능은 현재 실험실 기능입니다. 내 계정에서 실험실 기능을 켜면 사용할 수 있습니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/account" className="btn-primary">실험실 켜기</Link>
            <Link href={`/setlists/${setlist.id}/songs/${song.id}`} className="btn-secondary">곡으로 돌아가기</Link>
          </div>
        </section>
      </div>
    );
  }

  const canSave = canManage && hasScoreImage && hasSongForm;

  return (
    <div className="page-shell space-y-6 pb-20">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-violet-50 via-white to-blue-50 p-5 sm:p-7">
          <Link href={`/setlists/${setlist.id}/songs/${song.id}`} className="text-sm font-bold text-blue-700">
            {song.title}로 돌아가기
          </Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">팀 가이드 트랙 만들기</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            악보 이미지와 송폼을 바탕으로 코드 진행을 정리하고, 팀 연습용 기준 트랙 데이터를 생성합니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-black text-white">실험실</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">
              {track ? "저장된 가이드 트랙 있음" : "새 가이드 트랙"}
            </span>
          </div>
        </div>
      </section>

      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {warnings.map((warning) => (
        <p key={warning} className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{warning}</p>
      ))}

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <StepCard step="1" title="준비 확인">
            <p className="text-sm leading-7 text-slate-600">
              코드 추출 결과는 정확하지 않을 수 있으니 반드시 직접 확인하고 수정해 주세요.
            </p>
            <div className="mt-4 space-y-2 text-sm font-semibold text-slate-700">
              <p>곡: {song.title}</p>
              <p>키: {key || "-"} · BPM: {bpm || "-"}</p>
              <p>송폼: {song.sections.map((section) => section.name).join(" - ") || "없음"}</p>
            </div>
            {!hasScoreImage ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">악보 이미지가 필요합니다.</p> : null}
            {!hasSongForm ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">송폼을 먼저 입력해 주세요.</p> : null}
            {sourceImage ? (
              <a href={sourceImage.url} target="_blank" rel="noopener noreferrer" className="mt-4 block overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <img src={getImagePreviewUrl(sourceImage.url)} alt={sourceImage.label || "악보 이미지"} className="h-auto w-full" />
              </a>
            ) : null}
            <p className="mt-4 text-xs leading-5 text-slate-500">
              저작권이 있는 악보 이미지는 권리자의 허락 범위 안에서만 사용해 주세요. 외부 코드 추출 API를 연결하면 이미지 URL이 해당 API로 전송될 수 있습니다.
            </p>
          </StepCard>

          <StepCard step="2" title="이미지에서 코드 추출">
            <p className="text-sm leading-7 text-slate-600">
              악보 이미지에서 코드를 찾습니다. 자동 추출 API가 설정되어 있지 않으면 수동 입력 모드로 진행합니다.
            </p>
            <button type="button" onClick={handleExtractChords} disabled={!hasScoreImage || extracting} className="btn-primary mt-4 w-full">
              {extracting ? "추출 중입니다..." : "코드 추출 시작"}
            </button>
          </StepCard>

          <StepCard step="3" title="추출된 코드 확인">
            <div className="flex gap-2">
              <input
                value={manualChord}
                onChange={(event) => setManualChord(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addManualChord();
                  }
                }}
                className="field-input"
                placeholder="예: G D/F# Em7 C"
              />
              <button type="button" onClick={addManualChord} className="btn-secondary shrink-0">코드 추가</button>
            </div>
            {extractedChords.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                아직 코드가 없습니다. 자동 추출을 시도하거나 직접 입력해 주세요.
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {extractedChords.map((item) => (
                  <button
                    key={item.chord}
                    type="button"
                    onClick={() => removeChord(item.chord)}
                    className={item.confidence !== undefined && item.confidence < 0.75 ? "rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 ring-1 ring-amber-100" : "rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 ring-1 ring-blue-100"}
                    title="눌러서 삭제"
                  >
                    {item.chord}
                    {item.confidence !== undefined && item.confidence < 0.75 ? " · 확인 필요" : ""}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={applyExtractedChords} disabled={extractedChords.length === 0} className="btn-secondary mt-4 w-full">
              추출 코드를 송폼에 자동 배치
            </button>
          </StepCard>
        </div>

        <div className="space-y-4">
          <StepCard step="4" title="송폼별 코드 배치">
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div key={section.sectionId} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-black text-slate-950">{section.label}</p>
                    <div className="grid grid-cols-2 gap-2 sm:w-44">
                      <label className="space-y-1">
                        <span className="text-[11px] font-black text-slate-500">마디</span>
                        <input type="number" min={1} value={section.bars} onChange={(event) => updateSection(index, { bars: clampPositiveNumber(event.target.value, 4) })} className="field-input h-10" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black text-slate-500">반복</span>
                        <input type="number" min={1} value={section.repeat} onChange={(event) => updateSection(index, { repeat: clampPositiveNumber(event.target.value, 1) })} className="field-input h-10" />
                      </label>
                    </div>
                  </div>
                  <label className="mt-3 block space-y-1">
                    <span className="field-label">코드 진행</span>
                    <input value={section.chordText} onChange={(event) => updateSection(index, { chordText: event.target.value })} className="field-input" placeholder="G D/F# Em7 C" />
                  </label>
                  <label className="mt-3 block space-y-1">
                    <span className="field-label">메모</span>
                    <input value={section.memo} onChange={(event) => updateSection(index, { memo: event.target.value })} className="field-input" placeholder="후렴 2번 반복 등" />
                  </label>
                </div>
              ))}
            </div>
          </StepCard>

          <StepCard step="5" title="가이드 트랙 설정">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="field-label">BPM</span>
                <input type="number" min={40} max={240} value={bpm} onChange={(event) => setBpm(clampNumber(event.target.value, 72, 40, 240))} className="field-input" />
              </label>
              <label className="space-y-1">
                <span className="field-label">Key</span>
                <input value={key} onChange={(event) => setKey(event.target.value)} className="field-input" placeholder="G" />
              </label>
              <label className="space-y-1">
                <span className="field-label">박자</span>
                <select value={timeSignature} onChange={(event) => setTimeSignature(event.target.value)} className="field-input">
                  <option value="4/4">4/4</option>
                  <option value="3/4">3/4</option>
                  <option value="6/8">6/8</option>
                  <option value="2/4">2/4</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="field-label">사운드</span>
                <select value={sound} onChange={(event) => setSound(event.target.value as GuideTrackData["sound"])} className="field-input">
                  <option value="piano">Piano</option>
                  <option value="pad">Pad</option>
                  <option value="piano_pad">Piano + Pad</option>
                  <option value="click_only">Click only</option>
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <h3 className="font-black text-slate-950">연습용 안내 설정</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                메트로놈, 카운트인, 음성 안내를 함께 저장해 팀 녹음실 기준 트랙으로 재사용할 수 있게 합니다.
              </p>

              <div className="mt-4 grid gap-3">
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <input type="checkbox" checked={metronomeEnabled} onChange={(event) => setMetronomeEnabled(event.target.checked)} className="mt-1 size-4 accent-blue-600" />
                  <span>
                    <span className="block text-sm font-black text-slate-950">메트로놈 포함</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">가이드 트랙 재생 중 박자를 들을 수 있도록 클릭음을 함께 재생합니다.</span>
                  </span>
                </label>

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={metronomeAccent} onChange={(event) => setMetronomeAccent(event.target.checked)} className="size-4 accent-blue-600" />
                    <span className="text-sm font-bold text-slate-800">첫 박 강세</span>
                  </label>
                  <label className="space-y-1">
                    <span className="field-label">메트로놈 볼륨 {Math.round(metronomeVolume * 100)}%</span>
                    <input type="range" min={0} max={1} step={0.05} value={metronomeVolume} onChange={(event) => setMetronomeVolume(Number(event.target.value))} className="w-full accent-blue-600" />
                  </label>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <input type="checkbox" checked={countInEnabled} onChange={(event) => setCountInEnabled(event.target.checked)} className="mt-1 size-4 accent-blue-600" />
                  <span>
                    <span className="block text-sm font-black text-slate-950">시작 전 카운트인</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">곡 시작 전에 박자를 세어 팀원들이 함께 들어갈 수 있게 합니다.</span>
                  </span>
                </label>

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="field-label">카운트인 길이</span>
                    <select value={countInBars} onChange={(event) => setCountInBars(Number(event.target.value))} className="field-input">
                      <option value={1}>1마디</option>
                      <option value={2}>2마디</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={countInClick} onChange={(event) => setCountInClick(event.target.checked)} className="size-4 accent-blue-600" />
                    <span className="text-sm font-bold text-slate-800">카운트인 클릭 포함</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={countInVoice} onChange={(event) => setCountInVoice(event.target.checked)} className="size-4 accent-blue-600" />
                    <span className="text-sm font-bold text-slate-800">음성 카운트 포함</span>
                  </label>
                  <label className="space-y-1">
                    <span className="field-label">음성 언어</span>
                    <select value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value === "ko" ? "ko" : "en")} className="field-input">
                      <option value="en">English · one, two, three, four</option>
                      <option value="ko">Korean · 하나, 둘, 셋, 넷</option>
                    </select>
                  </label>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <input type="checkbox" checked={voiceCueEnabled} onChange={(event) => setVoiceCueEnabled(event.target.checked)} className="mt-1 size-4 accent-blue-600" />
                  <span>
                    <span className="block text-sm font-black text-slate-950">송폼 구간 음성 안내</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">각 송폼 구간이 시작되기 전에 Intro, Verse, Chorus 같은 구간명을 음성으로 알려줍니다.</span>
                  </span>
                </label>

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="field-label">구간 시작 직전 안내</span>
                    <select value={announceBeforeBeats} onChange={(event) => setAnnounceBeforeBeats(Number(event.target.value) === 4 ? 4 : 1)} className="field-input">
                      <option value={1}>1박 전</option>
                      <option value={4}>1마디 전</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="field-label">음성 안내 볼륨 {Math.round(voiceVolume * 100)}%</span>
                    <input type="range" min={0} max={1} step={0.05} value={voiceVolume} onChange={(event) => setVoiceVolume(Number(event.target.value))} className="w-full accent-blue-600" />
                  </label>
                </div>
              </div>
            </div>
          </StepCard>

          <StepCard step="6" title="가이드 트랙 만들기">
            {!canManage ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                생성과 수정은 리더/부리더 또는 콘티 작성자만 할 수 있습니다. 팀원은 생성된 가이드 트랙을 조회하고 재생할 수 있습니다.
              </p>
            ) : null}
            <button type="button" onClick={handleSaveGuideTrack} disabled={!canSave || saving} className="btn-primary mt-4 w-full">
              {saving ? "저장 중..." : "가이드 트랙 만들기"}
            </button>
            <div className="mt-4">
              <GuideTrackPreviewPlayer data={track?.guideTrackData ?? guideData} />
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="font-black text-slate-950">다운로드</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                생성한 가이드 트랙을 파일로 내려받아 연습이나 팀 녹음실 준비에 사용할 수 있습니다. 현재 다운로드 파일에는 브라우저 음성 안내가 포함되지 않을 수 있습니다.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={handleDownloadWav} disabled={downloading} className="btn-primary">
                  {downloading ? "다운로드 준비 중..." : "가이드 트랙 다운로드"}
                </button>
                <button type="button" onClick={handleDownloadJson} className="btn-secondary">
                  가이드 트랙 데이터 다운로드
                </button>
              </div>
            </div>
          </StepCard>
        </div>
      </section>
    </div>
  );
}

function StepCard({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">{step}</span>
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function createSectionDrafts(song: Song, track: TeamGuideTrack | null): SectionDraft[] {
  if (track?.songFormMap.length) {
    return track.songFormMap.map((section) => ({
      sectionId: section.sectionId,
      label: section.label,
      chordText: section.chords.join(" "),
      bars: section.bars,
      repeat: section.repeat,
      memo: section.memo ?? "",
    }));
  }

  return song.sections.map((section) => ({
    sectionId: section.id,
    label: section.name,
    chordText: "",
    bars: 4,
    repeat: 1,
    memo: section.memo ?? "",
  }));
}

function sectionDraftToGuideSection(section: SectionDraft): GuideTrackSection {
  return {
    sectionId: section.sectionId,
    label: section.label,
    chords: parseChordLine(section.chordText),
    bars: Math.max(1, section.bars),
    repeat: Math.max(1, section.repeat),
    memo: section.memo.trim(),
  };
}

function buildGuideTrackData(input: {
  bpm: number;
  key: string;
  timeSignature: string;
  sound: GuideTrackData["sound"];
  metronomeEnabled: boolean;
  metronomeAccent: boolean;
  metronomeVolume: number;
  countInEnabled: boolean;
  countInBars: number;
  countInClick: boolean;
  countInVoice: boolean;
  voiceCueEnabled: boolean;
  voiceLanguage: "en" | "ko";
  announceBeforeBeats: 1 | 4;
  voiceVolume: number;
  sections: SectionDraft[];
}): GuideTrackData {
  const sections = input.sections.map(sectionDraftToGuideSection);
  return {
    bpm: input.bpm,
    key: input.key,
    timeSignature: input.timeSignature,
    sound: input.sound,
    metronome: {
      enabled: input.metronomeEnabled,
      sound: "click",
      accentFirstBeat: input.metronomeAccent,
      volume: input.metronomeVolume,
    },
    countIn: {
      enabled: input.countInEnabled,
      bars: input.countInBars,
      voice: input.countInVoice,
      click: input.countInClick,
    },
    voiceCue: {
      enabled: input.voiceCueEnabled,
      language: input.voiceLanguage,
      announceSections: true,
      announceBeforeBeats: input.announceBeforeBeats,
      volume: input.voiceVolume,
    },
    download: {
      format: "wav",
      lastExportedAt: null,
    },
    sections,
    totalBars: calculateTotalBars(sections),
  };
}

function calculateTotalBars(sections: GuideTrackSection[]) {
  return sections.reduce((sum, section) => sum + Math.max(1, section.bars) * Math.max(1, section.repeat), 0);
}

function distributeChordsToSections(sections: SectionDraft[], chords: ExtractedChord[]) {
  if (chords.length === 0 || sections.length === 0) return sections;
  const chordNames = chords.map((item) => item.chord);
  const chunkSize = Math.max(1, Math.ceil(chordNames.length / sections.length));
  return sections.map((section, index) => {
    if (section.chordText.trim()) return section;
    const chunk = chordNames.slice(index * chunkSize, index * chunkSize + chunkSize);
    return { ...section, chordText: chunk.length > 0 ? chunk.join(" ") : chordNames.slice(0, 4).join(" ") };
  });
}

function dedupeChords(chords: ExtractedChord[]) {
  const map = new Map<string, ExtractedChord>();
  chords.forEach((item) => {
    if (item.chord) map.set(item.chord, item);
  });
  return Array.from(map.values());
}

function clampNumber(value: string, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function clampPositiveNumber(value: string, fallback: number) {
  return clampNumber(value, fallback, 1, 64);
}

function createGuideTrackFilename(title: string, extension: "wav" | "json") {
  const safeTitle = title
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 48);
  const date = new Date().toISOString().slice(0, 10);
  return `setlistlab-guide-track-${safeTitle || "track"}-${date}.${extension}`;
}
