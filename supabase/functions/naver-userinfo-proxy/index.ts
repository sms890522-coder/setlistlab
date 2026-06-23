declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

type NaverUserInfoResponse = {
  resultcode?: string;
  message?: string;
  response?: {
    id?: string;
    email?: string;
    name?: string;
    nickname?: string;
    profile_image?: string;
  };
};

const NAVER_USERINFO_URL = "https://openapi.naver.com/v1/nid/me";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "missing_authorization_header" }, 401);
  }

  try {
    const naverResponse = await fetch(NAVER_USERINFO_URL, {
      headers: {
        authorization,
      },
    });

    if (!naverResponse.ok) {
      console.error("Naver UserInfo request failed", { status: naverResponse.status });
      return jsonResponse({ error: "naver_userinfo_failed" }, 502);
    }

    const payload = (await naverResponse.json()) as NaverUserInfoResponse;
    const profile = payload.response;

    if (!profile?.id) {
      return jsonResponse({ error: "naver_id_missing" }, 400);
    }

    if (!profile.email) {
      return jsonResponse({ error: "naver_email_missing" }, 400);
    }

    const name = profile.name || profile.nickname || profile.email;
    const nickname = profile.nickname || profile.name || undefined;
    const picture = profile.profile_image || undefined;

    return jsonResponse({
      sub: profile.id,
      id: profile.id,
      email: profile.email,
      email_verified: true,
      name,
      nickname,
      avatar_url: picture,
      picture,
      provider: "naver",
    });
  } catch (error) {
    console.error("Naver UserInfo proxy failed", { message: error instanceof Error ? error.message : "unknown_error" });
    return jsonResponse({ error: "naver_userinfo_failed" }, 500);
  }
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}
