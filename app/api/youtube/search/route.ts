import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type YouTubeSearchItem = {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      medium?: {
        url?: string;
      };
      default?: {
        url?: string;
      };
    };
  };
};

type YouTubeSearchResponse = {
  items?: YouTubeSearchItem[];
  error?: {
    message?: string;
  };
};

function getRequestReferer(request: Request) {
  const requestUrl = new URL(request.url);
  const configuredSiteUrl =
    process.env.YOUTUBE_API_REFERER ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const origin =
    configuredSiteUrl ||
    request.headers.get("origin") ||
    requestUrl.origin;

  if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
    return undefined;
  }

  return origin.endsWith("/") ? origin : `${origin}/`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "검색어를 입력해 주세요." }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YouTube 검색 설정이 준비되지 않았습니다." }, { status: 500 });
  }

  const youtubeParams = new URLSearchParams({
    key: apiKey,
    part: "snippet",
    type: "video",
    maxResults: "5",
    q: query.slice(0, 100),
    regionCode: "KR",
    relevanceLanguage: "ko",
    safeSearch: "moderate",
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${youtubeParams.toString()}`, {
    cache: "no-store",
    headers: {
      Referer: getRequestReferer(request) ?? "",
    },
  });
  const data = (await response.json().catch(() => ({}))) as YouTubeSearchResponse;

  if (!response.ok) {
    return NextResponse.json(
      { error: data.error?.message || "YouTube 검색에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: response.status },
    );
  }

  const results = (data.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;

      return {
        videoId,
        title: item.snippet?.title ?? "제목 없음",
        channelTitle: item.snippet?.channelTitle ?? "채널 정보 없음",
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
        publishedAt: item.snippet?.publishedAt ?? "",
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ results });
}
