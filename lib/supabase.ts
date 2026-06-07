"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase/client";
import type { Setlist } from "./types";

type SharedSetlistRow = {
  share_slug: string;
  title: string;
  setlist: Setlist;
  created_at: string;
};

export { isSupabaseConfigured };

export function getSupabaseClient() {
  return getSupabaseBrowserClient();
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

export async function getSharedSetlistCount() {
  if (!isSupabaseConfigured()) return 0;

  const supabase = getSupabaseClient();
  const { count: legacyCount, error } = await supabase
    .from("shared_setlists")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message || "공유 콘티 개수를 불러오지 못했습니다.");
  }

  const { count: publicSetlistCount } = await supabase
    .from("setlists")
    .select("id", { count: "exact", head: true })
    .eq("is_public", true);

  return (legacyCount ?? 0) + (publicSetlistCount ?? 0);
}

function createShareSlug() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(9);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 16);
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
