const DEFAULT_REDIRECT_PATH = "/setlists";
const SAFE_REDIRECT_ORIGIN = "https://setlistlab.local";

export function sanitizeRedirectPath(value?: string | null, fallback = DEFAULT_REDIRECT_PATH) {
  const safeFallback = normalizeFallback(fallback);
  const candidate = value?.trim();

  if (!candidate) return safeFallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return safeFallback;
  if (candidate.includes("\\") || /[\u0000-\u001f\u007f]/.test(candidate)) return safeFallback;

  try {
    const parsed = new URL(candidate, SAFE_REDIRECT_ORIGIN);
    if (parsed.origin !== SAFE_REDIRECT_ORIGIN) return safeFallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return safeFallback;
  }
}

function normalizeFallback(fallback: string) {
  if (!fallback.startsWith("/") || fallback.startsWith("//") || fallback.includes("\\")) {
    return DEFAULT_REDIRECT_PATH;
  }

  return fallback;
}
