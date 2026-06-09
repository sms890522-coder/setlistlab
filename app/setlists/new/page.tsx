import { NewSetlistCreator } from "@/components/NewSetlistCreator";
import { Suspense } from "react";

export default function NewSetlistPage() {
  return (
    <Suspense fallback={<div className="page-shell"><div className="card p-8 text-sm text-slate-500">새 콘티 화면을 준비하는 중입니다.</div></div>}>
      <NewSetlistCreator />
    </Suspense>
  );
}
