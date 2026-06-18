"use client";

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { markTeamDirectNotificationsRead } from "@/lib/db/notifications";
import {
  getTeamDirectMessages,
  markTeamDirectMessagesRead,
  sendTeamDirectMessage,
  subscribeTeamDirectMessages,
  type TeamDirectConversationSummary,
  type TeamDirectMessage,
} from "@/lib/db/teamDirectMessages";
import type { Team } from "@/lib/db/teams";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type TeamDirectChatPanelProps = {
  team: Team;
  thread: TeamDirectConversationSummary;
};

export function TeamDirectChatPanel({ team, thread }: TeamDirectChatPanelProps) {
  const [messages, setMessages] = useState<TeamDirectMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const otherName = thread.otherProfile?.displayName || "팀원";
  const otherRole = thread.otherPosition || getProfileRole(thread.otherProfile?.role, thread.otherProfile?.customRole);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      const user = await getCurrentUser();
      currentUserIdRef.current = user?.id ?? null;
      const nextMessages = await getTeamDirectMessages(thread.id);
      if (cancelled) return;

      const currentUserId = currentUserIdRef.current;
      setMessages(currentUserId ? markMessagesReadLocally(nextMessages, currentUserId) : nextMessages);
      setLoaded(true);
      setError("");

      if (currentUserId) {
        void markTeamDirectMessagesRead(thread.id).catch(() => undefined);
        void markTeamDirectNotificationsRead(thread.id).catch(() => undefined);
      }
    }

    loadMessages().catch((loadError) => {
      if (cancelled) return;
      setError(loadError instanceof Error ? loadError.message : "1:1 메시지를 불러오지 못했습니다.");
      setLoaded(true);
    });

    const unsubscribe = subscribeTeamDirectMessages(
      thread.id,
      (message, event) => {
        const currentUserId = currentUserIdRef.current;
        const nextMessage =
          event === "INSERT" && currentUserId && message.senderId !== currentUserId ? markMessageReadLocally(message, currentUserId) : message;

        setMessages((current) => {
          const existingIndex = current.findIndex((item) => item.id === nextMessage.id);
          if (existingIndex >= 0) {
            return current.map((item) => (item.id === nextMessage.id ? { ...item, ...nextMessage, profile: nextMessage.profile ?? item.profile } : item));
          }

          return [...current, nextMessage].slice(-180);
        });

        if (event === "INSERT" && currentUserId && message.senderId !== currentUserId) {
          void markTeamDirectMessagesRead(thread.id).catch(() => undefined);
          void markTeamDirectNotificationsRead(thread.id).catch(() => undefined);
        }
      },
      () => undefined,
    );

    const pollingId = window.setInterval(() => {
      loadMessages().catch(() => undefined);
    }, 12000);

    return () => {
      cancelled = true;
      window.clearInterval(pollingId);
      unsubscribe();
    };
  }, [thread.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed) return;

    try {
      setSending(true);
      setError("");
      const nextMessage = await sendTeamDirectMessage(thread.id, trimmed);
      setMessages((current) => {
        if (current.some((message) => message.id === nextMessage.id)) return current;
        return [...current, nextMessage].slice(-180);
      });
      setMessageText("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "메시지를 보내지 못했습니다.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void handleSubmit();
  }

  return (
    <section className="card flex h-[calc(100dvh-112px)] min-h-[560px] flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-blue-700">{team.churchName} · {team.teamName}</p>
            <h1 className="mt-1 truncate text-xl font-black text-slate-950">
              {formatMemberNameWithEmoji(otherRole, otherName)}
            </h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">이 대화는 같은 팀의 두 사람만 볼 수 있습니다.</p>
          </div>
          <Link href={`/teams/${team.id}/direct`} className="btn-secondary min-h-10 shrink-0 px-3">
            목록
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!loaded ? (
          <p className="text-sm text-slate-500">메시지를 불러오는 중입니다.</p>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
            <p className="font-black text-slate-950">아직 메시지가 없습니다.</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">예배 준비와 관련된 확인이 필요할 때 대화를 시작해보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isMine = message.senderId === currentUserIdRef.current;
              const name = message.profile?.displayName || "팀원";
              const role = getProfileRole(message.profile?.role, message.profile?.customRole);
              const readCount = getReadCount(message);

              return (
                <div key={message.id} className={isMine ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      isMine
                        ? "max-w-[84%] rounded-2xl bg-blue-600 px-4 py-3 text-white"
                        : "max-w-[84%] rounded-2xl bg-slate-100 px-4 py-3 text-slate-900"
                    }
                  >
                    <p className="mb-1 text-xs font-semibold opacity-80">{formatMemberNameWithEmoji(role, name)}</p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.message}</p>
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

      {error ? <div className="shrink-0 border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">{error}</div> : null}

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-100 bg-white p-3">
        <div className="flex gap-2">
          <textarea
            value={messageText}
            onChange={(event) => setMessageText(event.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            className="field-input min-h-11 max-h-28 flex-1 resize-none text-base"
            maxLength={500}
            rows={1}
            placeholder="메시지 입력"
          />
          <button type="submit" disabled={!messageText.trim() || sending} className="btn-primary min-h-11 px-4">
            전송
          </button>
        </div>
        <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">{messageText.length}/500</p>
      </form>
    </section>
  );
}

function getReadCount(message: TeamDirectMessage) {
  return message.readBy.filter((readerId) => readerId !== message.senderId).length;
}

function markMessagesReadLocally(messages: TeamDirectMessage[], userId: string) {
  return messages.map((message) => markMessageReadLocally(message, userId));
}

function markMessageReadLocally(message: TeamDirectMessage, userId: string): TeamDirectMessage {
  if (message.readBy.includes(userId)) return message;
  return { ...message, readBy: [...message.readBy, userId] };
}

function getProfileRole(role?: string, customRole?: string) {
  if (role === "기타" && customRole) return customRole;
  return role || "팀원";
}

function formatChatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
