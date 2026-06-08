"use client";

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCloudSetlist } from "@/lib/db/setlists";
import { getImagePreviewUrl } from "@/lib/images";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import { getSetlist } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { groupTeamAssignments } from "@/lib/teamAssignments";
import type { Setlist, Song, SongLink } from "@/lib/types";
import { useParams } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

const PRINT_HEADER_FOOTER_HELP =
  "주소, 날짜, 페이지 번호는 브라우저 인쇄 옵션이라 앱에서 자동으로 끌 수 없습니다. 인쇄창에서 머리글/바닥글을 꺼 주세요.";

type PdfImageMode = "fit" | "compress-y" | "next-page" | "split";
const DEFAULT_PDF_IMAGE_VERTICAL_SCALE = 90;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PDF_IMAGE_HEIGHT_THRESHOLD_PERCENT = 80;
const PDF_IMAGE_HEIGHT_MAX_REFERENCE_PERCENT = 140;
const PDF_IMAGE_MIN_AUTO_VERTICAL_SCALE = 70;

export default function SetlistPdfPage() {
  const params = useParams<{ id: string }>();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.classList.add("pdf-preview-mode");

    return () => {
      document.body.classList.remove("pdf-preview-mode");
    };
  }, []);

  useEffect(() => {
    async function loadSetlist() {
      if (isSupabaseConfigured()) {
        const user = await getCurrentUser();
        if (user) {
          const cloudSetlist = await getCloudSetlist(params.id);
          if (cloudSetlist) {
            setSetlist(cloudSetlist);
            setLoaded(true);
            return;
          }
        }
      }

      setSetlist(getSetlist(params.id) ?? null);
      setLoaded(true);
    }

    loadSetlist().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "PDF 미리보기를 불러오지 못했습니다.");
      setSetlist(getSetlist(params.id) ?? null);
      setLoaded(true);
    });
  }, [params.id]);

  if (!loaded) {
    return (
      <div className="pdf-preview-shell">
        <div className="card p-8 text-sm text-slate-500">PDF 미리보기를 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!setlist) {
    return (
      <div className="pdf-preview-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">콘티를 찾을 수 없습니다</h1>
          {error ? <p className="mt-3 text-sm leading-6 text-rose-700">{error}</p> : null}
          <Link href="/setlists" className="btn-primary mt-5">
            콘티 목록으로
          </Link>
        </section>
      </div>
    );
  }

  return <SetlistPdfPreview setlist={setlist} />;
}

