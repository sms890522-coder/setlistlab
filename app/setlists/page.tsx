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

  useEffect(() => {
    setSetlists(getSetlists());
    setLoaded(true);
  }, []);

  function handleDelete(id: string) {
    if (!window.confirm("이 콘티를 삭제할까요? 삭제한 콘티는 되돌릴 수 없습니다.")) return;
    deleteSetlist(id);
    setSetlists(getSetlists());
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
            <SetlistCard key={setlist.id} setlist={setlist} onDelete={handleDelete} onDuplicate={handleDuplicate} />
          ))}
        </div>
      )}
    </div>
  );
}
