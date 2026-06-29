"use client";

export type InAppBrowserInfo = {
  isInAppBrowser: boolean;
  name?: string;
};

const IN_APP_BROWSER_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "KakaoTalk", pattern: /KAKAOTALK/i },
  { name: "NAVER", pattern: /\bNAVER\b|NAVER\(inapp/i },
  { name: "Instagram", pattern: /Instagram/i },
  { name: "Facebook", pattern: /FBAN|FBAV|FB_IAB|FBIOS|FB4A|FBMD|MessengerForiOS/i },
  { name: "LINE", pattern: /\bLine\//i },
  { name: "WeChat", pattern: /MicroMessenger/i },
  { name: "Twitter", pattern: /Twitter/i },
  { name: "TikTok", pattern: /TikTok/i },
  { name: "Daum", pattern: /DaumApps/i },
];

export function detectInAppBrowser(userAgent = getUserAgent()): InAppBrowserInfo {
  if (!userAgent) return { isInAppBrowser: false };

  const matched = IN_APP_BROWSER_PATTERNS.find(({ pattern }) => pattern.test(userAgent));
  if (matched) return { isInAppBrowser: true, name: matched.name };

  if (isAndroidWebView(userAgent)) {
    return { isInAppBrowser: true, name: "Android WebView" };
  }

  return { isInAppBrowser: false };
}

function getUserAgent() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

function isAndroidWebView(userAgent: string) {
  if (!/Android/i.test(userAgent)) return false;
  if (/(; wv\)|\bwv\b|WebView)/i.test(userAgent)) return true;

  const looksLikeLegacyWebView = /Version\/[\d.]+/i.test(userAgent) && /Chrome\/\d+/i.test(userAgent);
  const knownSecureBrowser = /SamsungBrowser|EdgA|OPR|Firefox|FxiOS|CriOS/i.test(userAgent);
  return looksLikeLegacyWebView && !knownSecureBrowser;
}
