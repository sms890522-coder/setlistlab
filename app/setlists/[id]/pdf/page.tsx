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
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const COPYRIGHT_NOTICE =
  "악보 이미지는 사용 권한이 있는 자료만 등록해 주세요. 공유 및 출력 시 교회가 보유한 라이선스와 저작권 정책을 확인해 주세요.";

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
        <section className={`pdf-cover-page ${setlist.songs.length > 0 ? "pdf-cover-page-with-songs" : ""}`}>
          <div>
            <p className="pdf-eyebrow">콘티연습실</p>
            <PdfToggleBlock label="콘티 이름" className="pdf-title-block">
              <h2 className="pdf-title">{setlist.title || "제목 없는 콘티"}</h2>
            </PdfToggleBlock>
            <PdfToggleBlock label="예배 날짜/이름" className="pdf-info-block">
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoLine label="예배 날짜" value={setlist.worshipDate || "미정"} />
                <InfoLine label="예배 이름" value={setlist.serviceName || "미정"} />
              </div>
            </PdfToggleBlock>
          </div>

          {setlist.description ? (
            <PdfToggleBlock label="전체 설명">
              <p className="pdf-body-text">{setlist.description}</p>
            </PdfToggleBlock>
          ) : null}

          {setlist.globalNotes ? (
            <PdfToggleBlock label="전체 강조사항">
              <p className="pdf-body-text">{setlist.globalNotes}</p>
            </PdfToggleBlock>
          ) : null}

          {teamGroups.length > 0 ? (
            <PdfToggleBlock label="이번 주 팀원">
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {teamGroups.map(({ part, members }) => (
                  <p key={part} className="pdf-team-line">
                    <strong>{part}</strong>: {members.map((member) => formatMemberNameWithEmoji(part, member.name)).join(", ")}
                  </p>
                ))}
              </div>
            </PdfToggleBlock>
          ) : null}

          <p className="pdf-copyright">{COPYRIGHT_NOTICE}</p>
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
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [excluded, setExcluded] = useState(false);

  if (excluded) {
    return (
      <section className="no-print pdf-excluded-block">
        <label className="pdf-exclude-toggle">
          <input type="checkbox" checked={excluded} onChange={(event) => setExcluded(event.target.checked)} />
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
        <input type="checkbox" checked={excluded} onChange={(event) => setExcluded(event.target.checked)} />
        <span>빼기</span>
        <strong>{label}</strong>
      </label>
      {children}
    </section>
  );
}

function PdfImage({ link, imageIndex }: { link: SongLink; imageIndex: number }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = getImagePreviewUrl(link.url);

  if (failed) {
    return <p className="no-print rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">악보 이미지를 불러오지 못했습니다.</p>;
  }

  return (
    <figure className="pdf-image-frame">
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
