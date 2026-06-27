"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StudioTimeline } from "@/components/recording/StudioTimeline";
import { StudioTransportBar } from "@/components/recording/StudioTransportBar";
import { WaveformCanvas } from "@/components/recording/WaveformCanvas";
import { useMultitrackPlayer, type TrackMixState } from "@/hooks/useMultitrackPlayer";
import { audioBufferToWav, downloadBlob } from "@/lib/audio/exportWav";
import { renderMixdownToWavBlob, type MixdownTrackSource } from "@/lib/audio/mixdown";
import { renderGuideTrackToAudioBuffer } from "@/lib/audio/renderGuideTrack";
import {
  DEFAULT_TRACK_EFFECTS,
  normalizeTrackEffects,
  volumeToDb,
  type CompressorPreset,
  type ReverbType,
  type TrackEffectSettings,
} from "@/lib/audio/trackEffects";
import { createSyntheticGuidePeaks, getAudioPeaksFromUrl } from "@/lib/audio/waveform";
import { getCurrentUser } from "@/lib/auth";
import { getMyProfile, type Profile } from "@/lib/db/profiles";
import { getCloudSetlist, type CloudSetlist } from "@/lib/db/setlists";
import { getMyRoleInTeam } from "@/lib/db/teamMemberships";
import {
  formatRecordingUsageBytes,
  createRecordingSession,
  getRecordingSessionForGuideTrack,
  getRecordingTracks,
  getTeamRecordingUsageSummary,
  type TeamRecordingSession,
  type TeamRecordingTrack,
  type TeamRecordingUsageSummary,
} from "@/lib/db/teamRecordingStudio";
import { getGuideTrack, normalizeGuideTrackData, type TeamGuideTrack } from "@/lib/db/teamGuideTracks";
import { canUseFeature } from "@/lib/features";
import { canManageTeamSetlist } from "@/lib/permissions/teamPermissions";
import {
  getRecordingReadUrl,
  markRecordingTrackDeleted,
  updateRecordingTrackLatencyOffset,
  uploadRecordingTrack,
} from "@/lib/recording/uploadRecordingTrack";
import {
  getGuideTrackDurationSeconds,
  getStudioCurrentPosition,
} from "@/lib/recording/studioTimeline";
import { useAudioInputMeter, type AudioInputMeterStatus } from "@/lib/recording/useAudioInputMeter";
import { useAudioRecorder } from "@/lib/recording/useAudioRecorder";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Song } from "@/lib/types";

const GUIDE_TRACK_ID = "guide-track";
const PART_OPTIONS = ["보컬", "싱어", "일렉", "어쿠스틱", "건반", "베이스", "드럼", "기타", "직접 입력"];

type StudioTrackTheme = {
  icon: string;
  accent: string;
  soft: string;
  wave: string;
  background: string;
};

