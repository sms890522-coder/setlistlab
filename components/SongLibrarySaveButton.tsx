"use client";

import { getCurrentUser } from "@/lib/auth";
import { getCloudSavedSongByTitle, saveCloudSongToLibrary } from "@/lib/db/savedSongs";
import { getSavedSongByTitle, saveSongToLibrary } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { SavedSong, Song } from "@/lib/types";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type SongLibrarySaveButtonProps = {
  song: Song;
  onSaved?: (savedSong: SavedSong, overwritten: boolean) => void;
};

export function SongLibrarySaveButton({ song, onSaved }: SongLibrarySaveButtonProps) {
  const [overwriteTarget, setOverwriteTarget] = useState<SavedSong | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [cloudMode, setCloudMode] = useState(false);

  useEffect(() => {
    setOverwriteTarget(null);
    setStatus("idle");
    setError("");
  }, [song]);

  useEffect(() => {
    let cancelled = false;

    async function loadMode() {
      const user = isSupabaseConfigured() ? await getCurrentUser() : null;
      if (!cancelled) setCloudMode(Boolean(user));
    }

    loadMode();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(overwrite: boolean) {
    try {
      const savedSong = cloudMode ? await saveCloudSongToLibrary(song, overwrite) : saveSongToLibrary(song, overwrite);
      setOverwriteTarget(null);
      setStatus("saved");
      setError("");
      onSaved?.(savedSong, overwrite);
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : "곡을 보관함에 저장하지 못했습니다.");
    }
  }

  async function handleSaveRequest() {
    try {
      const existing = cloudMode ? await getCloudSavedSongByTitle(song.title) : getSavedSongByTitle(song.title);
      if (existing) {
        setOverwriteTarget(existing);
        setStatus("idle");
        setError("");
        return;
      }

      await persist(false);
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : "곡을 보관함에 저장하지 못했습니다.");
    }
  }

  return (
    <>
      <button type="button" onClick={handleSaveRequest} className="btn-secondary min-h-10 px-3">
        {status === "saved" ? "보관함 저장됨" : "보관함 저장"}
      </button>

      {status === "error" && !overwriteTarget ? (
        <p className="w-full rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>
      ) : null}

      {overwriteTarget && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
              role="presentation"
              onClick={() => setOverwriteTarget(null)}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={`overwrite-song-${overwriteTarget.id}`}
                className="card w-full max-w-md p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-sm font-bold text-blue-700">보관함 덮어쓰기</p>
                <h2 id={`overwrite-song-${overwriteTarget.id}`} className="mt-2 text-xl font-black text-slate-950">
                  {song.title || "제목 없는 곡"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  같은 제목의 곡이 이미 보관함에 있습니다. 현재 곡 정보로 덮어쓸까요?
                </p>
                {error ? (
                  <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>
                ) : null}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setOverwriteTarget(null)} className="btn-secondary">
                    아니요
                  </button>
                  <button type="button" onClick={() => persist(true)} className="btn-primary">
                    네, 덮어쓰기
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
