"use client";

import { useMemo, useState } from "react";

type YouTubeSearchResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  url: string;
};

type YouTubeSearchPickerProps = {
  songTitle: string;
  onSelect: (url: string) => void;
};

const searchCache = new Map<string, YouTubeSearchResult[]>();

const SEARCH_PRESETS = [
  { label: "찬양 영상", suffix: "찬양" },
  { label: "MR", suffix: "MR" },
  { label: "드럼 커버", suffix: "드럼 커버" },
  { label: "베이스 커버", suffix: "베이스 커버" },
  { label: "일렉 커버", suffix: "일렉 커버" },
  { label: "건반 커버", suffix: "건반 커버" },
];

export function YouTubeSearchPicker({ songTitle, onSelect }: YouTubeSearchPickerProps) {
  const defaultQuery = useMemo(() => buildSearchQuery(songTitle, "찬양"), [songTitle]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function searchYouTube(nextQuery = query) {
    const normalizedQuery = nextQuery.trim();
    if (!normalizedQuery) {
      setError("검색어를 입력해 주세요.");
      return;
    }

    setOpen(true);
    setQuery(normalizedQuery);
    setSearched(true);
    setError("");

    const cachedResults = searchCache.get(normalizedQuery);
    if (cachedResults) {
      setResults(cachedResults);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(normalizedQuery)}`);
      const data = (await response.json().catch(() => ({}))) as {
        results?: YouTubeSearchResult[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "YouTube 검색에 실패했습니다.");
      }

      const nextResults = data.results ?? [];
      searchCache.set(normalizedQuery, nextResults);
      setResults(nextResults);
    } catch (searchError) {
      setResults([]);
      setError(searchError instanceof Error ? searchError.message : "YouTube 검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handlePresetSearch(suffix: string) {
    void searchYouTube(buildSearchQuery(songTitle, suffix));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => searchYouTube(defaultQuery)} className="btn-secondary min-h-10 px-3">
          유튜브에서 찾기
        </button>
        {open ? (
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary min-h-10 px-3">
            검색 접기
          </button>
        ) : null}
      </div>

      {open ? (
        <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="field-input"
              placeholder="나는 예배자입니다 찬양"
            />
            <button type="button" onClick={() => searchYouTube(query)} disabled={loading} className="btn-primary min-h-11 px-4">
              {loading ? "검색 중" : "검색"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {SEARCH_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetSearch(preset.suffix)}
                disabled={loading}
                className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            YouTube Data API로 최대 5개만 검색합니다. 영상 다운로드, 음원 추출, 백그라운드 재생 기능은 제공하지 않습니다.
          </p>

          {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

          {!error && searched && !loading && results.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
              검색 결과가 없습니다. 곡 제목이나 검색어를 조금 바꿔보세요.
            </div>
          ) : null}

          {results.length > 0 ? (
            <div className="mt-4 space-y-3">
              {results.map((result) => (
                <article key={result.videoId} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                    <div className="overflow-hidden rounded-lg bg-slate-100">
                      {result.thumbnailUrl ? (
                        <img src={result.thumbnailUrl} alt="" className="aspect-video h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="aspect-video" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h5 className="line-clamp-2 text-sm font-black leading-5 text-slate-950">{decodeHtmlEntities(result.title)}</h5>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{decodeHtmlEntities(result.channelTitle)}</p>
                      {result.publishedAt ? (
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatPublishedAt(result.publishedAt)}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(result.url);
                            setOpen(false);
                          }}
                          className="btn-primary min-h-9 px-3 text-xs"
                        >
                          선택
                        </button>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary min-h-9 px-3 text-xs"
                        >
                          YouTube에서 보기
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function buildSearchQuery(songTitle: string, suffix: string) {
  const baseTitle = songTitle.trim() || "찬양";
  return `${baseTitle} ${suffix}`.trim();
}

function formatPublishedAt(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" }).format(new Date(timestamp));
}

function decodeHtmlEntities(value: string) {
  if (typeof document === "undefined") return value;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}
