"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Setlist } from "./types";

type SharedSetlistRow = {
  share_slug: string;
  title: string;
  setlist: Setlist;
  created_at: string;
};

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("공유 서버 설정이 없습니다.");
  }

  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }

  return client;
}

export async function publishSetlist(setlist: Setlist) {
  const supabase = getSupabaseClient();
  const shareSlug = createShareSlug();

  const { data, error } = await supabase
    .from("shared_setlists")
    .insert({
      share_slug: shareSlug,
      title: setlist.title,
      setlist,
    })
    .select("share_slug")
    .single();

  if (error) {
    throw new Error(error.message || "공유 서버에 콘티를 저장하지 못했습니다.");
  }

  return data.share_slug as string;
}

export async function getSharedSetlist(shareSlug: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("shared_setlists")
    .select("share_slug,title,setlist,created_at")
    .eq("share_slug", shareSlug)
    .single<SharedSetlistRow>();

  if (error) {
    throw new Error(error.message || "공유 콘티를 불러오지 못했습니다.");
  }

  return data;
}

function createShareSlug() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(9);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 16);
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
