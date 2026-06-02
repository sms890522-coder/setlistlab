"use client";

import { exportSetlist, importSetlist, parseSetlistJson } from "@/lib/storage";
import { isSupabaseConfigured, publishSetlist } from "@/lib/supabase";
import type { Setlist } from "@/lib/types";
import { useMemo, useState } from "react";

type ExportImportPanelProps = {
  setlist?: Setlist;
  onImported?: (setlist: Setlist) => void;
};

export function ExportImportPanel({ setlist, onImported }: ExportImportPanelProps) {
  const [jsonText, setJsonText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [publishing, setPublishing] = useState(false);
  const exportedJson = useMemo(() => (setlist ? exportSetlist(setlist) : ""), [setlist]);

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successMessage);
      setError("");
    } catch {
      setError("클립보드 복사에 실패했습니다. 아래 링크나 텍스트를 직접 선택해서 복사해 주세요.");
      setMessage("");
    }
  }

  function downloadJson() {
    if (!setlist) return;
    const blob = new Blob([exportedJson], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(setlist.title || "setlist")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("콘티 JSON 파일을 내보냈습니다.");
    setError("");
  }

  async function createShareLink() {
    if (!setlist) return;

    if (!isSupabaseConfigured()) {
      setError("공유 서버 설정이 없습니다. Vercel 환경변수를 확인해 주세요.");
      setMessage("");
      return;
    }

    try {
      setPublishing(true);
      const shareSlug = await publishSetlist(setlist);
      const url = `${window.location.origin}/share/${shareSlug}`;
      setShareUrl(url);
      setMessage("공유 링크를 만들었습니다.");
      setError("");
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "공유 링크 생성에 실패했습니다.");
      setMessage("");
    } finally {
      setPublishing(false);
    }
  }

  async function shareToKakaoTalk() {
    if (!shareUrl || !setlist) return;

    const shareData = {
      title: setlist.title || "콘티연습실 공유 콘티",
      text: `${setlist.title || "콘티"}를 공유합니다.`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setMessage("공유 창을 열었습니다.");
        setError("");
        return;
      } catch (shareError) {
        if (shareError instanceof Error && shareError.name === "AbortError") return;
      }
    }

    await copyText(shareUrl, "공유 링크를 복사했습니다. 카카오톡 대화방에 붙여넣어 주세요.");
  }

  function handleImport() {
    try {
      const parsed = parseSetlistJson(jsonText);
      const imported = importSetlist(parsed);
      setMessage("콘티를 가져와 localStorage에 저장했습니다.");
      setError("");
      setJsonText("");
      onImported?.(imported);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "잘못된 JSON입니다.");
      setMessage("");
    }
  }

  return (
    <section className="card p-5">
      <div className="space-y-2">
        <h2 className="section-title">공유하기</h2>
        <p className="text-sm leading-6 text-slate-600">
          팀원에게 보낼 수 있는 공유 링크를 만듭니다. 링크를 만든 뒤 복사하거나 모바일 공유 창에서 카카오톡으로
          보낼 수 있습니다.
        </p>
      </div>

      {setlist ? (
        <div className="mt-5">
          <button type="button" onClick={createShareLink} disabled={publishing} className="btn-primary">
            {publishing ? "링크 생성 중" : "공유하기"}
          </button>
        </div>
      ) : null}

      {shareUrl ? (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-bold text-blue-900">공유 링크</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input value={shareUrl} readOnly className="field-input bg-white font-mono text-xs" onFocus={(event) => event.target.select()} />
            <button type="button" onClick={() => copyText(shareUrl, "공유 링크를 복사했습니다.")} className="btn-secondary shrink-0">
              링크 복사하기
            </button>
            <button type="button" onClick={shareToKakaoTalk} className="btn-primary shrink-0">
              카카오톡 공유하기
            </button>
          </div>
        </div>
      ) : null}

      {setlist ? (
        <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">JSON 백업</summary>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => copyText(exportedJson, "콘티 JSON을 복사했습니다.")} className="btn-secondary">
              JSON 복사하기
            </button>
            <button type="button" onClick={downloadJson} className="btn-secondary">
              JSON 내보내기
            </button>
          </div>
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
            {exportedJson}
          </pre>
        </details>
      ) : null}

      <div className="mt-6 space-y-3">
        <label className="block space-y-1">
          <span className="field-label">콘티 JSON 가져오기</span>
          <textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            className="field-input min-h-44 resize-y font-mono text-xs"
            placeholder="팀 카톡이나 백업 파일에서 받은 콘티 JSON을 붙여넣으세요."
          />
        </label>
        <button type="button" onClick={handleImport} disabled={!jsonText.trim()} className="btn-primary">
          가져와서 저장
        </button>
      </div>

      {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    </section>
  );
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "setlist";
}
