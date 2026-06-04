"use client";

import Link from "next/link";
import { SetlistCard } from "@/components/SetlistCard";
import { deleteSetlist, duplicateSetlist, getSetlists } from "@/lib/storage";
import type { Setlist } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SetlistsPage() {
  const router = useRouter();
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Setlist | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setSetlists(getSetlists());
    setLoaded(true);
  }, []);

  function handleDeleteRequest(id: string) {
    setDeleteTarget(setlists.find((setlist) => setlist.id === id) ?? null);
    setDeleteError("");
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;

    try {
      deleteSetlist(deleteTarget.id);
      setSetlists((current) => current.filter((setlist) => setlist.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteError("");
    } catch {
      setDeleteError("콘티를 삭제하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.");
    }
  }

  function handleDuplicate(id: string) {
    const duplicated = duplicateSetlist(id);
    router.push(`/setlists/${duplicated.id}/edit`);
  }

  return (
    <div className="page-shell space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">Setlists</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">콘티 목록</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            localStorage에 저장된 콘티를 다시 열고 수정할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/setlists/new" className="btn-primary">
            새 콘티 만들기
          </Link>
        </div>
      </section>

      {!loaded ? (
        <div className="card p-8 text-sm text-slate-500">콘티를 불러오는 중입니다.</div>
      ) : setlists.length === 0 ? (
        <div className="card grid gap-4 p-8 text-center">
          <div>
            <h2 className="text-xl font-black text-slate-950">아직 콘티가 없습니다</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              이번 주 예배 콘티를 만들어 팀원들과 공유해 보세요.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/setlists/new" className="btn-primary">
              새 콘티 만들기
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {setlists.map((setlist) => (
            <SetlistCard
              key={setlist.id}
              setlist={setlist}
              onDelete={handleDeleteRequest}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={() => setDeleteTarget(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-setlist-title"
            className="card w-full max-w-md p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-bold text-rose-600">콘티 삭제</p>
            <h2 id="delete-setlist-title" className="mt-2 text-xl font-black text-slate-950">
              {deleteTarget.title || "제목 없는 콘티"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              이 콘티를 삭제할까요? 삭제한 콘티는 되돌릴 수 없습니다.
            </p>
            {deleteError ? (
              <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{deleteError}</p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary">
                취소
              </button>
              <button type="button" onClick={handleDeleteConfirm} className="btn-danger">
                삭제하기
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
