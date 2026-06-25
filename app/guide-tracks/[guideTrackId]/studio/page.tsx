"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudioTimeline } from "@/components/recording/StudioTimeline";
import { StudioTransportBar } from "@/components/recording/StudioTransportBar";
import { WaveformCanvas } from "@/components/recording/WaveformCanvas";
import { useMultitrackPlayer, type TrackMixState } from "@/hooks/useMultitrackPlayer";
import { audioBufferToWav } from "@/lib/audio/exportWav";
import { renderGuideTrackToAudioBuffer } from "@/lib/audio/renderGuideTrack";
import { createSyntheticGuidePeaks, getAudioPeaksFromUrl } from "@/lib/audio/waveform";
import { getCurrentUser } from "@/lib/auth";
import { getMyProfile, type Profile } from "@/lib/db/profiles";
import { getCloudSetlist, type CloudSetlist } from "@/lib/db/setlists";
import { getMyRoleInTeam } from "@/lib/db/teamMemberships";
import {
  createRecordingSession,
  getRecordingSessionForGuideTrack,
  getRecordingTracks,
  markRecordingTrackDeleted,
  type TeamRecordingSession,
  type TeamRecordingTrack,
} from "@/lib/db/teamRecordingStudio";
import { getGuideTrack, normalizeGuideTrackData, type TeamGuideTrack } from "@/lib/db/teamGuideTracks";
import { canUseFeature } from "@/lib/features";
import { canManageTeamSetlist } from "@/lib/permissions/teamPermissions";
import { getRecordingReadUrl, uploadRecordingTrack } from "@/lib/recording/uploadRecordingTrack";
import {
  getGuideTrackDurationSeconds,
  getStudioCurrentPosition,
} from "@/lib/recording/studioTimeline";
import { useAudioRecorder } from "@/lib/recording/useAudioRecorder";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Song } from "@/lib/types";

const GUIDE_TRACK_ID = "guide-track";
const PART_OPTIONS = ["보컬", "싱어", "일렉", "어쿠스틱", "건반", "베이스", "드럼", "기타", "직접 입력"];

