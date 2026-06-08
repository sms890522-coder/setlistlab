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
import { useEffect, useMemo, useState } from "react";

const COPYRIGHT_NOTICE =
  "악보 이미지는 사용 권한이 있는 자료만 등록해 주세요. 공유 및 출력 시 교회가 보유한 라이선스와 저작권 정책을 확인해 주세요.";

type PdfImageMode = "fit" | "next-page" | "crop";
type PdfCropPosition = "top" | "center" | "bottom";

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

  return (
    <div className="pdf-preview-shell">
      <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">콘티 PDF 미리보기</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">{setlist.title || "제목 없는 콘티"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="btn-primary">
            PDF로 저장/인쇄
          </button>
          <Link href={`/setlists/${setlist.id}`} className="btn-secondary">
            콘티로 돌아가기
          </Link>
        </div>
      </div>

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

          {hasVisibleCoverContent ? <p className="pdf-copyright">{COPYRIGHT_NOTICE}</p> : null}
        </section>

        {setlist.songs.map((song, index) => (
          <SongPdfPage key={song.id} song={song} index={index} isLast={index === setlist.songs.length - 1} />
        ))}
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
        <PdfToggleBlock label="곡 설명">
          <p className="pdf-body-text">{song.description}</p>
        </PdfToggleBlock>
      ) : null}

      {song.highlights.length > 0 ? (
        <PdfToggleBlock label="강조사항">
          <ul className="pdf-list">
            {song.highlights.map((highlight, highlightIndex) => (
              <li key={`${highlight}-${highlightIndex}`}>{highlight}</li>
            ))}
          </ul>
        </PdfToggleBlock>
      ) : null}

      {song.partNotes.length > 0 ? (
        <PdfToggleBlock label="파트별 메모">
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
  onExcludedChange,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  excluded?: boolean;
  onExcludedChange?: (excluded: boolean) => void;
}) {
  const [uncontrolledExcluded, setUncontrolledExcluded] = useState(false);
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
  const [mode, setMode] = useState<PdfImageMode>("fit");
  const [scale, setScale] = useState(100);
  const [cropHeight, setCropHeight] = useState(220);
  const [cropPosition, setCropPosition] = useState<PdfCropPosition>("center");
  const imageUrl = getImagePreviewUrl(link.url);

  if (failed) {
    return <p className="no-print rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">악보 이미지를 불러오지 못했습니다.</p>;
  }

  const imageStyle = {
    "--pdf-image-width": `${scale}%`,
    "--pdf-image-max-height": "250mm",
    "--pdf-image-crop-height": `${cropHeight}mm`,
    "--pdf-image-crop-height-screen": `${Math.round(cropHeight * 1.55)}px`,
    "--pdf-image-position": getCropObjectPosition(cropPosition),
  } as CSSProperties;

  return (
    <figure
      className={`pdf-image-frame ${mode === "next-page" ? "pdf-image-frame-next-page" : ""} ${
        mode === "crop" ? "pdf-image-frame-crop" : ""
      }`}
      style={imageStyle}
    >
      <div className="no-print pdf-image-controls">
        <div className="flex flex-wrap gap-1.5">
          <PdfImageModeButton mode={mode} value="fit" onChange={setMode}>
            줄여서 넣기
          </PdfImageModeButton>
          <PdfImageModeButton mode={mode} value="next-page" onChange={setMode}>
            다음 장
          </PdfImageModeButton>
          <PdfImageModeButton mode={mode} value="crop" onChange={setMode}>
            잘라서 넣기
          </PdfImageModeButton>
        </div>

        {mode === "crop" ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr]">
            <label className="pdf-image-control-field">
              <span>남길 위치</span>
              <select value={cropPosition} onChange={(event) => setCropPosition(event.target.value as PdfCropPosition)}>
                <option value="top">위쪽</option>
                <option value="center">가운데</option>
                <option value="bottom">아래쪽</option>
              </select>
            </label>
            <label className="pdf-image-control-field">
              <span>자르기 높이 {cropHeight}mm</span>
              <input
                type="range"
                min="120"
                max="260"
                step="10"
                value={cropHeight}
                onChange={(event) => setCropHeight(Number(event.target.value))}
              />
            </label>
          </div>
        ) : (
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
        )}
      </div>

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

function getCropObjectPosition(position: PdfCropPosition) {
  if (position === "top") return "center top";
  if (position === "bottom") return "center bottom";
  return "center center";
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
