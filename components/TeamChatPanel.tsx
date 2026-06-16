"use client";

import { getCurrentUser } from "@/lib/auth";
import { markTeamChatNotificationsRead } from "@/lib/db/notifications";
import { getMyProfile, type Profile } from "@/lib/db/profiles";
import {
  getTeamMessages,
  markTeamMessagesRead,
  sendTeamMessage,
  subscribeTeamChatPresence,
  subscribeTeamMessages,
  type TeamChatMessage,
  type TeamChatPresence,
} from "@/lib/db/teamChat";
import type { Team } from "@/lib/db/teams";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TeamChatPanelProps = {
  team: Team;
  compact?: boolean;
  compactTitle?: string;
  onClose?: () => void;
};

export function TeamChatPanel({ team, compact = false, compactTitle, onClose }: TeamChatPanelProps) {
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [onlineMembers, setOnlineMembers] = useState<TeamChatPresence[]>([]);
  const [myPresence, setMyPresence] = useState<TeamChatPresence | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const title = useMemo(() => `${team.churchName} · ${team.teamName}`, [team]);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      const [currentUser, profile] = await Promise.all([getCurrentUser(), getMyProfile().catch(() => null)]);
      if (cancelled) return;

      currentUserIdRef.current = currentUser?.id ?? null;
      if (!currentUser) {
        setMyPresence(null);
        setOnlineMembers([]);
        return;
      }

      const presence = {
        userId: currentUser.id,
        displayName: profile?.displayName || currentUser.email?.split("@")[0] || "팀원",
        role: getProfileRole(profile),
        onlineAt: new Date().toISOString(),
      };
      setMyPresence(presence);
      setOnlineMembers((current) => (current.length === 0 ? [presence] : current));
    }

    async function loadMessages() {
      const nextMessages = await getTeamMessages(team.id);
      if (cancelled) return;

      const currentUserId = currentUserIdRef.current;
      setMessages(currentUserId ? markMessagesReadLocally(nextMessages, currentUserId) : nextMessages);
      setLoaded(true);
      setError("");

      if (currentUserId) {
        void markTeamMessagesRead(team.id).catch(() => undefined);
        void markTeamChatNotificationsRead(team.id).catch(() => undefined);
      }
    }

    void loadMe().then(() => loadMessages()).catch((loadError) => {
      if (cancelled) return;
      setError(loadError instanceof Error ? loadError.message : "팀 채팅을 불러오지 못했습니다.");
      setLoaded(true);
    });

    const unsubscribe = subscribeTeamMessages(
      team.id,
      (message, event) => {
        const currentUserId = currentUserIdRef.current;
        const nextMessage =
          event === "INSERT" && currentUserId && message.userId !== currentUserId ? markMessageReadLocally(message, currentUserId) : message;

        setMessages((current) => {
          const existingIndex = current.findIndex((item) => item.id === nextMessage.id);
          if (existingIndex >= 0) {
            return current.map((item) => (item.id === nextMessage.id ? { ...item, ...nextMessage, profile: nextMessage.profile ?? item.profile } : item));
          }

          return [...current, nextMessage].slice(-150);
        });

        if (event === "INSERT" && currentUserId && message.userId !== currentUserId) {
          void markTeamMessagesRead(team.id).catch(() => undefined);
          void markTeamChatNotificationsRead(team.id).catch(() => undefined);
        }
      },
      () => undefined,
    );

    const pollingId = window.setInterval(() => {
      loadMessages().catch(() => undefined);
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(pollingId);
      unsubscribe();
    };
  }, [team.id]);

  useEffect(() => {
    if (!myPresence) return;

    setOnlineMembers((current) => (current.some((member) => member.userId === myPresence.userId) ? current : [myPresence, ...current]));
    const unsubscribe = subscribeTeamChatPresence(team.id, myPresence, (members) => {
      setOnlineMembers(members.some((member) => member.userId === myPresence.userId) ? members : [myPresence, ...members]);
    });

    return () => {
      unsubscribe();
    };
  }, [myPresence, team.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed) return;

    try {
      setSending(true);
      setError("");
      const nextMessage = await sendTeamMessage(team.id, trimmed);
      setMessages((current) => {
        if (current.some((message) => message.id === nextMessage.id)) return current;
        return [...current, nextMessage].slice(-150);
      });
      setMessageText("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "메시지를 보내지 못했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      className={
        compact
          ? "flex h-full min-h-0 flex-col overflow-hidden bg-white"
          : "card flex h-[calc(100dvh-120px)] min-h-[520px] flex-col overflow-hidden"
      }
    >
      <div className={compact ? "shrink-0 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50 p-3" : "shrink-0 border-b border-slate-100 p-4"}>
        {compact ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-black text-slate-950">{compactTitle || team.teamName}</h2>
                <p className="mt-0.5 text-[11px] font-bold text-slate-500">온라인 {onlineMembers.length}명</p>
              </div>
              {onClose ? (
                <button type="button" onClick={onClose} className="btn-secondary min-h-8 px-3 text-xs">
                  닫기
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
              {onlineMembers.length === 0 ? (
                <span className="whitespace-nowrap text-xs font-semibold text-slate-400">온라인 상태 확인 중</span>
              ) : (
                onlineMembers.map((member) => (
                  <span
                    key={member.userId}
                    className="shrink-0 rounded-full border border-blue-100 bg-white/80 px-2 py-0.5 text-[11px] font-bold text-blue-800"
                  >
                    {formatMemberNameWithEmoji(member.role, member.displayName)}
                  </span>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">승인된 팀원만 이 채팅을 볼 수 있습니다.</p>
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-slate-500">온라인 팀원</p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">{onlineMembers.length}명</span>
              </div>
              <div className="mt-2 flex max-h-14 flex-wrap gap-1.5 overflow-y-auto">
                {onlineMembers.length === 0 ? (
                  <span className="text-xs font-semibold text-slate-400">온라인 상태를 확인하는 중입니다.</span>
                ) : (
                  onlineMembers.map((member) => (
                    <span key={member.userId} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800">
                      {formatMemberNameWithEmoji(member.role, member.displayName)}
                    </span>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className={compact ? "min-h-0 flex-1 overflow-y-auto p-3" : "min-h-0 flex-1 overflow-y-auto p-4"}>
        {!loaded ? (
          <p className="text-sm text-slate-500">메시지를 불러오는 중입니다.</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500">아직 메시지가 없습니다. 첫 인사를 남겨보세요.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const role = getRole(message);
              const name = message.profile?.displayName || "팀원";
              const isMine = message.userId === currentUserIdRef.current;
              const readCount = getReadCount(message);

              return (
                <div key={message.id} className={isMine ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      isMine
                        ? "max-w-[82%] rounded-2xl bg-blue-600 px-4 py-3 text-white"
                        : "max-w-[82%] rounded-2xl bg-slate-100 px-4 py-3 text-slate-900"
                    }
                  >
                    <p className="mb-1 text-xs font-semibold opacity-80">{formatMemberNameWithEmoji(role, name)}</p>
                    <p className="whitespace-pre-wrap break-words text-sm">{message.message}</p>
                    <p className="mt-1 text-right text-[11px] opacity-70">
                      {formatChatTime(message.createdAt)}
                      {` · 읽음 ${readCount}`}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {error ? <div className="shrink-0 border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">{error}</div> : null}

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-100 bg-white p-3">
        <div className="flex gap-2">
          <input
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            className="field-input min-h-11 flex-1 text-base"
            maxLength={500}
            placeholder="메시지 입력"
          />
          <button type="submit" disabled={!messageText.trim() || sending} className="btn-primary min-h-11 px-4">
            전송
          </button>
        </div>
      </form>
    </section>
  );
}

function getRole(message: TeamChatMessage) {
  const profile = message.profile;
  if (!profile) return "팀원";
  if (profile.role === "기타" && profile.customRole) return profile.customRole;
  return profile.role || "팀원";
}

function getProfileRole(profile: Profile | null) {
  if (!profile) return "팀원";
  if (profile.role === "기타" && profile.customRole) return profile.customRole;
  return profile.role || "팀원";
}

function getReadCount(message: TeamChatMessage) {
  return message.readBy.filter((readerId) => readerId !== message.userId).length;
}

function markMessagesReadLocally(messages: TeamChatMessage[], userId: string) {
  return messages.map((message) => markMessageReadLocally(message, userId));
}

function markMessageReadLocally(message: TeamChatMessage, userId: string): TeamChatMessage {
  if (message.readBy.includes(userId)) return message;
  return { ...message, readBy: [...message.readBy, userId] };
}

function formatChatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
