import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isUserAppAdmin } from "@/lib/adminAccess";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AnnouncementType = "feature" | "improvement" | "fix" | "important" | "maintenance" | "tip";
export type AnnouncementStatus = "draft" | "published" | "archived";
export type AnnouncementTarget = "all" | "lab_users" | "logged_in_users";

export type AppAnnouncement = {
  id: string;
  title: string;
  summary: string;
  body: string;
  type: AnnouncementType;
  status: AnnouncementStatus;
  priority: number;
  target: AnnouncementTarget;
  linkLabel?: string;
  linkUrl?: string;
  startsAt?: string;
  endsAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  hiddenUntil?: string;
};

type AnnouncementRow = {
  id: string;
  title: string;
  summary: string;
  body: string;
  type: AnnouncementType;
  status: AnnouncementStatus;
  priority: number | null;
  target: AnnouncementTarget;
  link_label: string | null;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type AnnouncementReadRow = {
  announcement_id: string;
  read_at: string | null;
  hidden_until: string | null;
};

type AnnouncementInput = {
  title?: string;
  summary?: string;
  body?: string;
  type?: string;
  status?: string;
  priority?: number;
  target?: string;
  linkLabel?: string | null;
  linkUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

type AuthContext = {
  supabase: SupabaseClient;
  user: User | null;
};

const TYPE_VALUES: AnnouncementType[] = ["feature", "improvement", "fix", "important", "maintenance", "tip"];
const STATUS_VALUES: AnnouncementStatus[] = ["draft", "published", "archived"];
const TARGET_VALUES: AnnouncementTarget[] = ["all", "lab_users", "logged_in_users"];

export class AnnouncementApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function getAnnouncementAuthContext(request: Request): Promise<AuthContext> {
  const supabase = getSupabaseAdminClient();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { supabase, user: null };

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  return { supabase, user: user ?? null };
}

export async function requireAnnouncementUser(request: Request) {
  const context = await getAnnouncementAuthContext(request);
  if (!context.user) throw new AnnouncementApiError("로그인이 필요합니다.", 401);
  return context as AuthContext & { user: User };
}

export async function requireAnnouncementAdmin(request: Request) {
  const context = await requireAnnouncementUser(request);
  if (isUserAppAdmin(context.user)) return context;

  const { data, error } = await context.supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", context.user.id)
    .maybeSingle<{ is_admin: boolean | null }>();

  if (error) throw new AnnouncementApiError(error.message || "관리자 권한을 확인하지 못했습니다.", 500);
  if (!data?.is_admin) throw new AnnouncementApiError("새소식 관리 권한이 없습니다.", 403);
  return context;
}

export async function getCurrentAnnouncement(request: Request) {
  const { supabase, user } = await getAnnouncementAuthContext(request);
  const [profile, reads] = await Promise.all([getViewerProfile(supabase, user?.id), getViewerReads(supabase, user?.id)]);
  const now = Date.now();
  const rows = await getPublishedAnnouncementRows(supabase);

  const announcement =
    rows
      .filter((row) => matchesTarget(row.target, Boolean(user), Boolean(profile?.lab_enabled)))
      .map((row) => rowToAnnouncement(row, reads.get(row.id)))
      .find((announcement) => !announcement.readAt && (!announcement.hiddenUntil || new Date(announcement.hiddenUntil).getTime() < now)) ?? null;

  return { announcement };
}

export async function listPublishedAnnouncements(request: Request) {
  const { supabase, user } = await getAnnouncementAuthContext(request);
  const [profile, reads] = await Promise.all([getViewerProfile(supabase, user?.id), getViewerReads(supabase, user?.id)]);
  const rows = await getPublishedAnnouncementRows(supabase, { includeExpired: true });

  return {
    announcements: rows
      .filter((row) => matchesTarget(row.target, Boolean(user), Boolean(profile?.lab_enabled)))
      .map((row) => rowToAnnouncement(row, reads.get(row.id))),
  };
}

export async function markAnnouncementRead(request: Request, announcementId: string) {
  const { supabase, user } = await requireAnnouncementUser(request);
  await assertAnnouncementIsPublished(supabase, announcementId);
  const { data, error } = await supabase
    .from("app_announcement_reads")
    .upsert(
      {
        announcement_id: announcementId,
        user_id: user.id,
        read_at: new Date().toISOString(),
        hidden_until: null,
      },
      { onConflict: "announcement_id,user_id" },
    )
    .select("announcement_id, read_at, hidden_until")
    .single<AnnouncementReadRow>();

  if (error || !data) throw new AnnouncementApiError(error?.message || "새소식을 확인 처리하지 못했습니다.", 500);
  return { read: data };
}

export async function hideAnnouncementToday(request: Request, announcementId: string) {
  const { supabase, user } = await requireAnnouncementUser(request);
  await assertAnnouncementIsPublished(supabase, announcementId);
  const { data, error } = await supabase
    .from("app_announcement_reads")
    .upsert(
      {
        announcement_id: announcementId,
        user_id: user.id,
        hidden_until: getNextKstMidnightIso(),
      },
      { onConflict: "announcement_id,user_id" },
    )
    .select("announcement_id, read_at, hidden_until")
    .single<AnnouncementReadRow>();

  if (error || !data) throw new AnnouncementApiError(error?.message || "오늘만 숨김 처리하지 못했습니다.", 500);
  return { read: data };
}

export async function listAdminAnnouncements(request: Request) {
  const { supabase } = await requireAnnouncementAdmin(request);
  const { data, error } = await supabase
    .from("app_announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<AnnouncementRow[]>();

  if (error) throw new AnnouncementApiError(error.message || "새소식 목록을 불러오지 못했습니다.", 500);
  return { announcements: (data ?? []).map((row) => rowToAnnouncement(row)) };
}

export async function getAdminAnnouncement(request: Request, id: string) {
  const { supabase } = await requireAnnouncementAdmin(request);
  const row = await getAnnouncementRowOrThrow(supabase, id);
  return { announcement: rowToAnnouncement(row) };
}

export async function createAdminAnnouncement(request: Request, input: AnnouncementInput) {
  const { supabase, user } = await requireAnnouncementAdmin(request);
  const row = sanitizeAnnouncementInput(input, { partial: false });
  const { data, error } = await supabase
    .from("app_announcements")
    .insert({ ...row, created_by: user.id })
    .select("*")
    .single<AnnouncementRow>();

  if (error || !data) throw new AnnouncementApiError(error?.message || "새소식을 저장하지 못했습니다.", 500);
  return { announcement: rowToAnnouncement(data) };
}

export async function updateAdminAnnouncement(request: Request, id: string, input: AnnouncementInput) {
  const { supabase } = await requireAnnouncementAdmin(request);
  await getAnnouncementRowOrThrow(supabase, id);
  const row = sanitizeAnnouncementInput(input, { partial: true });
  const { data, error } = await supabase
    .from("app_announcements")
    .update(row)
    .eq("id", id)
    .select("*")
    .single<AnnouncementRow>();

  if (error || !data) throw new AnnouncementApiError(error?.message || "새소식을 수정하지 못했습니다.", 500);
  return { announcement: rowToAnnouncement(data) };
}

export async function archiveAdminAnnouncement(request: Request, id: string) {
  const { supabase } = await requireAnnouncementAdmin(request);
  const { data, error } = await supabase
    .from("app_announcements")
    .update({ status: "archived" })
    .eq("id", id)
    .select("*")
    .single<AnnouncementRow>();

  if (error || !data) throw new AnnouncementApiError(error?.message || "새소식을 보관 처리하지 못했습니다.", 500);
  return { announcement: rowToAnnouncement(data) };
}

async function getPublishedAnnouncementRows(supabase: SupabaseClient, options?: { includeExpired?: boolean }) {
  let query = supabase
    .from("app_announcements")
    .select("*")
    .eq("status", "published")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (!options?.includeExpired) {
    const now = new Date().toISOString();
    query = query.or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gte.${now}`);
  }

  const { data, error } = await query.returns<AnnouncementRow[]>();
  if (error) throw new AnnouncementApiError(error.message || "새소식을 불러오지 못했습니다.", 500);
  return data ?? [];
}

async function getViewerProfile(supabase: SupabaseClient, userId?: string) {
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("lab_enabled")
    .eq("id", userId)
    .maybeSingle<{ lab_enabled: boolean | null }>();
  return data ?? null;
}

async function getViewerReads(supabase: SupabaseClient, userId?: string) {
  if (!userId) return new Map<string, AnnouncementReadRow>();
  const { data } = await supabase
    .from("app_announcement_reads")
    .select("announcement_id, read_at, hidden_until")
    .eq("user_id", userId)
    .returns<AnnouncementReadRow[]>();

  return new Map((data ?? []).map((row) => [row.announcement_id, row]));
}

async function assertAnnouncementIsPublished(supabase: SupabaseClient, announcementId: string) {
  const { data, error } = await supabase
    .from("app_announcements")
    .select("id")
    .eq("id", announcementId)
    .eq("status", "published")
    .maybeSingle<{ id: string }>();

  if (error) throw new AnnouncementApiError(error.message || "새소식을 확인하지 못했습니다.", 500);
  if (!data) throw new AnnouncementApiError("확인할 수 없는 새소식입니다.", 404);
}

async function getAnnouncementRowOrThrow(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("app_announcements").select("*").eq("id", id).maybeSingle<AnnouncementRow>();
  if (error) throw new AnnouncementApiError(error.message || "새소식을 불러오지 못했습니다.", 500);
  if (!data) throw new AnnouncementApiError("새소식을 찾을 수 없습니다.", 404);
  return data;
}

function rowToAnnouncement(row: AnnouncementRow, read?: AnnouncementReadRow): AppAnnouncement {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    type: row.type,
    status: row.status,
    priority: row.priority ?? 0,
    target: row.target,
    linkLabel: row.link_label ?? undefined,
    linkUrl: row.link_url ?? undefined,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readAt: read?.read_at ?? undefined,
    hiddenUntil: read?.hidden_until ?? undefined,
  };
}

function matchesTarget(target: AnnouncementTarget, loggedIn: boolean, labEnabled: boolean) {
  if (target === "all") return true;
  if (target === "logged_in_users") return loggedIn;
  if (target === "lab_users") return loggedIn && labEnabled;
  return false;
}

function sanitizeAnnouncementInput(input: AnnouncementInput, options: { partial: boolean }) {
  const row: Record<string, unknown> = {};

  if (!options.partial || input.title !== undefined) row.title = requireText(input.title, "제목");
  if (!options.partial || input.summary !== undefined) row.summary = requireText(input.summary, "한 줄 요약");
  if (!options.partial || input.body !== undefined) row.body = requireText(input.body, "본문");
  if (!options.partial || input.type !== undefined) row.type = requireEnum(input.type, TYPE_VALUES, "유형");
  if (!options.partial || input.status !== undefined) row.status = requireEnum(input.status, STATUS_VALUES, "상태");
  if (!options.partial || input.target !== undefined) row.target = requireEnum(input.target, TARGET_VALUES, "대상");
  if (!options.partial || input.priority !== undefined) row.priority = normalizePriority(input.priority);
  if (!options.partial || input.linkLabel !== undefined) row.link_label = normalizeNullableText(input.linkLabel, 40);
  if (!options.partial || input.linkUrl !== undefined) row.link_url = normalizeLinkUrl(input.linkUrl);
  if (!options.partial || input.startsAt !== undefined) row.starts_at = normalizeDateTime(input.startsAt);
  if (!options.partial || input.endsAt !== undefined) row.ends_at = normalizeDateTime(input.endsAt);

  return row;
}

function requireText(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new AnnouncementApiError(`${label}을 입력해 주세요.`, 400);
  return text;
}

function requireEnum<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (values.includes(value as T)) return value as T;
  throw new AnnouncementApiError(`${label} 값이 올바르지 않습니다.`, 400);
}

function normalizePriority(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(-1000, Math.min(1000, Math.round(numberValue)));
}

function normalizeNullableText(value: unknown, maxLength: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeLinkUrl(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    // handled below
  }
  throw new AnnouncementApiError("링크 URL은 http 또는 https 주소만 사용할 수 있습니다.", 400);
}

function normalizeDateTime(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new AnnouncementApiError("노출 기간 날짜가 올바르지 않습니다.", 400);
  return date.toISOString();
}

function getNextKstMidnightIso() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const nextKstMidnightUtcMs = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1, -9, 0, 0, 0);
  return new Date(nextKstMidnightUtcMs).toISOString();
}
