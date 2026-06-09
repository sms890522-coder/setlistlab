"use client";

import Link from "next/link";
import { TeamAssignmentsView } from "@/components/TeamAssignmentsView";
import { getCurrentUser } from "@/lib/auth";
import { createCloudSetlist, getPublicSetlistBySlug, type CloudSetlist } from "@/lib/db/setlists";
import { cloneSetlist } from "@/lib/factories";
import { getFirstImageLink, getImagePreviewUrl } from "@/lib/images";
import { getPracticeCompletions, saveSetlist, setPracticeCompletion } from "@/lib/storage";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

export default function PublicSetlistPage() {
  const params = useParams<{ shareSlug: string }>();
  const router = useRouter();
  const [setlist, setSetlist] = useState<CloudSetlist | null>(null);
  const [completedSongs, setCompletedSongs] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    async function loadSetlist() {
      const [sharedSetlist, user] = await Promise.all([getPublicSetlistBySlug(params.shareSlug), getCurrentUser()]);
      if (!sharedSetlist) {
        setError("공개 공유 콘티를 찾을 수 없습니다.");
        setLoaded(true);
        return;
      }

      setSetlist(sharedSetlist);
      setIsOwner(Boolean(user && sharedSetlist.ownerId === user.id));
      setCompletedSongs(getPracticeCompletions(sharedSetlist.id));
      setLoaded(true);
    }

    loadSetlist().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "공유 콘티를 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.shareSlug]);

  function toggleCompletion(songId: string, completed: boolean) {
    if (!setlist) return;
    setPracticeCompletion(setlist.id, songId, completed);
    setCompletedSongs((current) => ({ ...current, [songId]: completed }));
  }

  async function copyToMyPracticeRoom() {
    if (!setlist) return;

    try {
      setCopying(true);
      setCopyMessage("");
      setCopyError("");

      const copiedSetlist = cloneSetlist(setlist);
      const user = await getCurrentUser();
      const savedSetlist = user ? await createCloudSetlist(copiedSetlist) : saveSetlist(copiedSetlist);

      setCopyMessage("내 연습실에 복사했습니다. 이제 자유롭게 수정할 수 있습니다.");
      router.push(`/setlists/${savedSetlist.id}/edit`);
    } catch (copyError) {
      setCopyError(copyError instanceof Error ? copyError.message : "내 연습실로 복사하지 못했습니다.");
    } finally {
      setCopying(false);
    }
  }

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-sm text-slate-500">공유 콘티를 불러오는 중입니다.</div>
      </div>
    );
  }

  if (error || !setlist) {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">공유 콘티를 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-rose-700">{error || "공유 콘티가 없습니다."}</p>
          <Link href="/" className="btn-primary mt-5">
            홈으로
          </Link>
        </section>
      </div>
    );
  }

  const completedCount = setlist.songs.filter((song) => completedSongs[song.id]).length;

  return (
    <div className="page-shell space-y-6">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 sm:p-7">
          <p className="text-sm font-bold text-blue-700">
            {setlist.worshipDate || "날짜 미정"} · {setlist.serviceName || "예배 이름 미정"}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{setlist.title}</h1>
          {setlist.description ? (
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">{setlist.description}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/s/${params.shareSlug}/play`} className="btn-primary">
              연속재생 시작
            </Link>
            {isOwner ? (
              <Link href={`/setlists/${setlist.id}/edit`} className="btn-secondary">
                원본 수정
              </Link>
            ) : (
              <button type="button" onClick={copyToMyPracticeRoom} disabled={copying} className="btn-secondary">
                {copying ? "복사 중" : "내 연습실로 복사"}
              </button>
            )}
            <Link href="/" className="btn-secondary">
              홈으로
            </Link>
          </div>
          <div className="mt-4 rounded-xl border border-blue-100 bg-white/70 p-3 text-sm leading-6 text-blue-900">
            {isOwner
              ? "이 공유 링크는 원본 콘티를 보여줍니다. 원본을 수정하면 팀원들이 보는 공유 화면에도 최신 내용이 반영됩니다."
              : "이 화면은 만든 사람이 공유한 원본 콘티를 보여줍니다. 원본이 수정되면 공유 화면도 최신 내용으로 바뀌고, 직접 수정하고 싶다면 내 연습실로 복사해 주세요."}
          </div>
          {copyMessage ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{copyMessage}</p> : null}
          {copyError ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{copyError}</p> : null}
        </div>
        {setlist.globalNotes ? (
          <div className="border-t border-slate-100 p-5 sm:p-7">
            <h2 className="font-bold text-slate-950">전체 강조사항</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{setlist.globalNotes}</p>
          </div>
        ) : null}
      </section>

      <TeamAssignmentsView assignments={setlist.teamAssignments} />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">곡 목록</h2>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
              연습 완료 {completedCount}/{setlist.songs.length}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
              {setlist.songs.length}곡
            </span>
          </div>
        </div>

        <div className="grid gap-4">
          {setlist.songs.map((song, index) => (
            <Fragment key={song.id}>
              <article className="card p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <Link
                    href={`/s/${params.shareSlug}/songs/${song.id}`}
                    className="flex min-w-0 flex-1 items-start gap-4 rounded-xl transition hover:opacity-80 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    {getFirstImageLink(song.imageLinks) ? (
                      <img
                        src={getImagePreviewUrl(getFirstImageLink(song.imageLinks)?.url)}
                        alt=""
                        className="hidden h-20 w-20 shrink-0 rounded-lg border border-slate-100 object-cover sm:block"
                        loading="lazy"
                        aria-hidden="true"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-black text-slate-950">{song.title || "제목 없는 곡"}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        연습키 {song.practiceKey || "-"} · BPM {song.bpm ?? "-"}
                      </p>
                      {song.description ? (
                        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{song.description}</p>
                      ) : null}
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {song.sections.map((section) => section.name).filter(Boolean).join(" - ") || "곡 구성이 없습니다."}
                      </p>
                      {song.highlights.length > 0 ? (
                        <p className="mt-2 text-sm font-semibold leading-6 text-violet-700">{song.highlights.join(" / ")}</p>
                      ) : null}
                      {song.chordMemo ? (
                        <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                          {song.chordMemo}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                    <input
                      type="checkbox"
                      checked={Boolean(completedSongs[song.id])}
                      onChange={(event) => toggleCompletion(song.id, event.target.checked)}
                      className="size-4 accent-emerald-600"
                    />
                    연습 완료
                  </label>
                </div>
                {(song.sheetLinks?.length ?? 0) > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2 sm:pl-[3.25rem]">
                    {song.sheetLinks
                      ?.filter((link) => /^https?:\/\//i.test(link.url))
                      .map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary min-h-9 px-3"
                        >
                          {link.label || "참고 링크"}
                        </a>
                      ))}
                  </div>
                ) : null}
              </article>
              {song.transitionNote ? (
                <div className="mx-3 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-800">
                  <p className="text-xs font-black text-violet-600">곡 뒤 멘트/기도</p>
                  <p className="mt-1 whitespace-pre-line">{song.transitionNote}</p>
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      </section>
    </div>
  );
}
