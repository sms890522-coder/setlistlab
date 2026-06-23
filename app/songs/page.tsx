"use client";

import Link from "next/link";
import { createBlankSong } from "@/lib/factories";
import { SongTagsEditor } from "@/components/SongTagsEditor";
import { deleteCloudSongFromLibrary, getCloudSongLibrary, saveCloudSongToLibrary } from "@/lib/db/savedSongs";
import { normalizeTagName, updateSongTags } from "@/lib/db/songTags";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { SavedSong, Song } from "@/lib/types";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { FormEvent, useEffect, useMemo, useState } from "react";

export default function SongsPage() {
  const [loaded, setLoaded] = useState(false);
  const [songs, setSongs] = useState<SavedSong[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Song>(() => createBlankSong());
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const allTags = useMemo(() => {
    const tags = new Map<string, string>();
    for (const item of songs) {
      for (const tag of item.tags ?? []) {
        if (!tags.has(tag.normalizedName)) tags.set(tag.normalizedName, tag.name);
      }
    }
    return Array.from(tags.values()).sort((a, b) => a.localeCompare(b, "ko-KR"));
  }, [songs]);

  const filteredSongs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    const normalizedSelectedTags = selectedTags.map(normalizeTagName);
    return songs.filter((item) => {
      const songTagNames = item.tags?.map((tag) => tag.name) ?? [];
      const songNormalizedTags = new Set(item.tags?.map((tag) => tag.normalizedName) ?? []);
      const matchesQuery = !normalizedQuery || [
        item.song.title,
        item.song.description,
        item.song.originalKey,
        item.song.practiceKey,
        item.song.chordMemo,
        item.song.highlights.join(" "),
        songTagNames.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(normalizedQuery);
      const matchesTags = normalizedSelectedTags.every((tag) => songNormalizedTags.has(tag));
      return matchesQuery && matchesTags;
    });
  }, [query, selectedTags, songs]);

  useEffect(() => {
    async function loadSongs() {
      if (!isSupabaseConfigured()) {
        setLoaded(true);
        return;
      }

      setSongs(await getCloudSongLibrary());
      setLoaded(true);
    }

    loadSongs().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "곡 보관함을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, []);

  function resetForm() {
    setEditingId(null);
    setDraft(createBlankSong());
    setDraftTags([]);
  }

  function selectSong(savedSong: SavedSong) {
    setEditingId(savedSong.id);
    setDraft({ ...savedSong.song });
    setDraftTags((savedSong.tags ?? []).map((tag) => tag.name));
    setMessage("");
    setError("");
  }

  function toggleTagFilter(tag: string) {
    const normalized = normalizeTagName(tag);
    setSelectedTags((current) =>
      current.some((item) => normalizeTagName(item) === normalized)
        ? current.filter((item) => normalizeTagName(item) !== normalized)
        : [...current, tag],
    );
  }

  function updateDraft(patch: Partial<Song>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (patch.youtubeUrl !== undefined) {
        next.youtubeVideoId = extractYouTubeVideoId(patch.youtubeUrl);
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!draft.title.trim()) {
      setError("곡 제목을 입력해 주세요.");
      return;
    }

    if (draft.youtubeUrl && !/^https?:\/\//i.test(draft.youtubeUrl)) {
      setError("유튜브 링크는 http:// 또는 https://로 시작해야 합니다.");
      return;
    }

    try {
      const saved = await saveCloudSongToLibrary(draft, true);
      await updateSongTags(saved.id, draftTags);
      setSongs(await getCloudSongLibrary());
      setMessage(`${saved.song.title}을 보관함에 저장했습니다.`);
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "곡을 저장하지 못했습니다.");
    }
  }

  async function handleDelete(id: string) {
    const target = songs.find((item) => item.id === id);
    if (!target || !window.confirm(`${target.song.title} 곡을 보관함에서 삭제할까요?`)) return;

    try {
      await deleteCloudSongFromLibrary(id);
      setSongs((current) => current.filter((item) => item.id !== id));
      if (editingId === id) resetForm();
      setMessage("곡을 삭제했습니다.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "곡을 삭제하지 못했습니다.");
    }
  }

  return (
    <div className="page-shell space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">곡 보관함</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">곡 보관함</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            자주 쓰는 곡 정보를 계정에 저장해두고 새 콘티에서 다시 불러올 수 있습니다.
          </p>
        </div>
        <Link href="/setlists" className="btn-secondary">
          콘티 목록
        </Link>
      </section>

      {!loaded ? (
        <div className="card p-8 text-sm text-slate-500">곡 보관함을 불러오는 중입니다.</div>
      ) : !isSupabaseConfigured() ? (
        <section className="card p-6">
          <h2 className="text-xl font-black text-slate-950">로그인 저장 설정이 필요합니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            곡 보관함 페이지는 계정 클라우드 저장을 켠 뒤 사용할 수 있습니다.
          </p>
        </section>
      ) : (
        <>
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{editingId ? "곡 수정" : "곡 추가"}</h2>
                <p className="field-help">세부 구성과 파트 메모는 콘티 안에서 저장하면 보관함에도 함께 저장할 수 있습니다.</p>
              </div>
              {editingId ? (
                <button type="button" onClick={resetForm} className="btn-secondary min-h-10 px-3">
                  추가 모드
                </button>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="space-y-1 lg:col-span-2">
                <span className="field-label">곡 제목</span>
                <input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} className="field-input" />
              </label>
              <label className="space-y-1 lg:col-span-2">
                <span className="field-label">설명</span>
                <textarea
                  value={draft.description ?? ""}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                  className="field-input min-h-20 resize-y"
                />
              </label>
              <label className="space-y-1 lg:col-span-2">
                <span className="field-label">유튜브 링크</span>
                <input
                  value={draft.youtubeUrl ?? ""}
                  onChange={(event) => updateDraft({ youtubeUrl: event.target.value })}
                  className="field-input"
                  placeholder="https://youtu.be/..."
                />
              </label>
              <label className="space-y-1">
                <span className="field-label">원키</span>
                <input value={draft.originalKey ?? ""} onChange={(event) => updateDraft({ originalKey: event.target.value })} className="field-input" />
              </label>
              <label className="space-y-1">
                <span className="field-label">연습키</span>
                <input value={draft.practiceKey ?? ""} onChange={(event) => updateDraft({ practiceKey: event.target.value })} className="field-input" />
              </label>
              <label className="space-y-1">
                <span className="field-label">BPM</span>
                <input
                  value={draft.bpm ?? ""}
                  onChange={(event) => updateDraft({ bpm: event.target.value ? Number(event.target.value) : undefined })}
                  className="field-input"
                  type="number"
                  min="1"
                />
              </label>
              <label className="space-y-1">
                <span className="field-label">코드폼 / 카포</span>
                <input
                  value={[draft.chordForm ? `${draft.chordForm}폼` : "", typeof draft.capo === "number" ? `카포 ${draft.capo}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                  readOnly
                  className="field-input bg-slate-50"
                  placeholder="콘티 곡 수정 화면에서 설정"
                />
              </label>
              <label className="space-y-1 lg:col-span-2">
                <span className="field-label">코드 메모</span>
                <textarea
                  value={draft.chordMemo ?? ""}
                  onChange={(event) => updateDraft({ chordMemo: event.target.value })}
                  className="field-input min-h-24 resize-y"
                  placeholder="이번 주 연습키, 코드폼, 참고할 연주 메모"
                />
              </label>
              <label className="space-y-1 lg:col-span-2">
                <span className="field-label">코드 진행</span>
                <textarea
                  value={draft.chordProgression ?? ""}
                  onChange={(event) => updateDraft({ chordProgression: event.target.value })}
                  className="field-input min-h-20 resize-y font-mono text-sm"
                  placeholder="G - D - Em - C"
                />
              </label>
              <SongTagsEditor tags={draftTags} onChange={setDraftTags} usedTags={allTags} />
              <button type="submit" className="btn-primary lg:col-span-2">
                {editingId ? "수정 저장" : "보관함에 저장"}
              </button>
            </form>

            {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
            {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          </section>

          <section className="card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="section-title">저장된 곡</h2>
                <p className="field-help">{songs.length}곡 저장됨</p>
              </div>
              <label className="w-full sm:max-w-xs">
                <span className="sr-only">곡 검색</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="field-input" placeholder="곡 검색" />
              </label>
            </div>

            {allTags.length > 0 ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="field-label">태그 필터</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">여러 태그를 선택하면 모두 포함한 곡만 보여줍니다.</p>
                  </div>
                  {selectedTags.length > 0 ? (
                    <button type="button" onClick={() => setSelectedTags([])} className="btn-secondary min-h-9 px-3 text-xs">
                      필터 초기화
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {allTags.map((tag) => {
                    const selected = selectedTags.some((item) => normalizeTagName(item) === normalizeTagName(tag));
                    return (
                      <button
                        key={normalizeTagName(tag)}
                        type="button"
                        onClick={() => toggleTagFilter(tag)}
                        className={
                          selected
                            ? "rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white"
                            : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        }
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {songs.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                자주 부르는 곡을 저장해두면 콘티를 더 빠르게 만들 수 있습니다.
              </div>
            ) : filteredSongs.length === 0 ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                <p>{selectedTags.length > 0 || query.trim() ? "검색어와 태그 조건에 맞는 곡이 없습니다." : "검색 결과가 없습니다."}</p>
                {selectedTags.length > 0 ? (
                  <button type="button" onClick={() => setSelectedTags([])} className="btn-secondary mt-3 min-h-10 px-3">
                    필터 초기화
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {filteredSongs.map((item) => (
                  <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <h3 className="font-black text-slate-950">{item.song.title || "제목 없는 곡"}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      연습키 {item.song.practiceKey || "-"} · BPM {item.song.bpm ?? "-"}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
                      {item.song.sections.map((section) => section.name).join(" - ") || item.song.description || "곡 설명 없음"}
                    </p>
                    <SongTagBadges tags={(item.tags ?? []).map((tag) => tag.name)} />
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => selectSong(item)} className="btn-secondary min-h-10 flex-1 px-3">
                        수정
                      </button>
                      <button type="button" onClick={() => handleDelete(item.id)} className="btn-danger min-h-10 px-3">
                        삭제
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SongTagBadges({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  const visibleTags = tags.slice(0, 3);
  const remainingCount = tags.length - visibleTags.length;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {visibleTags.map((tag) => (
        <span key={normalizeTagName(tag)} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
          #{tag}
        </span>
      ))}
      {remainingCount > 0 ? (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">+{remainingCount}</span>
      ) : null}
    </div>
  );
}
