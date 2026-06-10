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
        unsubscribe = subscribeTeamMessages(
        team.id,
        (message, event) => {
          // 기존 메시지 반영 로직
        },
        (status, realtimeError) => {
          console.error("TeamChatPanel realtime status error", {
            status,
            realtimeError,
            teamId: team.id,
          });
      
          setError(
            "실시간 연결이 일시적으로 끊겼습니다. 메시지는 보낼 수 있으며, 새 메시지는 새로고침 후 확인될 수 있습니다."
          );
        }
      );
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
    <section
      className={
        compact
          ? "flex h-full min-h-0 flex-col overflow-hidden bg-white"
          : "card flex h-[calc(100dvh-120px)] min-h-[520px] flex-col overflow-hidden"
      }    
    >
      <div className="shrink-0 border-b border-slate-100 p-4">
        <p className="text-sm font-semibold text-blue-600">팀 채팅</p>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          승인된 팀원만 이 채팅을 볼 수 있습니다.
        </p>
      </div>
  
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!loaded ? (
          <p className="text-sm text-slate-500">메시지를 불러오는 중입니다.</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500">
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
                <div
                  key={message.id}
                  className={isMine ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      isMine
                        ? "max-w-[82%] rounded-2xl bg-blue-600 px-4 py-3 text-white"
                        : "max-w-[82%] rounded-2xl bg-slate-100 px-4 py-3 text-slate-900"
                    }
                  >
                    <p className="mb-1 text-xs font-semibold opacity-80">
                      {formatMemberNameWithEmoji(role, name)}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {message.message}
                    </p>
                    <p className="mt-1 text-right text-[11px] opacity-70">
                      {formatChatTime(message.createdAt)}
                      {isMine ? ` · 읽음 ${readCount}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>
  
      {error ? (
        <div className="shrink-0 border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          {error}
        </div>
      ) : null}
  
      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-slate-100 bg-white p-3"
      >
        <div className="flex gap-2">
          <input
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            className="field-input min-h-11 flex-1 text-base"
            maxLength={500}
            placeholder="메시지 입력"
          />
          <button
            type="submit"
            disabled={!messageText.trim() || sending}
            className="btn-primary min-h-11 px-4"
          >
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
