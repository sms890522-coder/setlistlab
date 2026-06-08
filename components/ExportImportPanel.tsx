"use client";

import { importSetlist, parseSetlistJson } from "@/lib/storage";
import { formatSetlistSummary } from "@/lib/setlistSummary";
import { getCurrentUser } from "@/lib/auth";
import { setCloudSetlistPublic } from "@/lib/db/setlists";
import { isSupabaseConfigured, publishSetlist } from "@/lib/supabase";
import type { Setlist } from "@/lib/types";
import { useState } from "react";

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
  const sharePlayUrl = shareUrl ? `${shareUrl}/play` : "";

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

  async function createShareLink() {
    if (!setlist) return;

    if (!isSupabaseConfigured()) {
      setError("공유 기능이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.");
      setMessage("");
      return;
    }

    try {
      setPublishing(true);
      const user = await getCurrentUser();
      if (user && isUuid(setlist.id)) {
        const sharedSetlist = await setCloudSetlistPublic(setlist.id, true);
        if (!sharedSetlist.shareSlug) {
          throw new Error("공유 링크 정보를 만들지 못했습니다.");
        }
        const url = `${window.location.origin}/s/${sharedSetlist.shareSlug}`;
        setShareUrl(url);
        setMessage("공유 링크를 만들었습니다.");
        setError("");
        return;
      }

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
      text: `${setlist.title || "콘티"} 연속재생 링크를 공유합니다.`,
      url: sharePlayUrl || shareUrl,
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

    await copyText(sharePlayUrl || shareUrl, "연속재생 링크를 복사했습니다. 카카오톡 대화방에 붙여넣어 주세요.");
  }

  function getSummaryPlayUrl() {
    if (sharePlayUrl) return sharePlayUrl;
    if (!setlist || typeof window === "undefined") return "";
    return `${window.location.origin}/setlists/${setlist.id}/play`;
  }

  function handleImport() {
    try {
      const parsed = parseSetlistJson(jsonText);
      const imported = importSetlist(parsed);
      setMessage("콘티를 가져와 이 브라우저에 저장했습니다.");
      setError("");
      setJsonText("");
      onImported?.(imported);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "백업 텍스트 형식이 올바르지 않습니다.");
      setMessage("");
    }
  }

  if (!setlist) {
    return (
      <section className="card p-5">
        <div className="space-y-2">
          <h2 className="section-title">백업 텍스트 가져오기</h2>
          <p className="text-sm leading-6 text-slate-600">
            받은 콘티 백업 텍스트를 붙여넣으면 이 브라우저에 저장됩니다.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <label className="block space-y-1">
            <span className="field-label">콘티 백업 텍스트</span>
            <textarea
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              className="field-input min-h-44 resize-y font-mono text-xs"
              placeholder="팀 카톡이나 백업 파일에서 받은 콘티 백업 텍스트를 붙여넣으세요."
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

  return (
    <section className="card p-5">
      <div className="space-y-2">
        <h2 className="section-title">공유하기</h2>
        <p className="text-sm leading-6 text-slate-600">
          팀원에게 보낼 수 있는 공유 링크를 만듭니다. 링크를 만든 뒤 복사하거나 모바일 공유 창에서 카카오톡으로
          보낼 수 있습니다.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={createShareLink} disabled={publishing} className="btn-primary">
          {publishing ? "링크 생성 중" : "공유하기"}
        </button>
        <button
          type="button"
          onClick={() =>
            copyText(formatSetlistSummary(setlist, { playUrl: getSummaryPlayUrl() }), "카톡용 콘티 요약을 복사했습니다.")
          }
          className="btn-secondary"
        >
          카톡용 요약 복사
        </button>
      </div>

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
          <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
            <p className="text-xs font-black text-blue-700">연속재생 링크</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={sharePlayUrl}
                readOnly
                className="field-input bg-white font-mono text-xs"
                onFocus={(event) => event.target.select()}
              />
              <button
                type="button"
                onClick={() => copyText(sharePlayUrl, "연속재생 링크를 복사했습니다.")}
                className="btn-secondary shrink-0"
              >
                연속재생 링크 복사
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    </section>
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