export default function GuideTrackStudioPage() {
  const params = useParams<{ guideTrackId: string }>();
  const recorder = useAudioRecorder();
  const inputMeter = useAudioInputMeter();
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
  const [mixdowning, setMixdowning] = useState(false);
  const [skipInputTest, setSkipInputTest] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [usageSummary, setUsageSummary] = useState<TeamRecordingUsageSummary | null>(null);
  const [effectTrackId, setEffectTrackId] = useState("");

  const guideData = useMemo(() => normalizeGuideTrackData(guideTrack?.guideTrackData), [guideTrack?.guideTrackData]);
  const fallbackGuideDuration = useMemo(() => getGuideTrackDurationSeconds(guideData), [guideData]);
  const guidePeaks = useMemo(() => createSyntheticGuidePeaks(360), []);
  const canUseRecordingStudio = canUseFeature(profile, "teamRecordingStudio");
  const selectedPart = part === "직접 입력" ? customPart.trim() || "기타" : part;
  const fallbackTrackTitle = `${selectedPart} 녹음`;
  const orderedTracks = useMemo(() => orderTracks(tracks, myUserId), [myUserId, tracks]);
  const selectedTrack = useMemo(
    () => orderedTracks.find((track) => track.id === selectedTrackId) ?? null,
    [orderedTracks, selectedTrackId],
  );
  const effectTarget = useMemo(() => {
    if (effectTrackId === GUIDE_TRACK_ID) return { id: GUIDE_TRACK_ID, label: "Guide", theme: GUIDE_TRACK_THEME };
    const track = orderedTracks.find((item) => item.id === effectTrackId);
    return track
      ? {
          id: track.id,
          label: track.part || track.profile?.displayName || "트랙",
          theme: getTrackTheme(track.part || track.title || track.id),
        }
      : null;
  }, [effectTrackId, orderedTracks]);
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
        defaultLatencyOffsetMs: track.latencyOffsetMs,
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
      if (nextGuideTrack.teamId) {
        setUsageSummary(await getTeamRecordingUsageSummary(nextGuideTrack.teamId).catch(() => null));
      }

      if (!canUseFeature(nextProfile, "teamRecordingStudio")) {
        setLoaded(true);
        return;
      }

      let nextSession = await getRecordingSessionForGuideTrack(nextGuideTrack.id);
      if (!nextSession && nextCanManage) {
        try {
          nextSession = await createRecordingSession({
            teamId: nextGuideTrack.teamId,
            setlistId: nextGuideTrack.setlistId,
            songId: nextGuideTrack.songId,
            guideTrackId: nextGuideTrack.id,
            title: `${nextSong.title || "곡"} 팀 녹음실`,
          });
          if (nextGuideTrack.teamId) {
            setUsageSummary(await getTeamRecordingUsageSummary(nextGuideTrack.teamId).catch(() => null));
          }
        } catch (sessionError) {
          setError(sessionError instanceof Error ? sessionError.message : "팀 녹음실을 만들지 못했습니다.");
        }
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

  useEffect(() => {
    if (selectedTrackId && !orderedTracks.some((track) => track.id === selectedTrackId)) {
      setSelectedTrackId("");
    }
  }, [orderedTracks, selectedTrackId]);

  async function refreshTracks() {
    if (!session) return;
    setTracks(await getRecordingTracks(session.id));
  }

  async function refreshUsageSummary() {
    if (!guideTrack?.teamId) return;
    setUsageSummary(await getTeamRecordingUsageSummary(guideTrack.teamId).catch(() => null));
  }

  async function handleRequestPermission() {
    const granted = await recorder.requestMicrophonePermission();
    if (granted) setMessage("선택한 입력 장치를 사용할 준비가 되었습니다.");
  }

  async function startRecordingWithGuide(skipTest = false) {
    setError("");
    if (recorder.state === "recording") {
      recorder.stopRecording();
      player.pause();
      return;
    }

    if (!selectedPart.trim()) {
      setError("파트를 먼저 선택해 주세요.");
      return;
    }

    if (!inputMeter.hasTested && !skipInputTest && !skipTest) {
      setMessage("마이크 테스트를 하면 입력 크기를 미리 확인할 수 있습니다. 테스트하거나 건너뛰고 녹음을 시작해 주세요.");
      recordingPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    inputMeter.stopTest();
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
        inputType: recorder.inputType,
        deviceLabel: recorder.deviceLabel,
        recordingOffsetMs: 0,
        latencyOffsetMs: 0,
      });
      setMessage("녹음을 저장했습니다.");
      recorder.resetRecording();
      setNotes("");
      await refreshTracks();
      await refreshUsageSummary();
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
      await refreshUsageSummary();
      setMessage("녹음을 삭제했습니다.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "녹음을 삭제하지 못했습니다.");
    }
  }

  function handleTransportRecord() {
    recordingPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    void startRecordingWithGuide();
  }

  function isTrackAudible(trackId: string) {
    const state = player.mixState[trackId];
    if (player.hasSolo) return Boolean(state?.solo);
    return !state?.muted;
  }

  async function handleDownloadMixdown() {
    if (!song) return;
    setMixdowning(true);
    setError("");
    setMessage("");

    try {
      const mixSources: MixdownTrackSource[] = [];
      if (guideAudioUrl && isTrackAudible(GUIDE_TRACK_ID)) {
        mixSources.push({
          id: GUIDE_TRACK_ID,
          url: guideAudioUrl,
          volume: player.mixState[GUIDE_TRACK_ID]?.volume ?? 0.8,
          pan: player.mixState[GUIDE_TRACK_ID]?.pan ?? 0,
          effects: player.mixState[GUIDE_TRACK_ID]?.effects,
        });
      }

      for (const track of orderedTracks) {
        if (!isTrackAudible(track.id)) continue;
        mixSources.push({
          id: track.id,
          url: await ensureReadUrl(track.id),
          volume: player.mixState[track.id]?.volume ?? 1,
          pan: player.mixState[track.id]?.pan ?? 0,
          offsetMs: track.recordingOffsetMs + (player.mixState[track.id]?.latencyOffsetMs ?? track.latencyOffsetMs),
          effects: player.mixState[track.id]?.effects,
        });
      }

      const wavBlob = await renderMixdownToWavBlob({
        tracks: mixSources,
        durationSeconds: player.duration,
        masterVolume: player.masterVolume,
      });
      const filename = `setlistlab-mix-${sanitizeFilenamePart(song.title)}-${new Date().toISOString().slice(0, 10)}.wav`;
      downloadBlob(wavBlob, filename);
      setMessage("현재 믹스 상태로 WAV 파일을 만들었습니다.");
    } catch (mixdownError) {
      setError(mixdownError instanceof Error ? mixdownError.message : "믹스 파일을 만들지 못했습니다.");
    } finally {
      setMixdowning(false);
    }
  }

  async function handleLatencyChange(track: TeamRecordingTrack, nextLatencyOffsetMs: number, persist = false) {
    const safeValue = Math.max(-2000, Math.min(2000, Math.round(nextLatencyOffsetMs)));
    player.setLatencyOffset(track.id, safeValue);
    if (!persist) return;

    try {
      const { track: updatedTrack } = await updateRecordingTrackLatencyOffset(track.id, safeValue);
      setTracks((current) => current.map((item) => (item.id === updatedTrack.id ? { ...item, latencyOffsetMs: updatedTrack.latencyOffsetMs } : item)));
      setMessage("트랙 싱크를 저장했습니다.");
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "트랙 싱크를 저장하지 못했습니다.");
    }
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
          {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
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

      <RecordingUsageNotice summary={usageSummary} labEnabled={Boolean(profile?.labEnabled)} />

      <StudioTransportBar
        playing={player.playing}
        loading={player.loading}
        recording={recorder.state === "recording"}
        currentTime={player.currentTime}
        duration={player.duration}
        position={currentPosition}
        syncControl={
          selectedTrack
            ? {
                trackLabel: `${selectedTrack.part || "파트 미지정"} · ${selectedTrack.profile?.displayName || "팀원"}`,
                value: player.mixState[selectedTrack.id]?.latencyOffsetMs ?? selectedTrack.latencyOffsetMs,
                canAdjust: selectedTrack.userId === myUserId || canManage,
                onChange: (value) => void handleLatencyChange(selectedTrack, value),
                onCommit: (value) => void handleLatencyChange(selectedTrack, value, true),
                onClear: () => setSelectedTrackId(""),
              }
            : undefined
        }
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
            <h2 className="text-lg font-black text-slate-950">트랙</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Guide는 맨 위에, 팀원 녹음은 파트별 색상으로 아래에 표시됩니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleDownloadMixdown} disabled={mixdowning} className="btn-primary">
              {mixdowning ? "믹스 만드는 중..." : "현재 믹스 다운로드"}
            </button>
            <button type="button" onClick={refreshTracks} className="btn-secondary">목록 새로고침</button>
          </div>
        </div>

        <div className="space-y-3">
          <StudioTrackRow
            id={GUIDE_TRACK_ID}
            title="Guide"
            subtitle="기준 트랙"
            theme={GUIDE_TRACK_THEME}
            duration={guideAudioDuration || fallbackGuideDuration}
            currentTime={player.currentTime}
            mix={player.mixState[GUIDE_TRACK_ID]}
            hasSolo={player.hasSolo}
            onSeek={player.seek}
            onToggleMute={player.toggleMute}
            onToggleSolo={player.toggleSolo}
            onVolumeChange={player.setVolume}
            onPanChange={player.setPan}
            panSupported={player.panSupported}
            selected={false}
          >
            <WaveformCanvas
              peaks={guidePeaks}
              duration={guideAudioDuration || fallbackGuideDuration}
              currentTime={player.currentTime}
              muted={player.mixState[GUIDE_TRACK_ID]?.muted}
              solo={player.mixState[GUIDE_TRACK_ID]?.solo}
              waveColor={GUIDE_TRACK_THEME.wave}
              backgroundColor={GUIDE_TRACK_THEME.background}
              height={56}
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
                title={track.part || "파트 미지정"}
                subtitle={`${track.profile?.displayName || "팀원"} · ${formatDuration(track.durationSeconds ?? 0)}`}
                badge={track.userId === myUserId ? "내 녹음" : undefined}
                theme={getTrackTheme(track.part || track.title || track.id)}
                duration={track.durationSeconds || player.duration}
                currentTime={player.currentTime}
                notes={track.notes}
                mix={player.mixState[track.id]}
                hasSolo={player.hasSolo}
                onSeek={player.seek}
                onToggleMute={player.toggleMute}
                onToggleSolo={player.toggleSolo}
                onVolumeChange={player.setVolume}
                onPanChange={player.setPan}
                panSupported={player.panSupported}
                selected={selectedTrackId === track.id}
                onSelect={() => setSelectedTrackId(track.id)}
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
                  theme={getTrackTheme(track.part || track.title || track.id)}
                  onSeek={player.seek}
                />
              </StudioTrackRow>
            ))
          )}
        </div>
      </section>

      <StudioMixerSection
        orderedTracks={orderedTracks}
        myUserId={myUserId}
        mixState={player.mixState}
        masterVolume={player.masterVolume}
        panSupported={player.panSupported}
        onMasterVolumeChange={player.setMasterVolume}
        onVolumeChange={player.setVolume}
        onPanChange={player.setPan}
        onOpenEffects={setEffectTrackId}
      />

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

        <MobileRecordingNotice />

        {!recorder.supported ? (
          <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
            이 브라우저에서는 녹음 기능을 지원하지 않을 수 있습니다. Safari 또는 Chrome 최신 버전에서 다시 시도해 주세요.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <button type="button" onClick={handleRequestPermission} className="btn-secondary w-full">
                입력 장치 권한 요청
              </button>

              <label className="block space-y-1">
                <span className="field-label">입력 종류</span>
                <select
                  value={recorder.inputType}
                  onChange={(event) => recorder.setInputType(event.target.value as typeof recorder.inputType)}
                  className="field-input"
                >
                  <option value="mic">마이크</option>
                  <option value="interface">오디오 인터페이스</option>
                  <option value="line">라인 입력</option>
                  <option value="unknown">가상/플러그인/기타 입력</option>
                </select>
                <span className="block text-xs leading-5 text-slate-500">
                  오디오 인터페이스, 라인 입력, 가상 믹서/플러그인 출력은 브라우저의 입력 장치 목록에 표시될 때 선택할 수 있습니다.
                </span>
              </label>

              <label className="block space-y-1">
                <span className="field-label">입력 장치</span>
                <select
                  value={recorder.selectedDeviceId}
                  onChange={(event) => recorder.setSelectedDeviceId(event.target.value)}
                  className="field-input"
                >
                  <option value="">기본 입력 장치</option>
                  {recorder.devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                  ))}
                </select>
                <span className="block text-xs leading-5 text-slate-500">
                  권한을 허용한 뒤 장치 이름이 표시됩니다. 인터페이스가 보이지 않으면 OS 사운드 입력 설정을 먼저 확인해 주세요.
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={recorder.rawInputMode}
                  onChange={(event) => recorder.setRawInputMode(event.target.checked)}
                  className="mt-1 size-4 accent-blue-600"
                />
                <span>
                  <span className="block text-sm font-black text-slate-950">원음 입력 모드</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    오디오 인터페이스나 라인 입력을 사용할 때 권장합니다. 브라우저의 에코 제거, 노이즈 억제, 자동 볼륨 보정을 끄고 녹음합니다.
                  </span>
                </span>
              </label>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-950">녹음 전 마이크 테스트</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      입력 크기와 클리핑 여부를 먼저 확인하면 녹음 실패를 줄일 수 있습니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (inputMeter.testing) {
                        inputMeter.stopTest();
                        return;
                      }
                      setSkipInputTest(false);
                      void inputMeter.startTest({
                        selectedDeviceId: recorder.selectedDeviceId,
                        inputType: recorder.inputType,
                        rawInputMode: recorder.rawInputMode,
                      });
                    }}
                    className="rounded-xl bg-white px-4 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-50"
                  >
                    {inputMeter.testing ? "테스트 중지" : "테스트 시작"}
                  </button>
                </div>
                <div className="mt-4">
                  <div className="h-3 overflow-hidden rounded-full bg-white ring-1 ring-blue-100">
                    <div
                      className={`h-full rounded-full transition-all ${getMeterBarClass(inputMeter.status)}`}
                      style={{ width: `${Math.round(inputMeter.level * 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold">
                    <span className={getMeterTextClass(inputMeter.status)}>{getMeterStatusMessage(inputMeter.status)}</span>
                    <span className="text-slate-500">Peak {Math.round(inputMeter.peak * 100)}%</span>
                  </div>
                  {inputMeter.error ? <p className="mt-2 text-xs font-semibold text-rose-700">{inputMeter.error}</p> : null}
                  {!inputMeter.hasTested && !skipInputTest ? (
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      마이크 테스트를 건너뛸 수는 있지만, 이어폰 착용과 입력 크기 확인을 권장합니다.
                    </p>
                  ) : null}
                </div>
              </div>

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
                  onClick={() => void startRecordingWithGuide()}
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
              {!inputMeter.hasTested && recorder.state !== "recording" ? (
                <button
                  type="button"
                  onClick={() => {
                    setSkipInputTest(true);
                    void startRecordingWithGuide(true);
                  }}
                  disabled={!recorder.canRecord}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  테스트 건너뛰고 녹음
                </button>
              ) : null}

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

      {effectTarget ? (
        <TrackEffectsModal
          trackLabel={effectTarget.label}
          theme={effectTarget.theme}
          effects={player.mixState[effectTarget.id]?.effects ?? DEFAULT_TRACK_EFFECTS}
          onPreview={(effects) => player.setEffects(effectTarget.id, effects)}
          onClose={() => setEffectTrackId("")}
        />
      ) : null}
    </div>
  );
}

function MobileRecordingNotice() {
  return (
    <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white text-lg shadow-sm" aria-hidden="true">
          🎧
        </span>
        <div>
          <h3 className="font-black">모바일 녹음 안내</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-amber-900">
            이어폰 착용을 권장합니다. 녹음 중에는 화면을 끄거나 다른 앱으로 이동하면 녹음이나 재생이 중단될 수 있어요.
          </p>
          <ul className="mt-3 grid gap-1 text-xs font-semibold leading-5 sm:grid-cols-2">
            <li>• 녹음 전 마이크 테스트로 입력 크기를 확인해 주세요.</li>
            <li>• 조용한 공간에서 녹음하면 더 좋은 결과를 얻을 수 있습니다.</li>
            <li>• 가이드 트랙 소리가 마이크에 섞이지 않도록 이어폰을 사용해 주세요.</li>
            <li>• iPhone/Safari 환경에서는 브라우저 정책에 따라 일부 기능이 제한될 수 있습니다.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function RecordingUsageNotice({
  summary,
  labEnabled,
}: {
  summary: TeamRecordingUsageSummary | null;
  labEnabled: boolean;
}) {
  if (!summary) return null;

  if (labEnabled || summary.limits.isUnlimited) {
    return (
      <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black">{labEnabled ? "실험실 모드" : "무제한 녹음실"}</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-violet-800">
              {labEnabled
                ? "실험실을 켠 계정은 테스트를 위해 팀 녹음실 사용량 제한을 우회합니다. 팀 접근 권한과 R2 보안 검사는 그대로 적용됩니다."
                : "이 팀은 녹음실 사용량 제한 없이 사용할 수 있습니다."}
            </p>
          </div>
          <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-black text-violet-700 ring-1 ring-violet-100">
            {summary.yearMonth}
          </span>
        </div>
      </section>
    );
  }

  const sessionLimitReached = summary.monthlySessionsUsed >= summary.limits.monthlySessionsLimit;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-950">녹음실 사용량</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            기본 팀은 한 달에 녹음실 {summary.limits.monthlySessionsLimit}개까지 만들 수 있습니다. 실험실 사용자는 quota만 우회합니다.
          </p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${
            sessionLimitReached ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100" : "bg-slate-100 text-slate-700"
          }`}
        >
          이번 달 {summary.monthlySessionsUsed} / {summary.limits.monthlySessionsLimit}개
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <UsageChip label="곡당 트랙" value={`${summary.activeTracksCount} / ${summary.limits.tracksPerSessionLimit}개`} />
        <UsageChip label="파트별 보관" value={`최근 ${summary.limits.versionsPerUserPartLimit}개`} />
        <UsageChip label="파일 제한" value={`${formatRecordingUsageBytes(summary.limits.maxTrackSizeBytes)} · ${Math.round(summary.limits.maxTrackDurationSeconds / 60)}분`} />
        <UsageChip label="현재 보관" value={formatRecordingUsageBytes(summary.activeStorageBytes)} />
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        재녹음은 같은 사용자와 파트 기준 최근 {summary.limits.versionsPerUserPartLimit}개만 활성 보관됩니다.
        기본 보관 기간은 {summary.limits.retentionDays}일이며, 오래된 실패 업로드와 삭제된 파일은 정리 정책에 따라 R2에서도 제거됩니다.
      </p>
    </section>
  );
}

function UsageChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function StudioMixerSection({
  orderedTracks,
  myUserId,
  mixState,
  masterVolume,
  panSupported,
  onMasterVolumeChange,
  onVolumeChange,
  onPanChange,
  onOpenEffects,
}: {
  orderedTracks: TeamRecordingTrack[];
  myUserId: string;
  mixState: Record<string, TrackMixState>;
  masterVolume: number;
  panSupported: boolean;
  onMasterVolumeChange: (volume: number) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onOpenEffects: (trackId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">믹서</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            각 트랙의 좌우 위치와 소리 크기를 조절할 수 있습니다. 자세한 소리 보정은 이펙터에서 조절하세요.
          </p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
          현재 믹서 설정으로 다운로드
        </span>
      </div>

      <div className="mt-4 overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          <MasterMixerChannel volume={masterVolume} onVolumeChange={onMasterVolumeChange} />
          <MixerChannel
            id={GUIDE_TRACK_ID}
            icon={GUIDE_TRACK_THEME.icon}
            title="Guide"
            subtitle="가이드"
            theme={GUIDE_TRACK_THEME}
            mix={mixState[GUIDE_TRACK_ID]}
            panSupported={panSupported}
            onVolumeChange={onVolumeChange}
            onPanChange={onPanChange}
            onOpenEffects={onOpenEffects}
          />
          {orderedTracks.map((track) => {
            const theme = getTrackTheme(track.part || track.title || track.id);
            return (
              <MixerChannel
                key={track.id}
                id={track.id}
                icon={theme.icon}
                title={track.part || "파트"}
                subtitle={track.userId === myUserId ? "내 녹음" : track.profile?.displayName || "팀원"}
                theme={theme}
                mix={mixState[track.id]}
                panSupported={panSupported}
                onVolumeChange={onVolumeChange}
                onPanChange={onPanChange}
                onOpenEffects={onOpenEffects}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MasterMixerChannel({
  volume,
  onVolumeChange,
}: {
  volume: number;
  onVolumeChange: (volume: number) => void;
}) {
  return (
    <article className="flex w-28 shrink-0 flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid size-10 place-items-center rounded-2xl bg-slate-900 text-lg text-white" aria-hidden="true">
        🎚️
      </div>
      <h3 className="mt-2 w-full truncate text-center text-sm font-black text-slate-950">Master</h3>
      <p className="mt-0.5 text-center text-[11px] font-bold text-slate-500">전체 출력</p>
      <div className="mt-5 flex flex-1 flex-col items-center justify-center">
        <VerticalVolumeFader
          value={volume}
          accent="#0f172a"
          label="Master 볼륨"
          onChange={onVolumeChange}
        />
      </div>
      <p className="mt-3 text-xs font-black text-slate-600">{volumeToDb(volume)}</p>
      <button
        type="button"
        disabled
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-black text-slate-300"
        title="Master 이펙터는 준비 중입니다."
      >
        이펙터
      </button>
    </article>
  );
}

function MixerChannel({
  id,
  icon,
  title,
  subtitle,
  theme,
  mix,
  panSupported,
  onVolumeChange,
  onPanChange,
  onOpenEffects,
}: {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  theme: StudioTrackTheme;
  mix?: TrackMixState;
  panSupported: boolean;
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onOpenEffects: (trackId: string) => void;
}) {
  const volume = mix?.volume ?? (id === GUIDE_TRACK_ID ? 0.8 : 1);
  const pan = mix?.pan ?? 0;

  return (
    <article className="flex w-28 shrink-0 flex-col items-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div
        className="grid size-10 place-items-center rounded-2xl text-lg"
        style={{ backgroundColor: theme.soft, color: theme.accent }}
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3 className="mt-2 w-full truncate text-center text-sm font-black text-slate-950">{title}</h3>
      <p className="mt-0.5 w-full truncate text-center text-[11px] font-bold text-slate-500">{subtitle}</p>
      <div className="mt-3 w-full">
        <p className="text-center text-[10px] font-black uppercase text-slate-400">Pan</p>
        <PanButtonGroup
          trackId={id}
          pan={pan}
          accent={theme.accent}
          disabled={!panSupported}
          onChange={onPanChange}
        />
      </div>
      <div className="mt-4 flex flex-1 flex-col items-center justify-center">
        <VerticalVolumeFader
          value={volume}
          accent={theme.accent}
          label={`${title} 볼륨`}
          onChange={(nextVolume) => onVolumeChange(id, nextVolume)}
        />
      </div>
      <p className="mt-3 text-xs font-black text-slate-600">{volumeToDb(volume)}</p>
      <button
        type="button"
        onClick={() => onOpenEffects(id)}
        className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
      >
        이펙터
      </button>
    </article>
  );
}

function VerticalVolumeFader({
  value,
  accent,
  label,
  onChange,
}: {
  value: number;
  accent: string;
  label: string;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const safeValue = Math.max(0, Math.min(1, value));

  const updateFromClientY = useCallback(
    (clientY: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.height <= 0) return;

      const nextValue = 1 - (clientY - rect.top) / rect.height;
      onChange(Math.max(0, Math.min(1, nextValue)));
    },
    [onChange],
  );

  const nudgeValue = useCallback(
    (amount: number) => {
      onChange(Math.max(0, Math.min(1, safeValue + amount)));
    },
    [onChange, safeValue],
  );

  return (
    <div className="flex h-36 items-center justify-center rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue * 100)}
        aria-valuetext={volumeToDb(safeValue)}
        aria-label={label}
        className="relative h-28 w-8 cursor-pointer touch-none select-none rounded-full bg-white shadow-inner ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
        onPointerDown={(event) => {
          event.preventDefault();
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromClientY(event.clientY);
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) return;
          event.preventDefault();
          updateFromClientY(event.clientY);
        }}
        onPointerUp={(event) => {
          draggingRef.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            event.preventDefault();
            nudgeValue(event.shiftKey ? 0.1 : 0.03);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            event.preventDefault();
            nudgeValue(event.shiftKey ? -0.1 : -0.03);
          }
          if (event.key === "Home") {
            event.preventDefault();
            onChange(0);
          }
          if (event.key === "End") {
            event.preventDefault();
            onChange(1);
          }
        }}
      >
        <span
          className="absolute bottom-2 left-1/2 w-1.5 -translate-x-1/2 rounded-full"
          style={{
            height: safeValue <= 0 ? "0px" : `max(0.25rem, calc(${safeValue * 100}% - 0.25rem))`,
            backgroundColor: accent,
            opacity: 0.9,
          }}
          aria-hidden="true"
        />
        <span
          className="absolute left-1/2 size-5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow-md transition-transform"
          style={{ bottom: `${safeValue * 100}%`, backgroundColor: accent }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function PanButtonGroup({
  trackId,
  pan,
  accent,
  disabled,
  onChange,
}: {
  trackId: string;
  pan: number;
  accent: string;
  disabled: boolean;
  onChange: (trackId: string, pan: number) => void;
}) {
  const items = [
    { label: "L", value: -1 },
    { label: "C", value: 0 },
    { label: "R", value: 1 },
  ];

  return (
    <div className="mt-1 grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {items.map((item) => {
        const selected = item.value === 0 ? Math.abs(pan) < 0.1 : item.value < 0 ? pan <= -0.1 : pan >= 0.1;
        return (
          <button
            key={item.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(trackId, item.value)}
            className="px-2 py-1.5 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: selected ? accent : undefined,
              color: selected ? "white" : undefined,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function TrackEffectsModal({
  trackLabel,
  theme,
  effects,
  onPreview,
  onClose,
}: {
  trackLabel: string;
  theme: StudioTrackTheme;
  effects: TrackEffectSettings;
  onPreview: (effects: TrackEffectSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => normalizeTrackEffects(effects));

  useEffect(() => {
    setDraft(normalizeTrackEffects(effects));
  }, [effects]);

  function updateDraft(next: TrackEffectSettings) {
    const normalized = normalizeTrackEffects(next);
    setDraft(normalized);
    onPreview(normalized);
  }

  function updateCompressor(preset: CompressorPreset) {
    updateDraft({
      ...draft,
      compressor: {
        enabled: preset !== "off",
        preset,
      },
    });
  }

  function updateReverb(type: ReverbType) {
    updateDraft({
      ...draft,
      reverb: {
        type,
        amount: type === "off" ? 0 : draft.reverb.amount || 0.25,
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black" style={{ color: theme.accent }}>
              이펙터
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{trackLabel} 이펙터</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Gain, EQ, Compressor, Reverb는 이 창에서만 조절합니다. 변경값은 재생과 현재 믹스 다운로드에 반영됩니다.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-500">
            닫기
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <h3 className="font-black text-slate-950">Gain</h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">녹음 원본의 기본 소리 크기를 보정합니다.</p>
            <EffectSlider
              label="Gain"
              value={draft.gainDb}
              min={-12}
              max={12}
              step={0.5}
              unit="dB"
              accent={theme.accent}
              onChange={(value) => updateDraft({ ...draft, gainDb: value })}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h3 className="font-black text-slate-950">EQ</h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">저음, 중음, 고음을 간단히 조절합니다.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <EffectSlider
                label="저음"
                value={draft.eq.lowGainDb}
                min={-12}
                max={12}
                step={1}
                unit="dB"
                accent={theme.accent}
                onChange={(value) => updateDraft({ ...draft, eq: { ...draft.eq, lowGainDb: value } })}
              />
              <EffectSlider
                label="중음"
                value={draft.eq.midGainDb}
                min={-12}
                max={12}
                step={1}
                unit="dB"
                accent={theme.accent}
                onChange={(value) => updateDraft({ ...draft, eq: { ...draft.eq, midGainDb: value } })}
              />
              <EffectSlider
                label="고음"
                value={draft.eq.highGainDb}
                min={-12}
                max={12}
                step={1}
                unit="dB"
                accent={theme.accent}
                onChange={(value) => updateDraft({ ...draft, eq: { ...draft.eq, highGainDb: value } })}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h3 className="font-black text-slate-950">Compressor</h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">소리 크기 차이를 줄여 더 안정적으로 들리게 합니다.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["off", "끔"],
                ["light", "약하게"],
                ["medium", "보통"],
                ["strong", "강하게"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateCompressor(value as CompressorPreset)}
                  className={`rounded-xl px-3 py-2 text-sm font-black transition ${
                    draft.compressor.preset === value ? "text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  style={{ backgroundColor: draft.compressor.preset === value ? theme.accent : undefined }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h3 className="font-black text-slate-950">Reverb</h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">공간감을 추가합니다. 너무 많이 넣으면 소리가 흐려질 수 있습니다.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["off", "끔"],
                ["small_room", "작은 공간"],
                ["chapel", "예배당"],
                ["wide_hall", "넓은 홀"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateReverb(value as ReverbType)}
                  className={`rounded-xl px-3 py-2 text-sm font-black transition ${
                    draft.reverb.type === value ? "text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  style={{ backgroundColor: draft.reverb.type === value ? theme.accent : undefined }}
                >
                  {label}
                </button>
              ))}
            </div>
            <EffectSlider
              label="리버브 양"
              value={Math.round(draft.reverb.amount * 100)}
              min={0}
              max={100}
              step={1}
              unit="%"
              accent={theme.accent}
              disabled={draft.reverb.type === "off"}
              onChange={(value) => updateDraft({ ...draft, reverb: { ...draft.reverb, amount: value / 100 } })}
            />
          </div>
        </div>

        <div className="sticky bottom-0 mt-5 grid gap-2 bg-white pt-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => updateDraft(DEFAULT_TRACK_EFFECTS)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-3 text-sm font-black text-white transition"
            style={{ backgroundColor: theme.accent }}
          >
            적용
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-200"
          >
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}

function EffectSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  accent,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  accent: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={disabled ? "mt-3 block opacity-45" : "mt-3 block"}>
      <span className="flex items-center justify-between gap-3 text-xs font-black text-slate-500">
        <span>{label}</span>
        <span className="text-slate-900">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full"
        style={{ accentColor: accent }}
        aria-label={label}
      />
    </label>
  );
}

function StudioTrackRow({
  id,
  title,
  subtitle,
  badge,
  theme,
  duration,
  currentTime,
  notes,
  mix,
  hasSolo,
  onSeek,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  onPanChange,
  panSupported,
  selected = false,
  onSelect,
  canDelete = false,
  onDelete,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  theme: StudioTrackTheme;
  duration: number;
  currentTime: number;
  notes?: string;
  mix?: TrackMixState;
  hasSolo: boolean;
  onSeek: (time: number) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  panSupported: boolean;
  selected?: boolean;
  onSelect?: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
  children: ReactNode;
}) {
  const muted = Boolean(mix?.muted);
  const solo = Boolean(mix?.solo);
  const active = hasSolo ? solo : !muted;
  const volume = mix?.volume ?? 1;
  const pan = mix?.pan ?? 0;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
        selected ? "border-blue-300 ring-2 ring-blue-100" : active ? "border-slate-200" : "border-slate-200 opacity-55"
      }`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (!onSelect) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      tabIndex={onSelect ? 0 : undefined}
      role={onSelect ? "button" : undefined}
      aria-selected={onSelect ? selected : undefined}
      aria-label={onSelect ? `${title} 트랙 선택` : undefined}
    >
      <div className="h-1" style={{ backgroundColor: theme.accent }} />
      <div className="grid gap-3 p-3 lg:grid-cols-[170px_200px_minmax(0,1fr)_36px] lg:items-center">
        <div className="flex min-w-0 items-center gap-3 pr-10 lg:pr-0">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black"
            style={{ backgroundColor: theme.soft, color: theme.accent }}
            aria-hidden="true"
          >
            {theme.icon}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-base font-black text-slate-950">{title}</h3>
              {badge ? <span className="shrink-0 rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black text-white">{badge}</span> : null}
            </div>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="min-w-0 lg:order-3">
          {children}
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-bold text-slate-400">
            <span>{formatDuration(Math.min(currentTime, duration))}</span>
            <span>{formatDuration(duration)}</span>
          </div>
          {notes ? <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">{notes}</p> : null}
        </div>

        <div className="flex items-center gap-2 lg:order-2 lg:flex-wrap">
          <PanKnob
            id={id}
            title={title}
            pan={pan}
            theme={theme}
            disabled={!panSupported}
            onChange={onPanChange}
          />

          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => onToggleMute(id)}
              className={`size-9 text-xs font-black transition ${muted ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"}`}
              aria-label={`${title} 음소거`}
              title="Mute"
            >
              M
            </button>
            <button
              type="button"
              onClick={() => onToggleSolo(id)}
              className={`size-9 border-l border-slate-200 text-xs font-black transition ${solo ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-50"}`}
              aria-label={`${title} Solo`}
              title="Solo"
            >
              S
            </button>
          </div>

          <button
            type="button"
            onClick={() => onToggleMute(id)}
            className={`relative h-7 w-12 rounded-full transition ${muted ? "bg-slate-300" : "bg-emerald-500"}`}
            aria-label={`${title} 켜기 끄기`}
            title={muted ? "트랙 꺼짐" : "트랙 켜짐"}
          >
            <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${muted ? "left-1" : "left-6"}`} />
          </button>

          <label className="flex w-full items-center gap-2">
            <span className="w-9 shrink-0 text-[11px] font-black text-slate-400">{Math.round(volume * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => onVolumeChange(id, Number(event.target.value))}
              className="w-full"
              style={{ accentColor: theme.accent }}
              aria-label={`${title} 볼륨`}
            />
          </label>
        </div>

        <div className="absolute right-3 top-4 lg:static lg:order-4 lg:flex lg:justify-end">
          {canDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="size-8 rounded-xl text-lg font-black leading-none text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              aria-label={`${title} 삭제`}
              title="삭제"
            >
              ⋮
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PanKnob({
  id,
  title,
  pan,
  theme,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  pan: number;
  theme: StudioTrackTheme;
  disabled: boolean;
  onChange: (trackId: string, pan: number) => void;
}) {
  const dragRef = useRef<{ x: number; pan: number } | null>(null);
  const safePan = Math.max(-1, Math.min(1, pan));
  const angle = safePan * 135;

  function commit(nextPan: number) {
    onChange(id, Math.max(-1, Math.min(1, Math.round(nextPan * 100) / 100)));
  }

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1" title={disabled ? "이 브라우저는 Pan 조절을 지원하지 않습니다." : "좌우 위치"}>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${title} 좌우 위치`}
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(safePan * 100)}
        aria-valuetext={formatPanLabel(safePan)}
        onDoubleClick={() => !disabled && commit(0)}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            commit(safePan - 0.05);
          }
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            commit(safePan + 0.05);
          }
          if (event.key === "Home" || event.key === "0") {
            event.preventDefault();
            commit(0);
          }
        }}
        onPointerDown={(event) => {
          if (disabled) return;
          dragRef.current = { x: event.clientX, pan: safePan };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (disabled || !dragRef.current) return;
          const delta = (event.clientX - dragRef.current.x) / 90;
          commit(dragRef.current.pan + delta);
        }}
        onPointerUp={(event) => {
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        className={`relative size-9 rounded-full border border-slate-200 bg-white shadow-sm transition ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-ew-resize hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
        }`}
        style={{
          boxShadow: `inset 0 0 0 6px ${theme.soft}`,
        }}
      >
        <span
          className="absolute left-1/2 top-1/2 h-3.5 w-1 origin-bottom -translate-x-1/2 -translate-y-full rounded-full"
          style={{
            backgroundColor: theme.accent,
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
          }}
          aria-hidden="true"
        />
        <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500" aria-hidden="true" />
      </div>
      <span className="text-[10px] font-black leading-none text-slate-400">{formatPanShortLabel(safePan)}</span>
    </div>
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
  theme,
  onSeek,
}: {
  track: TeamRecordingTrack;
  sourceUrl?: string;
  ensureReadUrl: (trackId: string) => Promise<string>;
  currentTime: number;
  fallbackDuration: number;
  muted?: boolean;
  solo?: boolean;
  theme: StudioTrackTheme;
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
      waveColor={theme.wave}
      backgroundColor={theme.background}
      height={56}
      loading={loading}
      error={error}
      onSeek={onSeek}
    />
  );
}

const GUIDE_TRACK_THEME: StudioTrackTheme = {
  icon: "🎧",
  accent: "#10b981",
  soft: "#d1fae5",
  wave: "#5eead4",
  background: "#ecfdf5",
};

const TRACK_THEMES: StudioTrackTheme[] = [
  { icon: "🎹", accent: "#8b5cf6", soft: "#ede9fe", wave: "#a78bfa", background: "#f5f3ff" },
  { icon: "🎤", accent: "#14b8a6", soft: "#ccfbf1", wave: "#5eead4", background: "#f0fdfa" },
  { icon: "🎸", accent: "#f97316", soft: "#ffedd5", wave: "#fdba74", background: "#fff7ed" },
  { icon: "🎸", accent: "#2563eb", soft: "#dbeafe", wave: "#93c5fd", background: "#eff6ff" },
  { icon: "🥁", accent: "#db2777", soft: "#fce7f3", wave: "#f9a8d4", background: "#fdf2f8" },
  { icon: "🪕", accent: "#d97706", soft: "#fef3c7", wave: "#fbbf24", background: "#fffbeb" },
  { icon: "🎵", accent: "#7c3aed", soft: "#ede9fe", wave: "#c4b5fd", background: "#faf5ff" },
  { icon: "🎚️", accent: "#0f766e", soft: "#ccfbf1", wave: "#2dd4bf", background: "#f0fdfa" },
];

function getTrackTheme(input: string): StudioTrackTheme {
  const key = input.toLowerCase();

  if (key.includes("건반") || key.includes("피아노") || key.includes("key") || key.includes("piano")) return TRACK_THEMES[0];
  if (key.includes("싱어") || key.includes("보컬") || key.includes("vocal")) return TRACK_THEMES[1];
  if (key.includes("베이스") || key.includes("bass")) return TRACK_THEMES[2];
  if (key.includes("일렉") || key.includes("electric") || key.includes("lead")) return TRACK_THEMES[3];
  if (key.includes("드럼") || key.includes("drum")) return TRACK_THEMES[4];
  if (key.includes("어쿠") || key.includes("통기타") || key.includes("acoustic")) return TRACK_THEMES[5];

  const seed = Array.from(input).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TRACK_THEMES[seed % TRACK_THEMES.length];
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

function sanitizeFilenamePart(value: string) {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 48);
  return cleaned || "guide-track";
}

function formatPanLabel(pan: number) {
  if (pan <= -0.1) return `왼쪽 ${Math.round(Math.abs(pan) * 100)}`;
  if (pan >= 0.1) return `오른쪽 ${Math.round(pan * 100)}`;
  return "중앙";
}

function formatPanShortLabel(pan: number) {
  if (pan <= -0.1) return `L${Math.round(Math.abs(pan) * 100)}`;
  if (pan >= 0.1) return `R${Math.round(pan * 100)}`;
  return "중앙";
}

function getMeterStatusMessage(status: AudioInputMeterStatus) {
  if (status === "too_low") return "소리가 너무 작습니다. 마이크를 가까이 하거나 입력 장치를 확인해 주세요.";
  if (status === "good") return "좋은 입력 크기입니다.";
  if (status === "too_high") return "소리가 너무 큽니다. 입력을 조금 낮춰 주세요.";
  if (status === "clipping") return "클리핑 위험이 있습니다. 소리가 깨질 수 있어요.";
  if (status === "error") return "마이크 권한이 필요합니다.";
  if (status === "checking") return "마이크 입력을 확인하고 있습니다.";
  return "테스트 시작을 눌러 입력 크기를 확인해 주세요.";
}

function getMeterBarClass(status: AudioInputMeterStatus) {
  if (status === "good") return "bg-emerald-500";
  if (status === "too_high") return "bg-amber-500";
  if (status === "clipping" || status === "error") return "bg-rose-500";
  if (status === "too_low") return "bg-slate-400";
  return "bg-blue-500";
}

function getMeterTextClass(status: AudioInputMeterStatus) {
  if (status === "good") return "text-emerald-700";
  if (status === "too_high") return "text-amber-700";
  if (status === "clipping" || status === "error") return "text-rose-700";
  return "text-slate-600";
}