function SetlistPdfPreview({ setlist }: { setlist: Setlist }) {
  const teamGroups = useMemo(() => groupTeamAssignments(setlist.teamAssignments), [setlist.teamAssignments]);
  const [coverExcluded, setCoverExcluded] = useState<Record<string, boolean>>({});
  const [printMessage, setPrintMessage] = useState("");
  const [printError, setPrintError] = useState("");
  const coverItems = [
    { key: "title", exists: true },
    { key: "service", exists: true },
    { key: "description", exists: Boolean(setlist.description) },
    { key: "globalNotes", exists: Boolean(setlist.globalNotes) },
    { key: "team", exists: teamGroups.length > 0 },
  ];
  const hasVisibleCoverContent = coverItems.some((item) => item.exists && !coverExcluded[item.key]);

  function setCoverItemExcluded(key: string, excluded: boolean) {
    setCoverExcluded((current) => ({ ...current, [key]: excluded }));
  }

  useEffect(() => {
    const nextTitle = getPdfDocumentTitle(setlist);
    document.title = nextTitle;
    const timeoutId = window.setTimeout(() => {
      document.title = nextTitle;
    }, 50);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [setlist.id, setlist.title]);

  function handlePrint() {
    setPrintError("");

    if (typeof window.print !== "function") {
      setPrintMessage("");
      setPrintError("이 브라우저에서는 인쇄창을 바로 열 수 없습니다. 브라우저 메뉴의 인쇄 기능을 사용해 주세요.");
      return;
    }

    try {
      document.title = getPdfDocumentTitle(setlist);
      window.focus();
      window.print();
      window.setTimeout(() => {
        setPrintMessage(`인쇄창이 열리지 않으면 브라우저 메뉴의 인쇄 또는 Ctrl/Cmd+P를 사용해 주세요. ${PRINT_HEADER_FOOTER_HELP}`);
      }, 250);
    } catch (printError) {
      setPrintMessage("");
      setPrintError(
        printError instanceof Error
          ? `인쇄창을 열지 못했습니다. ${printError.message}`
          : "인쇄창을 열지 못했습니다. 브라우저 메뉴의 인쇄 기능을 사용해 주세요.",
      );
    }
  }

  return (
    <div className="pdf-preview-shell">
      <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">콘티 PDF 미리보기</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">{setlist.title || "제목 없는 콘티"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handlePrint} className="btn-primary">
            PDF로 저장/인쇄
          </button>
          <Link href={`/setlists/${setlist.id}`} className="btn-secondary">
            콘티로 돌아가기
          </Link>
        </div>
      </div>
      {printMessage ? (
        <p className="no-print mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-800">
          {printMessage}
        </p>
      ) : null}
      {printError ? (
        <p className="no-print mb-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-700">
          {printError}
        </p>
      ) : null}

      <article className="pdf-document">
        <section
          className={`pdf-cover-page ${hasVisibleCoverContent && setlist.songs.length > 0 ? "pdf-cover-page-with-songs" : ""} ${
            hasVisibleCoverContent ? "" : "no-print pdf-cover-page-hidden"
          }`}
        >
          <div>
            <PdfToggleBlock
              label="콘티 이름"
              className="pdf-title-block"
              excluded={Boolean(coverExcluded.title)}
              onExcludedChange={(excluded) => setCoverItemExcluded("title", excluded)}
            >
              <h2 className="pdf-title">{setlist.title || "제목 없는 콘티"}</h2>
            </PdfToggleBlock>
            <PdfToggleBlock
              label="예배 날짜/이름"
              className="pdf-info-block"
              excluded={Boolean(coverExcluded.service)}
              onExcludedChange={(excluded) => setCoverItemExcluded("service", excluded)}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoLine label="예배 날짜" value={setlist.worshipDate || "미정"} />
                <InfoLine label="예배 이름" value={setlist.serviceName || "미정"} />
              </div>
            </PdfToggleBlock>
          </div>

          {setlist.description ? (
            <PdfToggleBlock
              label="전체 설명"
              excluded={Boolean(coverExcluded.description)}
              onExcludedChange={(excluded) => setCoverItemExcluded("description", excluded)}
            >
              <p className="pdf-body-text">{setlist.description}</p>
            </PdfToggleBlock>
          ) : null}

          {setlist.globalNotes ? (
            <PdfToggleBlock
              label="전체 강조사항"
              excluded={Boolean(coverExcluded.globalNotes)}
              onExcludedChange={(excluded) => setCoverItemExcluded("globalNotes", excluded)}
            >
              <p className="pdf-body-text">{setlist.globalNotes}</p>
            </PdfToggleBlock>
          ) : null}

          {teamGroups.length > 0 ? (
            <PdfToggleBlock
              label="이번 주 팀원"
              excluded={Boolean(coverExcluded.team)}
              onExcludedChange={(excluded) => setCoverItemExcluded("team", excluded)}
            >
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {teamGroups.map(({ part, members }) => (
                  <p key={part} className="pdf-team-line">
                    <strong>{part}</strong>: {members.map((member) => formatMemberNameWithEmoji(part, member.name)).join(", ")}
                  </p>
                ))}
              </div>
            </PdfToggleBlock>
          ) : null}
        </section>

        {setlist.songs.map((song, index) => (
          <SongPdfPage key={song.id} song={song} index={index} isLast={index === setlist.songs.length - 1} />
        ))}
        <div className="pdf-print-watermark" aria-hidden="true">
          콘티연습실
        </div>
      </article>
    </div>
  );
}

function SongPdfPage({ song, index, isLast }: { song: Song; index: number; isLast: boolean }) {
  const songMeta = getSongMeta(song);
  const songForm = song.sections.map((section) => section.name.trim()).filter(Boolean).join(" - ");
  const imageLinks = getSongImageLinks(song);

  return (
    <section className={`pdf-song-page ${isLast ? "pdf-song-page-last" : ""}`}>
      <div className="pdf-song-header">
        <p className="pdf-song-index">{index + 1}</p>
        <div>
          <h2 className="pdf-song-title">{song.title || "제목 없는 곡"}</h2>
          {songMeta ? <p className="pdf-song-meta">{songMeta}</p> : null}
        </div>
      </div>

      {songForm ? (
        <PdfToggleBlock label="송폼">
          <p className="pdf-song-form">{songForm}</p>
        </PdfToggleBlock>
      ) : null}

      {song.description ? (
        <PdfToggleBlock label="곡 설명" defaultExcluded>
          <p className="pdf-body-text">{song.description}</p>
        </PdfToggleBlock>
      ) : null}

      {song.highlights.length > 0 ? (
        <PdfToggleBlock label="강조사항" defaultExcluded>
          <ul className="pdf-list">
            {song.highlights.map((highlight, highlightIndex) => (
              <li key={`${highlight}-${highlightIndex}`}>{highlight}</li>
            ))}
          </ul>
        </PdfToggleBlock>
      ) : null}

      {song.partNotes.length > 0 ? (
        <PdfToggleBlock label="파트별 메모" defaultExcluded>
          <div className="space-y-2">
            {song.partNotes.map((partNote) => (
              <p key={partNote.id} className="pdf-part-note">
                <strong>{partNote.part}</strong>: {partNote.note}
              </p>
            ))}
          </div>
        </PdfToggleBlock>
      ) : null}

      {imageLinks.length > 0 ? (
        <PdfToggleBlock label="악보 이미지">
          <div className="pdf-image-list">
            {imageLinks.map((link, imageIndex) => (
              <PdfToggleBlock
                key={link.id || `${link.url}-${imageIndex}`}
                label={link.label || `악보 이미지 ${imageIndex + 1}`}
                className="pdf-image-toggle"
              >
                <PdfImage link={link} imageIndex={imageIndex} />
              </PdfToggleBlock>
            ))}
          </div>
        </PdfToggleBlock>
      ) : null}
    </section>
  );
}

function PdfToggleBlock({
  label,
  children,
  className = "pdf-section-block",
  excluded: controlledExcluded,
  defaultExcluded = false,
  onExcludedChange,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  excluded?: boolean;
  defaultExcluded?: boolean;
  onExcludedChange?: (excluded: boolean) => void;
}) {
  const [uncontrolledExcluded, setUncontrolledExcluded] = useState(defaultExcluded);
  const excluded = controlledExcluded ?? uncontrolledExcluded;

  function updateExcluded(nextExcluded: boolean) {
    if (onExcludedChange) {
      onExcludedChange(nextExcluded);
    } else {
      setUncontrolledExcluded(nextExcluded);
    }
  }

  if (excluded) {
    return (
      <section className="no-print pdf-excluded-block">
        <label className="pdf-exclude-toggle">
          <input type="checkbox" checked={excluded} onChange={(event) => updateExcluded(event.target.checked)} />
          <span>빼기</span>
          <strong>{label}</strong>
        </label>
        <p className="pdf-excluded-text">{label} 항목을 PDF에서 뺐습니다.</p>
      </section>
    );
  }

  return (
    <section className={className}>
      <label className="pdf-exclude-toggle no-print">
        <input type="checkbox" checked={excluded} onChange={(event) => updateExcluded(event.target.checked)} />
        <span>빼기</span>
        <strong>{label}</strong>
      </label>
      {children}
    </section>
  );
}

function PdfImage({ link, imageIndex }: { link: SongLink; imageIndex: number }) {
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<PdfImageMode>("compress-y");
  const [scale, setScale] = useState(100);
  const [verticalScale, setVerticalScale] = useState(DEFAULT_PDF_IMAGE_VERTICAL_SCALE);
  const [splitRatio, setSplitRatio] = useState(50);
  const verticalScaleTouchedRef = useRef(false);
  const imageUrl = getImagePreviewUrl(link.url);

  useEffect(() => {
    let cancelled = false;
    verticalScaleTouchedRef.current = false;
    setVerticalScale(DEFAULT_PDF_IMAGE_VERTICAL_SCALE);

    const image = new window.Image();
    image.onload = () => {
      if (cancelled || verticalScaleTouchedRef.current) return;
      setVerticalScale(getDefaultPdfImageVerticalScale(image.naturalWidth, image.naturalHeight));
    };
    image.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  if (failed) {
    return <p className="no-print rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">악보 이미지를 불러오지 못했습니다.</p>;
  }

  const splitTotalScreenHeight = 720;
  const splitTotalPrintHeight = 296;
  const splitTopScreenHeight = Math.round((splitTotalScreenHeight * splitRatio) / 100);
  const splitBottomScreenHeight = splitTotalScreenHeight - splitTopScreenHeight;
  const splitTopPrintHeight = Math.round((splitTotalPrintHeight * splitRatio) / 100);
  const splitBottomPrintHeight = splitTotalPrintHeight - splitTopPrintHeight;

  const imageStyle = {
    "--pdf-image-width": `${scale}%`,
    "--pdf-image-max-height": "296mm",
    "--pdf-image-compress-height": `${Math.round((296 * verticalScale) / 100)}mm`,
    "--pdf-image-compress-height-screen": `${Math.round((720 * verticalScale) / 100)}px`,
    "--pdf-image-split-total-screen-height": `${splitTotalScreenHeight}px`,
    "--pdf-image-split-top-screen-height": `${splitTopScreenHeight}px`,
    "--pdf-image-split-bottom-screen-height": `${splitBottomScreenHeight}px`,
    "--pdf-image-split-total-print-height": `${splitTotalPrintHeight}mm`,
    "--pdf-image-split-top-print-height": `${splitTopPrintHeight}mm`,
    "--pdf-image-split-bottom-print-height": `${splitBottomPrintHeight}mm`,
  } as CSSProperties;

  const controls = (
    <div className="no-print pdf-image-controls">
      <div className="flex flex-wrap gap-1.5">
        <PdfImageModeButton mode={mode} value="fit" onChange={setMode}>
          비율 맞춰 줄이기
        </PdfImageModeButton>
        <PdfImageModeButton mode={mode} value="compress-y" onChange={setMode}>
          위아래만 줄이기
        </PdfImageModeButton>
        <PdfImageModeButton mode={mode} value="next-page" onChange={setMode}>
          다음 장
        </PdfImageModeButton>
        <PdfImageModeButton mode={mode} value="split" onChange={setMode}>
          나눠서 넣기
        </PdfImageModeButton>
      </div>

      {mode === "fit" || mode === "next-page" ? (
        <label className="pdf-image-control-field mt-2">
          <span>이미지 크기 {scale}%</span>
          <input
            type="range"
            min="45"
            max="100"
            step="5"
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
          />
        </label>
      ) : null}

      {mode === "compress-y" ? (
        <label className="pdf-image-control-field mt-2">
          <span>세로 높이 {verticalScale}%</span>
          <input
            type="range"
            min="45"
            max="100"
            step="5"
            value={verticalScale}
            onChange={(event) => {
              verticalScaleTouchedRef.current = true;
              setVerticalScale(Number(event.target.value));
            }}
          />
        </label>
      ) : null}

      {mode === "split" ? (
        <div className="mt-2 space-y-1.5">
          <label className="pdf-image-control-field">
            <span>나누는 위치 위쪽 {splitRatio}% / 아래쪽 {100 - splitRatio}%</span>
            <input
              type="range"
              min="30"
              max="70"
              step="5"
              value={splitRatio}
              onChange={(event) => setSplitRatio(Number(event.target.value))}
            />
          </label>
          <p className="text-[11px] font-semibold leading-4 text-slate-500">
            위쪽은 현재 페이지에, 아래쪽은 인쇄할 때 다음 페이지에 이어서 들어갑니다.
          </p>
        </div>
      ) : null}
    </div>
  );

  if (mode === "split") {
    return (
      <figure className="pdf-image-frame pdf-image-frame-split" style={imageStyle}>
        {controls}
        <div className="pdf-split-piece pdf-split-piece-top">
          <img
            src={imageUrl}
            alt={`${link.label || `악보 이미지 ${imageIndex + 1}`} 위쪽`}
            className="pdf-image pdf-split-image pdf-split-image-top"
            onError={() => setFailed(true)}
          />
        </div>
        <div className="pdf-split-piece pdf-split-piece-bottom">
          <img
            src={imageUrl}
            alt={`${link.label || `악보 이미지 ${imageIndex + 1}`} 아래쪽`}
            className="pdf-image pdf-split-image pdf-split-image-bottom"
            onError={() => setFailed(true)}
          />
        </div>
        {link.label ? <figcaption className="pdf-image-caption">{link.label}</figcaption> : null}
      </figure>
    );
  }

  return (
    <figure
      className={`pdf-image-frame ${mode === "next-page" ? "pdf-image-frame-next-page" : ""} ${
        mode === "compress-y" ? "pdf-image-frame-compress-y" : ""
      }`}
      style={imageStyle}
    >
      {controls}

      <img
        src={imageUrl}
        alt={link.label || `악보 이미지 ${imageIndex + 1}`}
        className="pdf-image"
        onError={() => setFailed(true)}
      />
      {link.label ? <figcaption className="pdf-image-caption">{link.label}</figcaption> : null}
    </figure>
  );
}

function PdfImageModeButton({
  mode,
  value,
  onChange,
  children,
}: {
  mode: PdfImageMode;
  value: PdfImageMode;
  onChange: (mode: PdfImageMode) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={mode === value ? "pdf-image-mode-button pdf-image-mode-button-active" : "pdf-image-mode-button"}
    >
      {children}
    </button>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="pdf-info-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}

function getSongMeta(song: Song) {
  const key = song.practiceKey || song.originalKey;
  const parts = [];

  if (key) parts.push(`${key} key`);
  if (typeof song.bpm === "number") parts.push(`BPM ${song.bpm}`);

  return parts.join(" / ");
}

function getSongImageLinks(song: Song) {
  return (song.imageLinks ?? []).filter((link) => /^https?:\/\/\S+$/i.test(link.url.trim()));
}

function getPdfDocumentTitle(setlist: Setlist) {
  const title = (setlist.title || "콘티").trim();
  return title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").slice(0, 80) || "콘티";
}

function getDefaultPdfImageVerticalScale(width: number, height: number) {
  if (!width || !height) return DEFAULT_PDF_IMAGE_VERTICAL_SCALE;

  const imageHeightPercentOfA4 = ((height / width) * A4_WIDTH_MM * 100) / A4_HEIGHT_MM;
  if (imageHeightPercentOfA4 <= PDF_IMAGE_HEIGHT_THRESHOLD_PERCENT) return 100;

  const overflowRange = PDF_IMAGE_HEIGHT_MAX_REFERENCE_PERCENT - PDF_IMAGE_HEIGHT_THRESHOLD_PERCENT;
  const scaleRange = 100 - PDF_IMAGE_MIN_AUTO_VERTICAL_SCALE;
  const overflowRatio = (imageHeightPercentOfA4 - PDF_IMAGE_HEIGHT_THRESHOLD_PERCENT) / overflowRange;
  const suggestedScale = 100 - overflowRatio * scaleRange;
  return clampToStep(suggestedScale, PDF_IMAGE_MIN_AUTO_VERTICAL_SCALE, 100, 5);
}

function clampToStep(value: number, min: number, max: number, step: number) {
  const stepped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, stepped));
}
