"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  archiveAdminAnnouncement,
  createAdminAnnouncement,
  getAdminAnnouncements,
  updateAdminAnnouncement,
  type AnnouncementInput,
  type AnnouncementStatus,
  type AnnouncementTarget,
  type AnnouncementType,
  type AppAnnouncement,
} from "@/lib/announcements";
import { AnnouncementBadge } from "@/components/announcements/AnnouncementBadge";

const EMPTY_FORM: AnnouncementInput = {
  title: "",
  summary: "",
  body: "",
  type: "feature",
  status: "draft",
  target: "all",
  priority: 0,
  linkLabel: "",
  linkUrl: "",
  startsAt: "",
  endsAt: "",
};

const TYPE_OPTIONS: Array<{ value: AnnouncementType; label: string }> = [
  { value: "feature", label: "새 기능" },
  { value: "improvement", label: "개선" },
  { value: "fix", label: "버그 수정" },
  { value: "important", label: "중요 안내" },
  { value: "maintenance", label: "점검 안내" },
  { value: "tip", label: "사용 팁" },
];

const STATUS_OPTIONS: Array<{ value: AnnouncementStatus; label: string }> = [
  { value: "draft", label: "임시저장" },
  { value: "published", label: "발행" },
  { value: "archived", label: "보관" },
];

const TARGET_OPTIONS: Array<{ value: AnnouncementTarget; label: string }> = [
  { value: "all", label: "전체" },
  { value: "logged_in_users", label: "로그인 사용자" },
  { value: "lab_users", label: "실험실 사용자" },
];

