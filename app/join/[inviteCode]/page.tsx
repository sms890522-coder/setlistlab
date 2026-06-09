"use client";

import { JoinTeamForm } from "@/components/JoinTeamForm";
import { useParams } from "next/navigation";

export default function InviteLinkPage() {
  const params = useParams<{ inviteCode: string }>();

  return (
    <div className="page-shell max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-bold text-blue-700">팀 초대</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">초대받은 팀 확인</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          로그인 후 참여 요청을 보내면 리더가 승인한 뒤 팀 채팅과 콘티를 사용할 수 있습니다.
        </p>
      </section>
      <JoinTeamForm initialInviteCode={params.inviteCode} />
    </div>
  );
}
