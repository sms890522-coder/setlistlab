"use client";

import { createBlankSongLink } from "@/lib/factories";
import { uploadCloudinarySongImage } from "@/lib/cloudinary";
import { getImagePreviewUrl } from "@/lib/images";
import type { SongLink } from "@/lib/types";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

type SongLinksEditorProps = {
  links: SongLink[];
  onChange: (links: SongLink[]) => void;
  title?: string;
  addLabel?: string;
  emptyMessage?: string;
  labelPlaceholder?: string;
  urlPlaceholder?: string;
  deleteMessage?: string;
  showPreview?: boolean;
  enableImageUpload?: boolean;
  uploadLabel?: string;
  maxLinks?: number;
};

export function SongLinksEditor({
  links,
  onChange,
  title = "악보/참고 링크",
  addLabel = "링크 추가",
  emptyMessage = "등록된 악보나 참고 링크가 없습니다.",
  labelPlaceholder = "코드 악보",
  urlPlaceholder = "https://...",
  deleteMessage = "악보/참고 링크를 삭제할까요?",
  showPreview = false,
  enableImageUpload = false,
  uploadLabel = "이미지 직접 넣기",
  maxLinks = 10,
}: SongLinksEditorProps) {
  const [deleteTarget, setDeleteTarget] = useState<SongLink | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateLink(id: string, patch: Partial<SongLink>) {
    onChange(links.map((link) => (link.id === id ? { ...link, ...patch } : link)));
  }

  async function handleImageUpload(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;

    if (links.length + selectedFiles.length > maxLinks) {
      setUploadError(`이미지는 한 곡에 최대 ${maxLinks}개까지 넣을 수 있습니다.`);
      return;
    }

    try {
      setUploading(true);
      setUploadError("");
      setUploadMessage("");
      const uploadedLinks: SongLink[] = [];
      for (const file of selectedFiles) {
        const uploaded = await uploadCloudinarySongImage(file);
        uploadedLinks.push({
          ...createBlankSongLink(),
          label: getImageLabel(file.name),
          url: uploaded.url,
        });
      }

      onChange([...links, ...uploadedLinks]);
      setUploadMessage(`${uploadedLinks.length}개 이미지를 넣었습니다.`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "이미지를 업로드하지 못했습니다.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h5 className="font-bold text-slate-950">{title}</h5>
        <div className="flex flex-wrap gap-2">
          {enableImageUpload ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => handleImageUpload(event.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-primary min-h-10 px-3"
              >
                {uploading ? "이미지 넣는 중" : uploadLabel}
              </button>
            </>
          ) : null}
          <button type="button" onClick={() => onChange([...links, createBlankSongLink()])} className="btn-secondary min-h-10 px-3">
            {addLabel}
          </button>
        </div>
      </div>

      {uploadMessage ? <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{uploadMessage}</p> : null}
      {uploadError ? <p className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{uploadError}</p> : null}

      {links.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const validUrl = !link.url.trim() || isHttpUrl(link.url);
            const previewUrl = validUrl ? getImagePreviewUrl(link.url) : "";
            return (
              <div key={link.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-[0.8fr_1.4fr_auto]">
                <label className="space-y-1">
                  <span className="field-label">링크 이름</span>
                  <input
                    value={link.label}
                    onChange={(event) => updateLink(link.id, { label: event.target.value })}
                    className="field-input"
                    placeholder={labelPlaceholder}
                  />
                </label>
                <label className="space-y-1">
                  <span className="field-label">링크 주소</span>
                  <input
                    value={link.url}
                    onChange={(event) => updateLink(link.id, { url: event.target.value })}
                    className="field-input"
                    placeholder={urlPlaceholder}
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
                {showPreview && link.url && validUrl ? (
                  <div className="lg:col-span-3">
                    <img
                      src={previewUrl}
                      alt={link.label || "곡 이미지 미리보기"}
                      className="max-h-64 w-full rounded-lg border border-slate-100 object-contain"
                      loading="lazy"
                    />
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      미리보기가 보이지 않으면 링크의 공유 권한을 확인해 주세요. 그래도 링크 열기는 사용할 수 있습니다.
                    </p>
                  </div>
                ) : null}
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
                <p className="mt-3 text-sm text-slate-600">{deleteMessage}</p>
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

function getImageLabel(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "곡 이미지";
}
