import {
  RecordingApiError,
  getRecordingMixSettings,
  upsertRecordingMixSetting,
  type RecordingMixSettingInput,
} from "@/lib/server/recordings";
import { NextResponse } from "next/server";

type UpsertMixSettingRequest = {
  sessionId?: string;
  mix?: RecordingMixSettingInput;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId")?.trim();
    if (!sessionId) {
      return NextResponse.json({ error: "녹음실 정보가 필요합니다." }, { status: 400 });
    }

    const result = await getRecordingMixSettings({ request, sessionId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RecordingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "믹서 설정을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpsertMixSettingRequest;
    if (!body.sessionId || !body.mix?.trackKey) {
      return NextResponse.json({ error: "저장할 믹서 설정이 부족합니다." }, { status: 400 });
    }

    const result = await upsertRecordingMixSetting({
      request,
      sessionId: body.sessionId,
      mix: body.mix,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RecordingApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "믹서 설정을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
