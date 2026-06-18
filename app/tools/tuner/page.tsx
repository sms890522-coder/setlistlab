import { Suspense } from "react";
import { TunerToolsPage } from "@/components/TunerToolsPage";

export default function TunerPage() {
  return (
    <Suspense fallback={<div className="page-shell py-20 text-sm font-semibold text-slate-500">연습 도구를 준비하는 중입니다.</div>}>
      <TunerToolsPage />
    </Suspense>
  );
}