export function AnnouncementAdminClient() {
  const [announcements, setAnnouncements] = useState<AppAnnouncement[]>([]);
  const [form, setForm] = useState<AnnouncementInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void load();
  }, []);

  const editingAnnouncement = useMemo(
    () => announcements.find((announcement) => announcement.id === editingId) ?? null,
    [announcements, editingId],
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { announcements: nextAnnouncements } = await getAdminAnnouncements();
      setAnnouncements(nextAnnouncements);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "새소식 관리 권한이 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(announcement: AppAnnouncement) {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      summary: announcement.summary,
      body: announcement.body,
      type: announcement.type,
      status: announcement.status,
      target: announcement.target,
      priority: announcement.priority,
      linkLabel: announcement.linkLabel || "",
      linkUrl: announcement.linkUrl || "",
      startsAt: toDatetimeLocalValue(announcement.startsAt),
      endsAt: toDatetimeLocalValue(announcement.endsAt),
    });
    setMessage("");
    setError("");
  }

  function resetForm() {
    setEditingId("");
    setForm(EMPTY_FORM);
    setMessage("");
  }

  async function save(status?: AnnouncementStatus) {
    setSaving(true);
    setError("");
    setMessage("");
    const payload = normalizeFormForSubmit({ ...form, status: status ?? form.status });

    try {
      const result = editingId
        ? await updateAdminAnnouncement(editingId, payload)
        : await createAdminAnnouncement(payload);
      setMessage(payload.status === "published" ? "새소식이 발행되었습니다." : "새소식이 저장되었습니다.");
      setAnnouncements((current) => {
        const exists = current.some((announcement) => announcement.id === result.announcement.id);
        return exists
          ? current.map((announcement) => (announcement.id === result.announcement.id ? result.announcement : announcement))
          : [result.announcement, ...current];
      });
      if (!editingId) resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "새소식을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function archive(id: string) {
    if (!window.confirm("이 새소식을 보관 처리할까요?")) return;
    setSaving(true);
    setError("");
    try {
      const { announcement } = await archiveAdminAnnouncement(id);
      setAnnouncements((current) => current.map((item) => (item.id === id ? announcement : item)));
      if (editingId === id) resetForm();
      setMessage("새소식을 보관 처리했습니다.");
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "새소식을 보관 처리하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">새소식 관리 화면을 불러오는 중입니다.</p>;
  }

  if (error && announcements.length === 0) {
    return (
      <section className="rounded-2xl border border-rose-100 bg-rose-50 p-6">
        <h2 className="text-lg font-black text-rose-950">새소식 관리 권한이 없습니다</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-rose-700">{error}</p>
      </section>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">{editingAnnouncement ? "새소식 수정" : "새소식 작성"}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">작성한 새소식은 상단 공지바와 새소식 기록 페이지에 표시됩니다.</p>
          </div>
          {editingAnnouncement ? (
            <button type="button" onClick={resetForm} className="btn-secondary shrink-0">
              새 글
            </button>
          ) : null}
        </div>

        {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}

        <div className="mt-5 space-y-4">
          <Field label="제목">
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="field-input" />
          </Field>
          <Field label="한 줄 요약">
            <input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} className="field-input" />
          </Field>
          <Field label="본문">
            <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} className="field-input min-h-48" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="유형">
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as AnnouncementType })} className="field-input">
                {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="상태">
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AnnouncementStatus })} className="field-input">
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="대상">
              <select value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value as AnnouncementTarget })} className="field-input">
                {TARGET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="우선순위">
              <input type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} className="field-input" />
            </Field>
            <Field label="노출 시작">
              <input type="datetime-local" value={form.startsAt || ""} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="field-input" />
            </Field>
            <Field label="노출 종료">
              <input type="datetime-local" value={form.endsAt || ""} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className="field-input" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="링크 라벨">
              <input value={form.linkLabel || ""} onChange={(event) => setForm({ ...form, linkLabel: event.target.value })} className="field-input" placeholder="예: 자세히 보기" />
            </Field>
            <Field label="링크 URL">
              <input value={form.linkUrl || ""} onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} className="field-input" placeholder="https://..." />
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => void save("draft")} disabled={saving} className="btn-secondary disabled:opacity-50">
              임시저장
            </button>
            <button type="button" onClick={() => void save("published")} disabled={saving} className="btn-primary disabled:opacity-50">
              발행
            </button>
            {editingId ? (
              <button type="button" onClick={() => void archive(editingId)} disabled={saving} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:opacity-50">
                보관 처리
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">새소식 목록</h2>
            <p className="mt-1 text-sm text-slate-500">발행, 임시저장, 보관 상태를 관리합니다.</p>
          </div>
          <button type="button" onClick={() => void load()} className="btn-secondary shrink-0">
            새로고침
          </button>
        </div>
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <article key={announcement.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AnnouncementBadge type={announcement.type} />
                <span className={getStatusClass(announcement.status)}>{getStatusLabel(announcement.status)}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">{getTargetLabel(announcement.target)}</span>
                <span className="ml-auto text-xs font-bold text-slate-400">우선순위 {announcement.priority}</span>
              </div>
              <h3 className="mt-3 text-base font-black text-slate-950">{announcement.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">{announcement.summary}</p>
              <div className="mt-3 grid gap-2 text-xs font-bold text-slate-400 sm:grid-cols-2">
                <span>시작: {formatOptionalDate(announcement.startsAt)}</span>
                <span>종료: {formatOptionalDate(announcement.endsAt)}</span>
                <span>생성: {formatOptionalDate(announcement.createdAt)}</span>
                <span>수정: {formatOptionalDate(announcement.updatedAt)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => startEdit(announcement)} className="btn-secondary">
                  수정
                </button>
                {announcement.status !== "published" ? (
                  <button type="button" onClick={() => void quickStatus(announcement, "published")} className="btn-primary">
                    발행
                  </button>
                ) : null}
                {announcement.status !== "archived" ? (
                  <button type="button" onClick={() => void archive(announcement.id)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200">
                    보관
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );

  async function quickStatus(announcement: AppAnnouncement, status: AnnouncementStatus) {
    setSaving(true);
    setError("");
    try {
      const { announcement: updated } = await updateAdminAnnouncement(announcement.id, normalizeFormForSubmit({ ...announcementToInput(announcement), status }));
      setAnnouncements((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(status === "published" ? "새소식이 발행되었습니다." : "새소식이 저장되었습니다.");
    } catch (quickError) {
      setError(quickError instanceof Error ? quickError.message : "상태를 변경하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function normalizeFormForSubmit(input: AnnouncementInput): AnnouncementInput {
  return {
    ...input,
    title: input.title.trim(),
    summary: input.summary.trim(),
    body: input.body.trim(),
    linkLabel: input.linkLabel?.trim() || "",
    linkUrl: input.linkUrl?.trim() || "",
    startsAt: input.startsAt || "",
    endsAt: input.endsAt || "",
  };
}

function announcementToInput(announcement: AppAnnouncement): AnnouncementInput {
  return {
    title: announcement.title,
    summary: announcement.summary,
    body: announcement.body,
    type: announcement.type,
    status: announcement.status,
    target: announcement.target,
    priority: announcement.priority,
    linkLabel: announcement.linkLabel || "",
    linkUrl: announcement.linkUrl || "",
    startsAt: toDatetimeLocalValue(announcement.startsAt),
    endsAt: toDatetimeLocalValue(announcement.endsAt),
  };
}

function toDatetimeLocalValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatOptionalDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getStatusLabel(status: AnnouncementStatus) {
  if (status === "published") return "발행";
  if (status === "archived") return "보관";
  return "임시저장";
}

function getStatusClass(status: AnnouncementStatus) {
  if (status === "published") return "rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700";
  if (status === "archived") return "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500";
  return "rounded-full bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700";
}

function getTargetLabel(target: AnnouncementTarget) {
  if (target === "lab_users") return "실험실 사용자";
  if (target === "logged_in_users") return "로그인 사용자";
  return "전체";
}
