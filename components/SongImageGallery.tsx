import { getImagePreviewUrl } from "@/lib/images";
import type { SongLink } from "@/lib/types";

type SongImageGalleryProps = {
  imageLinks?: SongLink[];
};

export function SongImageGallery({ imageLinks = [] }: SongImageGalleryProps) {
  const links = imageLinks.filter((link) => /^https?:\/\/\S+$/i.test(link.url.trim()));

  if (links.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="font-bold text-slate-950">곡 이미지</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">외부에 저장된 이미지를 링크로 불러옵니다.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50"
          >
            <img
              src={getImagePreviewUrl(link.url)}
              alt={link.label || "곡 이미지"}
              className="max-h-80 w-full rounded-md object-contain"
              loading="lazy"
            />
            <p className="mt-3 text-sm font-bold text-slate-800 group-hover:text-blue-700">{link.label || "이미지 열기"}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
