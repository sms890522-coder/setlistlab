import type { SongLink } from "./types";

export function getImagePreviewUrl(url?: string) {
  if (!url) return "";

  const trimmed = url.trim();
  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    return `https://drive.google.com/uc?export=view&id=${driveId}`;
  }

  if (/^https:\/\/www\.dropbox\.com\//i.test(trimmed)) {
    return trimmed.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace(/[?&]dl=0/i, "");
  }

  return trimmed;
}

export function getFirstImageLink(links?: SongLink[]) {
  return links?.find((link) => link.url.trim()) ?? null;
}

function extractGoogleDriveFileId(url: string) {
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (fileMatch?.[1]) return fileMatch[1];

  try {
    const parsed = new URL(url);
    if (/drive\.google\.com$/i.test(parsed.hostname)) {
      return parsed.searchParams.get("id");
    }
  } catch {
    return null;
  }

  return null;
}
