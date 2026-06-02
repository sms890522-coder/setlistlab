const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{6,}$/;

export function extractYouTubeVideoId(url?: string) {
  if (!url) return undefined;

  const trimmed = url.trim();
  if (!trimmed || trimmed.toLowerCase().includes("placeholder")) return undefined;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return sanitizeVideoId(id);
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const watchId = parsed.searchParams.get("v");
      if (watchId) return sanitizeVideoId(watchId);

      const [kind, id] = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(kind ?? "")) {
        return sanitizeVideoId(id);
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function sanitizeVideoId(id?: string | null) {
  if (!id) return undefined;
  const cleanId = id.split("?")[0]?.split("&")[0]?.trim();
  return cleanId && VIDEO_ID_PATTERN.test(cleanId) ? cleanId : undefined;
}

export function parseTimeToSeconds(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Math.round(Number(trimmed)));
  }

  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3) return undefined;

  const numbers = parts.map((part) => Number(part));
  if (numbers.some((number) => Number.isNaN(number) || number < 0)) return undefined;

  if (parts.length === 2) {
    const [minutes, seconds] = numbers;
    if (seconds >= 60) return undefined;
    return Math.round(minutes * 60 + seconds);
  }

  const [hours, minutes, seconds] = numbers;
  if (minutes >= 60 || seconds >= 60) return undefined;
  return Math.round(hours * 3600 + minutes * 60 + seconds);
}

export function formatSecondsToTime(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "";

  const totalSeconds = Math.max(0, Math.round(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const two = (part: number) => part.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${two(minutes)}:${two(seconds)}`;
  }

  return `${two(minutes)}:${two(seconds)}`;
}
