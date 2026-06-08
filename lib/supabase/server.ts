import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function isSupabaseServerConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseServerClient(): SupabaseClient {
  if (!isSupabaseServerConfigured()) {
    throw new Error("로그인 기능이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
