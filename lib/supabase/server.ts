import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function isSupabaseServerConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseServerClient(): SupabaseClient {
  if (!isSupabaseServerConfigured()) {
    throw new Error("Supabase 설정이 없습니다. 환경변수를 먼저 설정해 주세요.");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
