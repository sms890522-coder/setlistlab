"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GuideTrackPreviewPlayer } from "@/components/GuideTrackPreviewPlayer";
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
import { useAudioRecorder } from "@/lib/recording/useAudioRecorder";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Song } from "@/lib/types";

const PART_OPTIONS = ["보컬", "싱어", "일렉", "어쿠스틱", "건반", "베이스", "드럼", "기타", "직접 입력"];

export default function GuideTrackStudioPage() {
  const params = useParams<{ guideTrackId: string }>();
  const recorder = useAudioRecorder();
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
  const [loadingReadTrackId, setLoadingReadTrackId] = useState("");

  const guideData = useMemo(() => normalizeGuideTrackData(guideTrack?.guideTrackData), [guideTrack?.guideTrackData]);
  const canUseRecordingStudio = canUseFeature(profile, "teamRecordingStudio");
  const selectedPart = part === "직접 입력" ? customPart.trim() || "기타" : part;
  const fallbackTrackTitle = `${selectedPart} 녹음`;

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

  async function handleLoadReadUrl(trackId: string) {
    setLoadingReadTrackId(trackId);
    setError("");
    try {
      const { readUrl } = await getRecordingReadUrl(trackId);
      setReadUrls((current) => ({ ...current, [trackId]: readUrl }));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "녹음을 재생하지 못했습니다.");
    } finally {
      setLoadingReadTrackId("");
    }
  }

  async function handleDeleteTrack(trackId: string) {
    if (!window.confirm("이 녹음을 삭제할까요?")) return;
    setError("");
    try {
      await markRecordingTrackDeleted(trackId);
      await refreshTracks();
      setMessage("녹음을 삭제했습니다.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "녹음을 삭제하지 못했습니다.");
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
          <Link href={`/setlists/${setlist.id}/songs/${song.id}/guide-track`} className="btn-secondary mt-5">가이드 트랙으로</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6 pb-24">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-violet-50 via-white to-blue-50 p-5 sm:p-7">
          <Link href={`/setlists/${setlist.id}/songs/${song.id}/guide-track`} className="text-sm font-bold text-blue-700">
            가이드 트랙으로 돌아가기
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-black text-white">실험실</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">Cloudflare R2 저장</span>
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">팀 녹음실</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">{song.title} · Key {guideData.key || "-"} · BPM {guideData.bpm ?? "-"} · {guideData.timeSignature}</p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            가이드 트랙을 들으면서 내 파트를 녹음하고 팀원들과 공유할 수 있습니다. 처음 버전은 마이크 입력을 지원합니다.
          </p>
        </div>
      </section>

      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error || recorder.error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error || recorder.error}</p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="text-lg font-black text-slate-950">가이드 트랙 플레이어</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              녹음 전 가이드 트랙의 카운트인과 메트로놈을 확인해 주세요. MVP에서는 녹음과 가이드 트랙이 별도 컨트롤로 동작합니다.
            </p>
            <div className="mt-4">
              <GuideTrackPreviewPlayer data={guideData} />
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
            <h2 className="font-black">녹음 전 안내</h2>
            <p className="mt-2">녹음 중에는 화면을 끄거나 다른 앱으로 이동하지 않는 것을 권장합니다.</p>
            <p className="mt-1">iPhone Safari와 일부 브라우저에서는 녹음 지원이 제한될 수 있습니다. 문제가 있으면 Safari 또는 Chrome 최신 버전에서 다시 시도해 주세요.</p>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">내 파트 녹음</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">마이크 권한을 허용하고 파트를 선택한 뒤 녹음을 시작하세요.</p>
              </div>
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{recorder.state}</span>
            </div>

            {!recorder.supported ? (
              <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
                이 브라우저에서는 녹음 기능을 지원하지 않을 수 있습니다. Safari 또는 Chrome 최신 버전에서 다시 시도해 주세요.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-xs font-black text-slate-500">녹음 시간</p>
                  <p className={recorder.state === "recording" ? "mt-1 text-4xl font-black text-rose-600" : "mt-1 text-4xl font-black text-slate-950"}>
                    {formatDuration(recorder.durationSeconds)}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {recorder.state === "recording" ? (
                    <button type="button" onClick={recorder.stopRecording} className="min-h-14 rounded-xl bg-rose-600 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-rose-700">
                      녹음 중지
                    </button>
                  ) : (
                    <button type="button" onClick={recorder.startRecording} disabled={!recorder.canRecord} className="min-h-14 rounded-xl bg-blue-600 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                      녹음 시작
                    </button>
                  )}
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
            )}
          </section>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">팀 녹음 목록</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">같은 팀의 승인된 팀원만 녹음 파일을 들을 수 있습니다.</p>
          </div>
          <button type="button" onClick={refreshTracks} className="btn-secondary">목록 새로고침</button>
        </div>

        {tracks.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            아직 저장된 녹음이 없습니다. 내 파트를 녹음해 팀원들과 공유해보세요.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {tracks.map((track) => {
              const canDelete = track.userId === myUserId || canManage;
              return (
                <article key={track.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-black text-slate-950">{track.title}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {track.profile?.displayName || "팀원"} · {track.part || "파트 미지정"} · {formatDateTime(track.createdAt)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {formatDuration(track.durationSeconds ?? 0)} · {formatBytes(track.sizeBytes ?? 0)} · {track.inputType}
                      </p>
                      {track.notes ? <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{track.notes}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadReadUrl(track.id)}
                        className="btn-primary"
                        disabled={loadingReadTrackId === track.id}
                      >
                        {loadingReadTrackId === track.id ? "준비 중..." : "재생 준비"}
                      </button>
                      {canDelete ? (
                        <button type="button" onClick={() => handleDeleteTrack(track.id)} className="btn-secondary">
                          삭제
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {readUrls[track.id] ? <audio controls src={readUrls[track.id]} className="mt-4 w-full" /> : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "크기 미확인";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