export default function GuideTrackStudioPage() {
  const params = useParams<{ guideTrackId: string }>();
  const recorder = useAudioRecorder();
  const recordingPanelRef = useRef<HTMLElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [guideTrack, setGuideTrack] = useState<TeamGuideTrack | null>(null);
  const [setlist, setSetlist] = useState<CloudSetlist | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [session, setSession] = useState<TeamRecordingSession | null>(null);
  const [tracks, setTracks] = useState<TeamRecordingTrack[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [myUserId, setMyUserId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [part, setPart] = useState("보컬");
  const [customPart, setCustomPart] = useState("");
  const [trackTitle, setTrackTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [readUrls, setReadUrls] = useState<Record<string, string>>({});
  const [guideAudioUrl, setGuideAudioUrl] = useState("");
  const [guideAudioDuration, setGuideAudioDuration] = useState(0);
  const [guideRenderError, setGuideRenderError] = useState("");

  const guideData = useMemo(() => normalizeGuideTrackData(guideTrack?.guideTrackData), [guideTrack?.guideTrackData]);
  const fallbackGuideDuration = useMemo(() => getGuideTrackDurationSeconds(guideData), [guideData]);
  const guidePeaks = useMemo(() => createSyntheticGuidePeaks(360), []);
  const canUseRecordingStudio = canUseFeature(profile, "teamRecordingStudio");
  const selectedPart = part === "직접 입력" ? customPart.trim() || "기타" : part;
  const fallbackTrackTitle = `${selectedPart} 녹음`;
  const orderedTracks = useMemo(() => orderTracks(tracks, myUserId), [myUserId, tracks]);
  const studioDuration = Math.max(guideAudioDuration, fallbackGuideDuration, ...tracks.map((track) => track.durationSeconds ?? 0), 1);

  const ensureReadUrl = useCallback(
    async (trackId: string) => {
      if (trackId === GUIDE_TRACK_ID) {
        if (!guideAudioUrl) throw new Error("가이드 트랙 오디오를 준비하는 중입니다.");
        return guideAudioUrl;
      }

      if (readUrls[trackId]) return readUrls[trackId];
      const { readUrl } = await getRecordingReadUrl(trackId);
      setReadUrls((current) => ({ ...current, [trackId]: readUrl }));
      return readUrl;
    },
    [guideAudioUrl, readUrls],
  );

  const playerSources = useMemo(
    () => [
      ...(guideAudioUrl
        ? [
            {
              id: GUIDE_TRACK_ID,
              url: guideAudioUrl,
              duration: guideAudioDuration || fallbackGuideDuration,
              defaultVolume: 0.8,
            },
          ]
        : []),
      ...orderedTracks.map((track) => ({
        id: track.id,
        url: readUrls[track.id],
        duration: track.durationSeconds,
        defaultVolume: 1,
        offsetMs: track.recordingOffsetMs,
      })),
    ],
    [fallbackGuideDuration, guideAudioDuration, guideAudioUrl, orderedTracks, readUrls],
  );

  const player = useMultitrackPlayer({
    sources: playerSources,
    resolveSourceUrl: ensureReadUrl,
    fallbackDuration: studioDuration,
  });
  const currentPosition = useMemo(() => getStudioCurrentPosition(guideData, player.currentTime), [guideData, player.currentTime]);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setError("팀 녹음실은 로그인 저장소가 설정된 콘티에서 사용할 수 있습니다.");
        setLoaded(true);
        return;
      }

      const user = await getCurrentUser();
      if (!user) {
        setError("로그인이 필요합니다.");
        setLoaded(true);
        return;
      }

      const [nextProfile, nextGuideTrack] = await Promise.all([getMyProfile().catch(() => null), getGuideTrack(params.guideTrackId)]);
      if (!nextGuideTrack) {
        setError("가이드 트랙을 찾을 수 없습니다.");
        setLoaded(true);
        return;
      }

      const nextSetlist = await getCloudSetlist(nextGuideTrack.setlistId);
      if (!nextSetlist) {
        setError("콘티를 찾을 수 없습니다.");
        setLoaded(true);
        return;
      }

      const nextSong = nextSetlist.songs.find((item) => item.id === nextGuideTrack.songId) ?? null;
      if (!nextSong) {
        setError("곡 정보를 찾을 수 없습니다.");
        setLoaded(true);
        return;
      }

      const membership = nextSetlist.teamId ? await getMyRoleInTeam(nextSetlist.teamId) : null;
      const nextCanManage = Boolean(nextSetlist.ownerId === user.id || canManageTeamSetlist(membership) || nextGuideTrack.createdBy === user.id);

      setProfile(nextProfile);
      setGuideTrack(nextGuideTrack);
      setSetlist(nextSetlist);
      setSong(nextSong);
      setCanManage(nextCanManage);
      setMyUserId(user.id);
      setTrackTitle(`${nextSong.title} ${selectedPart} 녹음`);

      if (!canUseFeature(nextProfile, "teamRecordingStudio")) {
        setLoaded(true);
        return;
      }

      let nextSession = await getRecordingSessionForGuideTrack(nextGuideTrack.id);
      if (!nextSession && nextCanManage) {
        nextSession = await createRecordingSession({
          teamId: nextGuideTrack.teamId,
          setlistId: nextGuideTrack.setlistId,
          songId: nextGuideTrack.songId,
          guideTrackId: nextGuideTrack.id,
          title: `${nextSong.title || "곡"} 팀 녹음실`,
        });
      }

      setSession(nextSession);
      if (nextSession) {
        setTracks(await getRecordingTracks(nextSession.id));
      }

      setLoaded(true);
    }

    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "팀 녹음실을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.guideTrackId]);

  useEffect(() => {
    if (!guideTrack) return;
    let cancelled = false;
    let objectUrl = "";

    async function renderGuideAudio() {
      setGuideRenderError("");
      try {
        const buffer = await renderGuideTrackToAudioBuffer(guideData);
        if (cancelled) return;
        const wav = audioBufferToWav(buffer);
        const blob = new Blob([wav], { type: "audio/wav" });
        objectUrl = URL.createObjectURL(blob);
        setGuideAudioUrl(objectUrl);
        setGuideAudioDuration(buffer.duration);
      } catch (renderError) {
        setGuideRenderError(renderError instanceof Error ? renderError.message : "가이드 트랙 오디오를 준비하지 못했습니다.");
        setGuideAudioUrl("");
        setGuideAudioDuration(fallbackGuideDuration);
      }
    }

    void renderGuideAudio();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fallbackGuideDuration, guideData, guideTrack]);

  useEffect(() => {
    if (recorder.state !== "recording") return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [recorder.state]);

  async function refreshTracks() {
    if (!session) return;
    setTracks(await getRecordingTracks(session.id));
  }

  async function handleRequestPermission() {
    const granted = await recorder.requestMicrophonePermission();
    if (granted) setMessage("마이크를 사용할 준비가 되었습니다.");
  }

  async function startRecordingWithGuide() {
    setError("");
    if (recorder.state === "recording") {
      recorder.stopRecording();
      player.pause();
      return;
    }

    const started = await recorder.startRecording();
    if (started) {
      player.seek(0);
      void player.play().catch((playError) => {
        setError(playError instanceof Error ? playError.message : "가이드 트랙 재생을 시작하지 못했습니다.");
      });
    }
  }

  async function handleSaveRecording() {
    if (!session || !guideTrack || !recorder.blob) return;
    setUploading(true);
    setError("");
    setMessage("");

    try {
      await uploadRecordingTrack({
        sessionId: session.id,
        guideTrackId: guideTrack.id,
        blob: recorder.blob,
        durationSeconds: recorder.durationSeconds,
        part: selectedPart,
        title: trackTitle.trim() || fallbackTrackTitle,
        notes,
        deviceLabel: recorder.deviceLabel,
        recordingOffsetMs: 0,
        latencyOffsetMs: 0,
      });
      setMessage("녹음을 저장했습니다.");
      recorder.resetRecording();
      setNotes("");
      await refreshTracks();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "녹음을 저장하지 못했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteTrack(trackId: string) {
    if (!window.confirm("이 녹음을 삭제할까요?")) return;
    setError("");
    try {
      await markRecordingTrackDeleted(trackId);
      player.stop();
      await refreshTracks();
      setMessage("녹음을 삭제했습니다.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "녹음을 삭제하지 못했습니다.");
    }
  }

  function handleTransportRecord() {
    recordingPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    void startRecordingWithGuide();
  }

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-sm text-slate-500">팀 녹음실을 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!guideTrack || !setlist || !song) {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">팀 녹음실을 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-rose-700">{error || "가이드 트랙 정보를 찾을 수 없습니다."}</p>
          <Link href="/setlists" className="btn-primary mt-5">콘티 목록으로</Link>
        </section>
      </div>
    );
  }

  if (!canUseRecordingStudio) {
    return (
      <div className="page-shell">
        <section className="card p-8">
          <p className="text-sm font-black text-violet-700">실험실 기능</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">팀 녹음실</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            팀 녹음실은 현재 실험실 기능입니다. 내 계정에서 실험실 기능을 켜면 사용할 수 있습니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/account" className="btn-primary">실험실 켜기</Link>
            <Link href={`/setlists/${setlist.id}/songs/${song.id}/guide-track`} className="btn-secondary">가이드 트랙으로</Link>
          </div>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page-shell">
        <section className="card p-8">
          <p className="text-sm font-black text-violet-700">실험실 · 팀 녹음실</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">{song.title} 팀 녹음실</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            아직 열린 녹음 세션이 없습니다. 리더/부리더가 먼저 팀 녹음실을 열어야 팀원이 녹음할 수 있습니다.
          </p>
          <Link href={`/setlists/${setlist.id}/songs/${song.id}/guide-track`} className="btn-secondary mt-5">가이드 트랙으로</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-7xl space-y-5 pb-24">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-violet-50 via-white to-blue-50 p-5 sm:p-7">
          <Link href={`/setlists/${setlist.id}/songs/${song.id}/guide-track`} className="text-sm font-bold text-blue-700">
            가이드 트랙으로 돌아가기
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-black text-white">실험실</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">DAW 스타일</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">세션 {session.status}</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">Cloudflare R2 저장</span>
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">팀 녹음실</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            {song.title} · {guideTrack.title} · Key {guideData.key || "-"} · BPM {guideData.bpm ?? "-"} · {guideData.timeSignature}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            가이드 트랙을 기준으로 팀원 녹음을 쌓아 함께 들어볼 수 있습니다. 음소거, Solo, 볼륨을 조절해 파트별 연습 상태를 확인해보세요.
          </p>
        </div>
      </section>

      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error || recorder.error || guideRenderError ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error || recorder.error || guideRenderError}</p>
      ) : null}

      <StudioTransportBar
        playing={player.playing}
        loading={player.loading}
        recording={recorder.state === "recording"}
        currentTime={player.currentTime}
        duration={player.duration}
        position={currentPosition}
        onPlayPause={() => (player.playing ? player.pause() : void player.play().catch((playError) => setError(playError instanceof Error ? playError.message : "재생을 시작하지 못했습니다.")))}
        onStop={player.stop}
        onRewind={() => player.seek(0)}
        onSeek={player.seek}
        onRecord={handleTransportRecord}
      />

      <StudioTimeline data={guideData} currentTime={player.currentTime} duration={player.duration} onSeek={player.seek} />

      <section className="rounded-2xl border border-slate-200 bg-slate-100/80 p-3 sm:p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Tracks</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Guide Track은 항상 맨 위에 표시되고, 팀원 녹음은 아래에 쌓입니다.</p>
          </div>
          <button type="button" onClick={refreshTracks} className="btn-secondary">목록 새로고침</button>
        </div>

        <div className="space-y-3">
          <StudioTrackRow
            id={GUIDE_TRACK_ID}
            title="가이드 트랙"
            subtitle={`${guideTrack.title} · ${guideData.sound}`}
            badge="Guide"
            color="blue"
            duration={guideAudioDuration || fallbackGuideDuration}
            currentTime={player.currentTime}
            mix={player.mixState[GUIDE_TRACK_ID]}
            hasSolo={player.hasSolo}
            onSeek={player.seek}
            onToggleMute={player.toggleMute}
            onToggleSolo={player.toggleSolo}
            onVolumeChange={player.setVolume}
          >
            <WaveformCanvas
              peaks={guidePeaks}
              duration={guideAudioDuration || fallbackGuideDuration}
              currentTime={player.currentTime}
              muted={player.mixState[GUIDE_TRACK_ID]?.muted}
              solo={player.mixState[GUIDE_TRACK_ID]?.solo}
              onSeek={player.seek}
            />
          </StudioTrackRow>

          {orderedTracks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              아직 업로드된 팀원 녹음이 없습니다. 가이드 트랙을 들으며 첫 녹음을 남겨보세요.
            </p>
          ) : (
            orderedTracks.map((track) => (
              <StudioTrackRow
                key={track.id}
                id={track.id}
                title={track.profile?.displayName || "팀원"}
                subtitle={`${track.part || "파트 미지정"} · ${track.title} · ${formatDuration(track.durationSeconds ?? 0)}`}
                badge={track.userId === myUserId ? "내 녹음" : "팀원"}
                color={track.userId === myUserId ? "emerald" : "slate"}
                duration={track.durationSeconds || player.duration}
                currentTime={player.currentTime}
                notes={track.notes}
                mix={player.mixState[track.id]}
                hasSolo={player.hasSolo}
                onSeek={player.seek}
                onToggleMute={player.toggleMute}
                onToggleSolo={player.toggleSolo}
                onVolumeChange={player.setVolume}
                canDelete={track.userId === myUserId || canManage}
                onDelete={() => handleDeleteTrack(track.id)}
              >
                <RecordingWaveform
                  track={track}
                  sourceUrl={readUrls[track.id]}
                  ensureReadUrl={ensureReadUrl}
                  currentTime={player.currentTime}
                  fallbackDuration={track.durationSeconds || player.duration}
                  muted={player.mixState[track.id]?.muted}
                  solo={player.mixState[track.id]?.solo}
                  onSeek={player.seek}
                />
              </StudioTrackRow>
            ))
          )}
        </div>
      </section>

      <section ref={recordingPanelRef} className="card scroll-mt-28 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-blue-700">새 녹음 추가</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">내 파트 녹음</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              녹음 시작을 누르면 현재 믹스 상태의 트랙이 함께 재생됩니다. 가이드만 들으며 녹음하려면 다른 트랙을 음소거해 주세요.
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{recorder.state}</span>
        </div>

        {!recorder.supported ? (
          <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
            이 브라우저에서는 녹음 기능을 지원하지 않을 수 있습니다. Safari 또는 Chrome 최신 버전에서 다시 시도해 주세요.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <button type="button" onClick={handleRequestPermission} className="btn-secondary w-full">
                마이크 권한 요청
              </button>

              <label className="block space-y-1">
                <span className="field-label">입력 장치</span>
                <select
                  value={recorder.selectedDeviceId}
                  onChange={(event) => recorder.setSelectedDeviceId(event.target.value)}
                  className="field-input"
                >
                  <option value="">기본 마이크</option>
                  {recorder.devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                  ))}
                </select>
                <span className="block text-xs leading-5 text-slate-500">
                  라인 입력이나 오디오 인터페이스를 연결하면 브라우저에서 입력 장치로 표시될 수 있습니다.
                </span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="field-label">내 파트</span>
                  <select value={part} onChange={(event) => setPart(event.target.value)} className="field-input">
                    {PART_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                {part === "직접 입력" ? (
                  <label className="space-y-1">
                    <span className="field-label">파트 직접 입력</span>
                    <input value={customPart} onChange={(event) => setCustomPart(event.target.value)} className="field-input" placeholder="예: 세컨, 미디어" />
                  </label>
                ) : null}
              </div>

              <label className="block space-y-1">
                <span className="field-label">녹음 제목</span>
                <input
                  value={trackTitle}
                  onChange={(event) => setTrackTitle(event.target.value)}
                  className="field-input"
                  placeholder={fallbackTrackTitle}
                />
              </label>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-xs font-black text-slate-500">녹음 시간</p>
                <p className={recorder.state === "recording" ? "mt-1 text-4xl font-black text-rose-600" : "mt-1 text-4xl font-black text-slate-950"}>
                  {formatDuration(recorder.durationSeconds)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {currentPosition.label} · {currentPosition.bar > 0 ? `${currentPosition.bar}마디` : "카운트인"} · {currentPosition.beat}박
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={startRecordingWithGuide}
                  disabled={!recorder.canRecord && recorder.state !== "recording"}
                  className={
                    recorder.state === "recording"
                      ? "min-h-14 rounded-xl bg-rose-600 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-rose-700"
                      : "min-h-14 rounded-xl bg-blue-600 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  }
                >
                  {recorder.state === "recording" ? "녹음 중지" : "녹음 시작"}
                </button>
                <button type="button" onClick={recorder.resetRecording} className="btn-secondary min-h-14">
                  다시 녹음
                </button>
              </div>

              {recorder.objectUrl ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="font-black text-slate-950">내 녹음 미리듣기</h3>
                  <audio controls src={recorder.objectUrl} className="mt-3 w-full" />
                  <label className="mt-4 block space-y-1">
                    <span className="field-label">메모</span>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className="field-input min-h-24"
                      placeholder="예: 2절 후렴에서 살짝 늦었습니다."
                    />
                  </label>
                  <button type="button" onClick={handleSaveRecording} disabled={uploading} className="btn-primary mt-4 w-full">
                    {uploading ? "저장 중..." : "녹음 저장"}
                  </button>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    녹음 파일은 R2에 업로드되고, Supabase에는 권한과 메타데이터만 저장됩니다.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
        <h2 className="font-black">실험실 안내</h2>
        <p className="mt-2">이 기능은 실험실 기능입니다. 브라우저와 기기 환경에 따라 재생 싱크와 녹음 동작이 다를 수 있습니다.</p>
        <p className="mt-1">녹음 중에는 화면을 끄거나 다른 앱으로 이동하지 않는 것을 권장합니다.</p>
      </section>
    </div>
  );
}

function StudioTrackRow({
  id,
  title,
  subtitle,
  badge,
  color,
  duration,
  currentTime,
  notes,
  mix,
  hasSolo,
  onSeek,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  canDelete = false,
  onDelete,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  color: "blue" | "emerald" | "slate";
  duration: number;
  currentTime: number;
  notes?: string;
  mix?: TrackMixState;
  hasSolo: boolean;
  onSeek: (time: number) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  canDelete?: boolean;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  const muted = Boolean(mix?.muted);
  const solo = Boolean(mix?.solo);
  const active = hasSolo ? solo : !muted;
  const volume = mix?.volume ?? 1;
  const colorClasses = {
    blue: "border-blue-200 bg-blue-50/70",
    emerald: "border-emerald-200 bg-emerald-50/70",
    slate: "border-slate-200 bg-white",
  }[color];

  return (
    <article className={`rounded-2xl border p-3 transition ${active ? colorClasses : "border-slate-200 bg-slate-50 opacity-60"}`}>
      <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-black text-white">{badge}</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">
              {formatDuration(Math.min(currentTime, duration))} / {formatDuration(duration)}
            </span>
          </div>
          <h3 className="mt-2 truncate text-base font-black text-slate-950">{title}</h3>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">{subtitle}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onToggleMute(id)}
              className={muted ? "rounded-xl bg-slate-700 px-3 py-2 text-xs font-black text-white" : "rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200"}
            >
              {muted ? "꺼짐" : "음소거"}
            </button>
            <button
              type="button"
              onClick={() => onToggleSolo(id)}
              className={solo ? "rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white" : "rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200"}
            >
              Solo
            </button>
          </div>

          <label className="mt-3 block">
            <span className="text-[11px] font-black text-slate-500">볼륨 {Math.round(volume * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => onVolumeChange(id, Number(event.target.value))}
              className="mt-1 w-full accent-blue-600"
            />
          </label>

          {canDelete ? (
            <button type="button" onClick={onDelete} className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
              삭제
            </button>
          ) : null}
        </div>

        <div className="min-w-0">
          {children}
          {notes ? <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-white/70 p-3 text-xs leading-5 text-slate-600">{notes}</p> : null}
        </div>
      </div>
    </article>
  );
}

function RecordingWaveform({
  track,
  sourceUrl,
  ensureReadUrl,
  currentTime,
  fallbackDuration,
  muted,
  solo,
  onSeek,
}: {
  track: TeamRecordingTrack;
  sourceUrl?: string;
  ensureReadUrl: (trackId: string) => Promise<string>;
  currentTime: number;
  fallbackDuration: number;
  muted?: boolean;
  solo?: boolean;
  onSeek: (time: number) => void;
}) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [duration, setDuration] = useState(fallbackDuration);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPeaks() {
      setLoading(true);
      setError("");
      try {
        const url = sourceUrl || (await ensureReadUrl(track.id));
        const result = await getAudioPeaksFromUrl(url, 320);
        if (cancelled) return;
        setPeaks(result.peaks);
        setDuration(result.duration || fallbackDuration);
      } catch (waveformError) {
        if (cancelled) return;
        setError(waveformError instanceof Error ? waveformError.message : "파형을 표시하지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPeaks();
    return () => {
      cancelled = true;
    };
  }, [ensureReadUrl, fallbackDuration, sourceUrl, track.id]);

  return (
    <WaveformCanvas
      peaks={peaks}
      duration={duration || fallbackDuration}
      currentTime={currentTime}
      muted={muted}
      solo={solo}
      loading={loading}
      error={error}
      onSeek={onSeek}
    />
  );
}

function orderTracks(tracks: TeamRecordingTrack[], myUserId: string) {
  return [...tracks].sort((a, b) => {
    const aMine = a.userId === myUserId ? -1 : 0;
    const bMine = b.userId === myUserId ? -1 : 0;
    if (aMine !== bMine) return aMine - bMine;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
