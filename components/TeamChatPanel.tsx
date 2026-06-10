"use client";

import { getCurrentUser } from "@/lib/auth";
import { sendTeamMessage, subscribeTeamMessages, getTeamMessages, markTeamMessagesRead, type TeamChatMessage } from "@/lib/db/teamChat";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import type { Team } from "@/lib/db/teams";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TeamChatPanelProps = {
  team: Team;
  compact?: boolean;
};

export function TeamChatPanel({ team, compact = false }: TeamChatPanelProps) {
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const title = useMemo(() => `${team.churchName} · ${team.teamName}`, [team]);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      const [nextMessages, currentUser] = await Promise.all([getTeamMessages(team.id), getCurrentUser()]);
      if (cancelled) return;
      currentUserIdRef.current = currentUser?.id ?? null;
      setMessages(currentUser ? markMessagesReadLocally(nextMessages, currentUser.id) : nextMessages);
      setLoaded(true);
      if (currentUser) {
        void markTeamMessagesRead(team.id).catch(() => undefined);
      }
    }

    loadMessages().catch((loadError) => {
      if (cancelled) return;
      setError(loadError instanceof Error ? loadError.message : "팀 채팅을 불러오지 못했습니다.");
      setLoaded(true);
    });

     let unsubscribe: (() => void) | undefined;
      
      try {
        unsubscribe = subscribeTeamMessages(team.id, (message, event) => {
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
        }
      });
    } catch (error) {
      console.error("TeamChatPanel subscribeTeamMessages error", error);
      setError("실시간 채팅 연결에 실패했습니다. 새로고침 후 다시 시도해 주세요.");
    }
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [team.id]);

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
    <section className={compact ? "flex h-full flex-col bg-white" : "card flex min-h-[70vh] flex-col overflow-hidden"}>
      <div className={compact ? "border-b border-slate-100 p-3" : "border-b border-slate-100 p-5"}>
        <p className="text-xs font-black text-blue-700">팀 채팅</p>
        <h2 className={compact ? "truncate font-black text-slate-950" : "mt-1 text-2xl font-black text-slate-950"}>{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">승인된 팀원만 이 채팅을 볼 수 있습니다.</p>
      </div>

      <div className={`flex-1 overflow-y-auto bg-slate-50 ${compact ? "p-3" : "p-4 sm:p-5"}`}>
        {!loaded ? (
          <p className="rounded-xl bg-white p-4 text-sm font-semibold text-slate-500">메시지를 불러오는 중입니다.</p>
        ) : messages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
            아직 메시지가 없습니다. 첫 인사를 남겨보세요.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const role = getRole(message);
              const name = message.profile?.displayName || "팀원";
              const isMine = message.userId === currentUserIdRef.current;
              const readCount = getReadCount(message);
              return (
                <div key={message.id} className={isMine ? "flex justify-end" : "flex justify-start"}>
                  <article
                    className={
                      isMine
                        ? "max-w-[88%] rounded-2xl bg-blue-600 px-4 py-3 text-white shadow-sm"
                        : "max-w-[88%] rounded-2xl bg-white px-4 py-3 text-slate-800 shadow-sm"
                    }
                  >
                    <p className={isMine ? "text-xs font-black text-blue-100" : "text-xs font-black text-slate-600"}>
                      {formatMemberNameWithEmoji(role, name)}
                    </p>
                    <p className="mt-1 whitespace-pre-line break-words text-sm leading-6">{message.message}</p>
                    <p className={isMine ? "mt-1 text-right text-[11px] font-semibold text-blue-100" : "mt-1 text-right text-[11px] font-semibold text-slate-400"}>
                      {formatChatTime(message.createdAt)}
                      {isMine ? ` · 읽음 ${readCount}` : ""}
                    </p>
                  </article>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-100 bg-white p-3">
        {error ? <p className="mb-2 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">{error}</p> : null}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            className="field-input text-base"
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
