"use client";

import { exportSetlist, importSetlist, parseSetlistJson } from "@/lib/storage";
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
  const exportedJson = useMemo(() => (setlist ? exportSetlist(setlist) : ""), [setlist]);

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successMessage);
      setError("");
    } catch {
      setError("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
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

  async function copyShareLink() {
    if (!setlist) return;
    const url = `${window.location.origin}/setlists/${setlist.id}`;
    await copyText(url, "공유 링크를 복사했습니다. 같은 브라우저에서는 이 링크로 다시 열 수 있습니다.");
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
        <h2 className="section-title">공유와 백업</h2>
        <p className="text-sm leading-6 text-slate-600">
          현재 MVP는 로그인/서버 저장 없이 동작합니다. 같은 기기에서는 링크로 다시 열 수 있고, 다른 팀원에게는 JSON
          내보내기 파일 또는 텍스트를 공유할 수 있습니다. 추후 서버 저장 기능을 추가하면 링크 하나로 공유할 수
          있습니다.
        </p>
      </div>

      {setlist ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={copyShareLink} className="btn-secondary">
            공유 링크 복사
          </button>
          <button type="button" onClick={() => copyText(exportedJson, "콘티 JSON을 복사했습니다.")} className="btn-secondary">
            JSON 복사하기
          </button>
          <button type="button" onClick={downloadJson} className="btn-primary">
            JSON 내보내기
          </button>
        </div>
      ) : null}

      {setlist ? (
        <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">내보내기 JSON 미리보기</summary>
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
