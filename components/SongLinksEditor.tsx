"use client";

import { createBlankSongLink } from "@/lib/factories";
import type { SongLink } from "@/lib/types";
import { useState } from "react";
import { createPortal } from "react-dom";

type SongLinksEditorProps = {
  links: SongLink[];
  onChange: (links: SongLink[]) => void;
};

export function SongLinksEditor({ links, onChange }: SongLinksEditorProps) {
  const [deleteTarget, setDeleteTarget] = useState<SongLink | null>(null);

  function updateLink(id: string, patch: Partial<SongLink>) {
    onChange(links.map((link) => (link.id === id ? { ...link, ...patch } : link)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h5 className="font-bold text-slate-950">악보/참고 링크</h5>
        <button type="button" onClick={() => onChange([...links, createBlankSongLink()])} className="btn-secondary min-h-10 px-3">
          링크 추가
        </button>
      </div>

      {links.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          등록된 악보나 참고 링크가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const validUrl = !link.url.trim() || isHttpUrl(link.url);
            return (
              <div key={link.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-[0.8fr_1.4fr_auto]">
                <label className="space-y-1">
                  <span className="field-label">링크 이름</span>
                  <input
                    value={link.label}
                    onChange={(event) => updateLink(link.id, { label: event.target.value })}
                    className="field-input"
                    placeholder="코드 악보"
                  />
                </label>
                <label className="space-y-1">
                  <span className="field-label">링크 주소</span>
                  <input
                    value={link.url}
                    onChange={(event) => updateLink(link.id, { url: event.target.value })}
                    className="field-input"
                    placeholder="https://..."
                    inputMode="url"
                  />
                  {!validUrl ? <span className="text-xs font-semibold text-rose-600">http:// 또는 https://로 시작해 주세요.</span> : null}
                </label>
                <div className="flex items-end gap-2">
                  {link.url && validUrl ? (
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="btn-secondary min-h-10 px-3">
                      열기
                    </a>
                  ) : null}
                  <button type="button" onClick={() => setDeleteTarget(link)} className="btn-danger min-h-10 px-3">
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
              role="presentation"
              onClick={() => setDeleteTarget(null)}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={`delete-sheet-link-${deleteTarget.id}`}
                className="card w-full max-w-md p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-sm font-bold text-rose-600">링크 삭제</p>
                <h3 id={`delete-sheet-link-${deleteTarget.id}`} className="mt-2 text-xl font-black text-slate-950">
                  {deleteTarget.label || "이 링크"}
                </h3>
                <p className="mt-3 text-sm text-slate-600">악보/참고 링크를 삭제할까요?</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary">
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(links.filter((link) => link.id !== deleteTarget.id));
                      setDeleteTarget(null);
                    }}
                    className="btn-danger"
                  >
                    삭제하기
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function isHttpUrl(url: string) {
  return /^https?:\/\/\S+$/i.test(url.trim());
}
