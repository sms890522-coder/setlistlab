import type { Profile } from "@/lib/db/profiles";

export type TeamChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  role: string;
  text: string;
  createdAt: string;
};

export type TeamChatPresence = {
  userId: string;
  displayName: string;
  role: string;
  onlineAt: string;
};

export type TeamChatReadReceipt = {
  messageId: string;
  userId: string;
  readAt: string;
};

export function getTeamChatChannelName(profile: Pick<Profile, "churchName" | "praiseTeamName">) {
  const teamKey = getTeamKey(profile);
  if (!teamKey) return "";

  return `team-chat:${hashString(teamKey)}`;
}

export function getTeamLabel(profile: Pick<Profile, "churchName" | "praiseTeamName">) {
  const churchName = profile.churchName?.trim();
  const praiseTeamName = profile.praiseTeamName?.trim();

  if (churchName && praiseTeamName) return `${churchName} · ${praiseTeamName}`;
  return churchName || praiseTeamName || "";
}

export function getProfileRole(profile: Pick<Profile, "role" | "customRole">) {
  if (profile.role === "기타" && profile.customRole?.trim()) return profile.customRole.trim();
  return profile.role || "팀원";
}

export function isTeamChatMessage(value: unknown): value is TeamChatMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as Partial<TeamChatMessage>;
  return Boolean(
    message.id &&
      message.userId &&
      message.displayName &&
      message.role &&
      message.createdAt &&
      typeof message.text === "string" &&
      message.text.trim(),
  );
}

export function isTeamChatReadReceipt(value: unknown): value is TeamChatReadReceipt {
  if (!value || typeof value !== "object") return false;

  const receipt = value as Partial<TeamChatReadReceipt>;
  return Boolean(receipt.messageId && receipt.userId && receipt.readAt);
}

function getTeamKey(profile: Pick<Profile, "churchName" | "praiseTeamName">) {
  const churchName = normalizeTeamText(profile.churchName);
  const praiseTeamName = normalizeTeamText(profile.praiseTeamName);

  if (!churchName || !praiseTeamName) return "";
  return `${churchName}:${praiseTeamName}`;
}

function normalizeTeamText(value?: string) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function hashString(value: string) {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}
