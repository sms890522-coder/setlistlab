"use client";

import { JoinTeamForm } from "@/components/JoinTeamForm";

export default function JoinTeamPage() {
  return (
    <div className="page-shell max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-bold text-blue-700">팀 참여</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">초대코드로 팀 참여하기</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          초대코드는 팀을 찾기 위한 고유 코드입니다. 초대코드를 입력하면 참여 요청이 리더에게 전달됩니다.
        </p>
      </section>
      <JoinTeamForm />
    </div>
  );
}
