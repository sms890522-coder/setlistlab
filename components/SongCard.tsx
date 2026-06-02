import Link from "next/link";
import type { Song } from "@/lib/types";

type SongCardProps = {
  href: string;
  index: number;
  song: Song;
};

export function SongCard({ href, index, song }: SongCardProps) {
  const sectionSummary = song.sections.map((section) => section.name).filter(Boolean).join(" - ");
  const highlightSummary = song.highlights.filter(Boolean).slice(0, 2).join(" / ");

  return (
    <Link href={href} className="card block p-5 transition hover:-translate-y-0.5 hover:border-blue-200">
      <div className="flex items-start gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-950">{song.title || "제목 없는 곡"}</h3>
              <p className="mt-1 text-sm text-slate-500">
                연습키 {song.practiceKey || "-"} · BPM {song.bpm ?? "-"}
              </p>
            </div>
            {song.youtubeVideoId ? (
              <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                YouTube
              </span>
            ) : null}
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
            {sectionSummary || "곡 구성이 아직 없습니다."}
          </p>
          {highlightSummary ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-violet-700">{highlightSummary}</p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
