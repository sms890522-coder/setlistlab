import { parseChordLine } from "@/lib/music/chords";
import { NextRequest, NextResponse } from "next/server";

type ExtractRequest = {
  imageUrl?: string;
  songTitle?: string;
  key?: string;
};

export async function POST(request: NextRequest) {
  let body: ExtractRequest;

  try {
    body = (await request.json()) as ExtractRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const imageUrl = body.imageUrl?.trim();
  if (!imageUrl) {
    return NextResponse.json({ error: "image_url_required" }, { status: 400 });
  }

  const provider = process.env.GUIDE_TRACK_VISION_PROVIDER?.trim() || "none";
  const apiKey = process.env.GUIDE_TRACK_VISION_API_KEY?.trim();

  if (provider === "none" || !apiKey) {
    return NextResponse.json({
      chords: [],
      manualMode: true,
      warnings: ["코드 자동 추출 API가 설정되어 있지 않아 수동 입력 모드로 진행합니다."],
    });
  }

  if (provider === "custom") {
    const endpoint = process.env.GUIDE_TRACK_VISION_ENDPOINT?.trim();
    if (!endpoint) {
      return NextResponse.json({
        chords: [],
        manualMode: true,
        warnings: ["사용자 지정 코드 추출 엔드포인트가 없어 수동 입력 모드로 진행합니다."],
      });
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ imageUrl, songTitle: body.songTitle, key: body.key }),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({
        chords: [],
        manualMode: true,
        warnings: ["코드 자동 추출에 실패해 수동 입력 모드로 진행합니다."],
      });
    }

    const data = (await response.json()) as { chords?: Array<{ chord?: string; rawText?: string; confidence?: number }> };
    const chords = (data.chords ?? [])
      .map((item) => {
        const chord = parseChordLine(item.chord || item.rawText || "")[0];
        return chord
          ? {
              chord,
              rawText: item.rawText || item.chord || chord,
              confidence: typeof item.confidence === "number" ? item.confidence : undefined,
              source: "image" as const,
            }
          : null;
      })
      .filter(Boolean);

    return NextResponse.json({ chords, warnings: [] });
  }

  return NextResponse.json({
    chords: [],
    manualMode: true,
    warnings: [`${provider} 코드 추출 provider는 아직 이 앱에 연결되지 않아 수동 입력 모드로 진행합니다.`],
  });
}
