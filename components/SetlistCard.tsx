import Link from "next/link";
import type { Setlist } from "@/lib/types";

type SetlistCardProps = {
  setlist: Setlist;
  commentCount?: number;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
};

export function SetlistCard({ setlist, commentCount, onDelete, onDuplicate }: SetlistCardProps) {
  const songCount = setlist.songs.length;

  return (
    <article className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-blue-700">
            {setlist.worshipDate || "날짜 미정"} · {setlist.serviceName || "예배 이름 미정"}
          </p>
          <h2 className="text-xl font-black text-slate-950">{setlist.title || "제목 없는 콘티"}</h2>
          {setlist.description ? (
            <p className="line-clamp-2 text-sm leading-6 text-slate-600">{setlist.description}</p>
          ) : (
            <p className="text-sm text-slate-400">아직 전체 설명이 없습니다.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold text-slate-600">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">곡 {songCount}개</span>
            {typeof commentCount === "number" ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">댓글 {commentCount}개</span>
            ) : null}
            <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">
              {new Date(setlist.updatedAt).toLocaleDateString("ko-KR")} 수정
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={`/setlists/${setlist.id}`} className="btn-primary min-h-10 px-3">
            보기
          </Link>
          <Link href={`/setlists/${setlist.id}/edit`} className="btn-secondary min-h-10 px-3">
            수정
          </Link>
          {onDuplicate ? (
            <button type="button" onClick={() => onDuplicate(setlist.id)} className="btn-secondary min-h-10 px-3">
              복제
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" onClick={() => onDelete(setlist.id)} className="btn-danger min-h-10 px-3">
              삭제
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
