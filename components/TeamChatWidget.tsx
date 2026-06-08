"use client";

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getMyProfile, type Profile } from "@/lib/db/profiles";
import { createId } from "@/lib/id";
import { formatMemberNameWithEmoji, getRoleEmoji } from "@/lib/roleEmoji";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getProfileRole,
  getTeamChatChannelName,
  getTeamLabel,
  isTeamChatMessage,
  isTeamChatReadReceipt,
  type TeamChatMessage,
  type TeamChatPresence,
  type TeamChatReadReceipt,
} from "@/lib/teamChat";
import type { User } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TeamChatChannel = ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]>;
type ChatState = "checking" | "disabled" | "signed-out" | "profile-needed" | "connecting" | "connected" | "error";

const MAX_MESSAGE_LENGTH = 500;

export function TeamChatWidget() {
  const [open, setOpen] = useState(false);
  const [chatState, setChatState] = useState<ChatState>("checking");
  const [statusMessage, setStatusMessage] = useState("팀 채팅을 준비하는 중입니다.");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<TeamChatPresence[]>([]);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [readReceipts, setReadReceipts] = useState<Record<string, string[]>>({});
  const [messageText, setMessageText] = useState("");
  const channelRef = useRef<TeamChatChannel | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const sentReadReceiptKeysRef = useRef<Set<string>>(new Set());

  const teamLabel = profile ? getTeamLabel(profile) : "";
  const myRole = profile ? getProfileRole(profile) : "팀원";
  const canChat = chatState === "connected" && Boolean(channelRef.current && user && profile);
  const unreadCount = 0;

  const visibleMembers = useMemo(() => {
    const byUserId = new Map<string, TeamChatPresence>();
    members.forEach((member) => {
      byUserId.set(member.userId, member);
    });
    return Array.from(byUserId.values()).sort((a, b) => {
      const roleCompare = a.role.localeCompare(b.role, "ko-KR");
      if (roleCompare !== 0) return roleCompare;
      return a.displayName.localeCompare(b.displayName, "ko-KR");
    });
  }, [members]);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      if (!isSupabaseConfigured()) {
        setChatState("disabled");
        setStatusMessage("계정 저장 기능이 준비되면 팀 채팅을 사용할 수 있습니다.");
        return;
      }

      setChatState("checking");
      const currentUser = await getCurrentUser();
      if (cancelled) return;

      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setChatState("signed-out");
        setStatusMessage("로그인하면 같은 찬양팀 팀원과 채팅할 수 있습니다.");
        return;
      }

      const currentProfile = await getMyProfile().catch(() => null);
      if (cancelled) return;

      setUser(currentUser);
      setProfile(currentProfile);

      if (!currentProfile?.churchName?.trim() || !currentProfile.praiseTeamName?.trim()) {
        setChatState("profile-needed");
        setStatusMessage("계정에서 교회 이름과 찬양팀 이름을 저장하면 팀 채팅이 열립니다.");
        return;
      }

      setChatState("connecting");
      setStatusMessage("같은 찬양팀 채팅방에 연결하는 중입니다.");
    }

    loadMe().catch((error) => {
      if (cancelled) return;
      setChatState("error");
      setStatusMessage(error instanceof Error ? error.message : "팀 채팅 정보를 불러오지 못했습니다.");
    });

    if (!isSupabaseConfigured()) {
      return () => {
        cancelled = true;
      };
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadMe().catch(() => undefined);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !user || !profile?.churchName?.trim() || !profile.praiseTeamName?.trim()) {
      setMembers([]);
      return;
    }

    const channelName = getTeamChatChannelName(profile);
    if (!channelName) {
      setMembers([]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: user.id },
      },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        if (!isTeamChatMessage(payload)) return;
        addMessage(payload);
      })
      .on("broadcast", { event: "read" }, ({ payload }) => {
        if (!isTeamChatReadReceipt(payload)) return;
        addReadReceipt(payload);
      })
      .on("presence", { event: "sync" }, () => {
        setMembers(readPresenceMembers(channel));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: user.id,
            displayName: profile.displayName || user.email?.split("@")[0] || "팀원",
            role: getProfileRole(profile),
            onlineAt: new Date().toISOString(),
          } satisfies TeamChatPresence);
          setMembers(readPresenceMembers(channel));
          setChatState("connected");
          setStatusMessage("팀 채팅에 연결되었습니다.");
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setChatState("error");
          setStatusMessage("팀 채팅 연결이 끊겼습니다. 잠시 후 다시 열어 주세요.");
        }
      });

    return () => {
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      setMembers([]);
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [profile, user]);

  useEffect(() => {
    if (!open) return;
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  useEffect(() => {
    if (!open || !user || !channelRef.current) return;

    messages.forEach((message) => {
      if (message.userId !== user.id) {
        void sendReadReceipt(message);
      }
    });
  }, [messages, open, user]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = messageText.trim();

    if (!text || !user || !profile || !channelRef.current) return;

    const message: TeamChatMessage = {
      id: createId("chat"),
      userId: user.id,
      displayName: profile.displayName || user.email?.split("@")[0] || "팀원",
      role: myRole,
      text: text.slice(0, MAX_MESSAGE_LENGTH),
      createdAt: new Date().toISOString(),
    };

    addMessage(message);
    setMessageText("");

    const result = await channelRef.current.send({
      type: "broadcast",
      event: "message",
      payload: message,
    });

    if (result !== "ok") {
      setChatState("error");
      setStatusMessage("메시지를 보내지 못했습니다. 연결 상태를 확인해 주세요.");
    }
  }

  function addMessage(message: TeamChatMessage) {
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) return current;
      return [...current, message].slice(-80);
    });
  }

  function addReadReceipt(receipt: TeamChatReadReceipt) {
    setReadReceipts((current) => {
      const currentReaders = current[receipt.messageId] ?? [];
      if (currentReaders.includes(receipt.userId)) return current;

      return {
        ...current,
        [receipt.messageId]: [...currentReaders, receipt.userId],
      };
    });
  }

  async function sendReadReceipt(message: TeamChatMessage) {
    if (!user || !channelRef.current || message.userId === user.id) return;

    const readKey = `${message.id}:${user.id}`;
    if (sentReadReceiptKeysRef.current.has(readKey)) return;

    sentReadReceiptKeysRef.current.add(readKey);
    const receipt: TeamChatReadReceipt = {
      messageId: message.id,
      userId: user.id,
      readAt: new Date().toISOString(),
    };

    addReadReceipt(receipt);
    await channelRef.current.send({
      type: "broadcast",
      event: "read",
      payload: receipt,
    });
  }

  function getReadCount(message: TeamChatMessage) {
    return (readReceipts[message.id] ?? []).filter((readerId) => readerId !== message.userId).length;
  }

  return (
    <div className="team-chat-widget no-print fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      {open ? (
        <section className="mb-3 flex max-h-[calc(100dvh-6.5rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl sm:max-h-[34rem]">
          <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-blue-700">팀 채팅</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">{teamLabel || "찬양팀 채팅"}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{statusMessage}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary min-h-9 px-3">
                닫기
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {chatState === "disabled" || chatState === "signed-out" || chatState === "profile-needed" ? (
              <div className="space-y-3 p-4">
                <p className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">{statusMessage}</p>
                {chatState === "signed-out" ? (
                  <Link href="/login" className="btn-primary w-full" onClick={() => setOpen(false)}>
                    로그인하기
                  </Link>
                ) : chatState === "profile-needed" ? (
                  <Link href="/account" className="btn-primary w-full" onClick={() => setOpen(false)}>
                    계정 설정하기
                  </Link>
                ) : null}
              </div>
            ) : (
              <>
                <div className="shrink-0 border-b border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black text-slate-500">접속중인 팀원</p>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {visibleMembers.length}명
                    </span>
                  </div>
                  {visibleMembers.length === 0 ? (
                    <p className="mt-2 text-xs leading-5 text-slate-500">팀원을 기다리는 중입니다.</p>
                  ) : (
                    <div className="mt-2 flex max-h-16 flex-wrap gap-1.5 overflow-y-auto">
                      {visibleMembers.map((member) => (
                        <span
                          key={`${member.userId}-${member.onlineAt}`}
                          className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800"
                        >
                          {member.role}: {formatMemberNameWithEmoji(member.role, member.displayName)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3">
                  {messages.length === 0 ? (
                    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-sm leading-6 text-slate-500">
                      같은 팀원이 접속해 있으면 여기서 바로 대화할 수 있습니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message) => {
                        const isMine = message.userId === user?.id;
                        const readCount = getReadCount(message);

                        return (
                          <div key={message.id} className={isMine ? "flex justify-end" : "flex justify-start"}>
                            <div
                              className={
                                isMine
                                  ? "max-w-[82%] rounded-lg bg-blue-600 px-3 py-2 text-white"
                                  : "max-w-[82%] rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800"
                              }
                            >
                              <p className={isMine ? "text-xs font-bold text-blue-100" : "text-xs font-bold text-blue-700"}>
                                {getRoleEmoji(message.role)} {message.role} · {message.displayName}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
                              <p className={isMine ? "mt-1 text-right text-[11px] text-blue-100" : "mt-1 text-right text-[11px] text-slate-400"}>
                                {formatChatTime(message.createdAt)}
                                {isMine ? ` · 읽음 ${readCount}` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messageEndRef} />
                    </div>
                  )}
                </div>

                <form onSubmit={sendMessage} className="shrink-0 border-t border-slate-100 bg-white p-3 pb-4">
                  <div className="flex gap-2">
                    <input
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                      disabled={!canChat}
                      className="field-input min-h-11 flex-1 text-base sm:text-sm"
                      placeholder={canChat ? "메시지 입력" : "연결 중입니다"}
                      aria-label="팀 채팅 메시지"
                    />
                    <button type="submit" disabled={!canChat || !messageText.trim()} className="btn-primary min-h-11 shrink-0 px-4">
                      보내기
                    </button>
                  </div>
                  <p className="mt-2 text-right text-[11px] font-semibold text-slate-400">
                    {messageText.length}/{MAX_MESSAGE_LENGTH}
                  </p>
                </form>
              </>
            )}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        aria-label="팀 채팅 열기"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 6.5A4.5 4.5 0 0 1 9.5 2h5A4.5 4.5 0 0 1 19 6.5v4A4.5 4.5 0 0 1 14.5 15H12l-4 3v-3.25A4.5 4.5 0 0 1 5 10.5v-4Z" />
          <path d="M9 7h6M9 10h4" />
        </svg>
        {visibleMembers.length > 0 || unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-500 px-1.5 py-0.5 text-xs font-black text-white">
            {visibleMembers.length}
          </span>
        ) : null}
      </button>
    </div>
  );
}

function readPresenceMembers(channel: TeamChatChannel) {
  const state = channel.presenceState() as Record<string, TeamChatPresence[]>;

  return Object.values(state)
    .flat()
    .filter(isTeamChatPresence);
}

function isTeamChatPresence(value: unknown): value is TeamChatPresence {
  if (!value || typeof value !== "object") return false;

  const presence = value as Partial<TeamChatPresence>;
  return Boolean(presence.userId && presence.displayName && presence.role && presence.onlineAt);
}

function formatChatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
