"use client";

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { requestJoinTeam } from "@/lib/db/teamMemberships";
import { findTeamByInviteCode, type InviteTeamPreview } from "@/lib/db/teams";
import { DEFAULT_TEAM_PARTS } from "@/lib/types";
import { FormEvent, useEffect, useState } from "react";

type JoinTeamFormProps = {
  initialInviteCode?: string;
};

export function JoinTeamForm({ initialInviteCode = "" }: JoinTeamFormProps) {
  const [signedIn, setSignedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [position, setPosition] = useState<string>(DEFAULT_TEAM_PARTS[1]);
  const [requestedMessage, setRequestedMessage] = useState("");
  const [team, setTeam] = useState<InviteTeamPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setSignedIn(Boolean(user)))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!initialInviteCode) return;
    void lookupTeam(initialInviteCode);
  }, [initialInviteCode]);

  async function lookupTeam(nextInviteCode = inviteCode) {
    setError("");
    setMessage("");
    setTeam(null);

    if (!nextInviteCode.trim()) {
      setError("초대코드를 입력해 주세요.");
      return;
    }

    try {
      setChecking(true);
      const foundTeam = await findTeamByInviteCode(nextInviteCode);
      if (!foundTeam) {
        setError("초대코드를 찾을 수 없습니다.");
        return;
      }
      setTeam(foundTeam);
      if (!foundTeam.inviteEnabled) setError("현재 비활성화된 초대코드입니다.");
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "초대코드를 확인하지 못했습니다.");
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      setRequesting(true);
      await requestJoinTeam(inviteCode, requestedMessage, position);
      setMessage("참여 요청을 보냈습니다. 리더가 승인하면 팀 채팅과 콘티를 사용할 수 있어요.");
      await lookupTeam(inviteCode);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "참여 요청을 보내지 못했습니다.");
    } finally {
      setRequesting(false);
    }
  }

  if (!loaded) {
    return <div className="card p-8 text-sm text-slate-500">초대코드 화면을 준비하는 중입니다.</div>;
  }

  if (!signedIn) {
    return (
      <section className="card p-6">
        <h2 className="text-xl font-black text-slate-950">로그인이 필요합니다</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">로그인 후 초대코드로 팀 참여 요청을 보낼 수 있습니다.</p>
        <Link href={`/login?redirect=${encodeURIComponent(initialInviteCode ? `/join/${initialInviteCode}` : "/teams/join")}`} className="btn-primary mt-5">
          로그인
        </Link>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      <label className="block space-y-1">
        <span className="field-label">초대코드</span>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} className="field-input uppercase" placeholder="SL-7K92Q" />
          <button type="button" onClick={() => lookupTeam()} disabled={checking} className="btn-secondary min-h-11 px-4">
            {checking ? "확인 중" : "팀 확인"}
          </button>
        </div>
      </label>

      {team ? (
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-bold text-blue-700">{team.churchName}</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{team.teamName}</h2>
          {team.description ? <p className="mt-2 text-sm leading-6 text-slate-700">{team.description}</p> : null}
          {team.myStatus ? <p className="mt-2 text-sm font-bold text-blue-800">현재 상태: {statusLabel(team.myStatus)}</p> : null}
        </section>
      ) : null}

      <label className="block space-y-1">
        <span className="field-label">포지션</span>
        <select value={position} onChange={(event) => setPosition(event.target.value)} className="field-input">
          {DEFAULT_TEAM_PARTS.map((part) => (
            <option key={part} value={part}>
              {part}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="field-label">가입 요청 메시지</span>
        <textarea
          value={requestedMessage}
          onChange={(event) => setRequestedMessage(event.target.value)}
          className="field-input min-h-24 resize-y"
          placeholder="리더에게 남길 말을 적어주세요."
        />
      </label>
      <p className="text-sm leading-6 text-slate-500">리더가 승인하면 팀 채팅과 콘티를 사용할 수 있어요.</p>
      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      <button type="submit" disabled={!team || !team.inviteEnabled || requesting} className="btn-primary">
        {requesting ? "요청 보내는 중" : "참여 요청 보내기"}
      </button>
    </form>
  );
}

function statusLabel(status: string) {
  if (status === "pending") return "승인 대기";
  if (status === "approved") return "승인됨";
  if (status === "rejected") return "거절됨";
  if (status === "removed") return "나간 팀";
  return status;
}
