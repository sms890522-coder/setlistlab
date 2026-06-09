"use client";

import Link from "next/link";
import { SetlistCard } from "@/components/SetlistCard";
import { getCurrentUser } from "@/lib/auth";
import { getMyProfile } from "@/lib/db/profiles";
import {
  deleteCloudSetlist,
  duplicateCloudSetlist,
  getCloudSetlists,
  importLocalSetlistsToCloud,
} from "@/lib/db/setlists";
import { getApprovedMemberships, type TeamMembership } from "@/lib/db/teamMemberships";
import { clearSetlists, deleteSetlist, duplicateSetlist, getSetlists, getStoredSetlists } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Setlist } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type StorageMode = "local" | "cloud";

export default function SetlistsPage() {
  const router = useRouter();
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [localSetlists, setLocalSetlists] = useState<Setlist[]>([]);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [loaded, setLoaded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Setlist | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [importing, setImporting] = useState(false);
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [filter, setFilter] = useState("all");

  const filteredSetlists = setlists.filter((setlist) => {
    if (filter === "all") return true;
    if (filter === "personal") return !setlist.teamId;
    if (filter === "team") return Boolean(setlist.teamId);
    return setlist.teamId === filter;
  });

  useEffect(() => {
    async function loadSetlists() {
      const storedSetlists = getStoredSetlists();
      setLocalSetlists(storedSetlists);

      if (!isSupabaseConfigured()) {
        const browserSetlists = getSetlists();
        setSetlists(browserSetlists);
        setStorageMode("local");
        setLoaded(true);
        return;
      }

      const user = await getCurrentUser();
      if (!user) {
        const browserSetlists = getSetlists();
        setSetlists(browserSetlists);
        setStorageMode("local");
        setLoaded(true);
        return;
      }

      const profile = await getMyProfile();
      if (!profile) {
        router.replace("/onboarding?redirect=/setlists");
        return;
      }

      const [cloudSetlists, approvedMemberships] = await Promise.all([getCloudSetlists(), getApprovedMemberships()]);
      setSetlists(cloudSetlists);
      setMemberships(approvedMemberships);
      setStorageMode("cloud");
      setLoaded(true);
    }

    loadSetlists().catch((error) => {
      setLoadError(error instanceof Error ? error.message : "콘티 목록을 불러오지 못했습니다.");
      setSetlists(getSetlists());
      setStorageMode("local");
      setLoaded(true);
    });
  }, [router]);

  function handleDeleteRequest(id: string) {
    setDeleteTarget(setlists.find((setlist) => setlist.id === id) ?? null);
    setDeleteError("");
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    try {
      if (storageMode === "cloud") {
        await deleteCloudSetlist(deleteTarget.id);
      } else {
        deleteSetlist(deleteTarget.id);
      }
      setSetlists((current) => current.filter((setlist) => setlist.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteError("");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "콘티를 삭제하지 못했습니다.");
    }
  }

  async function handleDuplicate(id: string) {
    const duplicated = storageMode === "cloud" ? await duplicateCloudSetlist(id) : duplicateSetlist(id);
    router.push(`/setlists/${duplicated.id}/edit`);
  }

  async function handleImportLocalSetlists() {
    if (localSetlists.length === 0) return;

    try {
      setImporting(true);
      const imported = await importLocalSetlistsToCloud(localSetlists);
      setSetlists(await getCloudSetlists());
      setMessage(`${imported.length}개의 임시 콘티를 계정 저장소로 가져왔습니다.`);
      if (window.confirm("가져온 뒤 이 브라우저의 임시 콘티를 비울까요?")) {
        clearSetlists();
        setLocalSetlists([]);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "임시 콘티를 가져오지 못했습니다.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="page-shell space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">콘티</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">콘티 목록</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {storageMode === "cloud"
              ? "계정에 저장된 콘티를 다시 열고 수정할 수 있습니다."
              : "로그인 전에는 이 브라우저에만 임시 저장됩니다."}
          </p>
        </div>
      <div className="flex flex-wrap gap-2">
          <Link href="/setlists/new" className="btn-primary">
            새 콘티 만들기
          </Link>
        </div>
      </section>

      {storageMode === "local" ? (
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
          로그인하면 콘티와 곡 보관함을 계정 클라우드에 저장해서 다른 기기에서도 사용할 수 있습니다.{" "}
          <Link href="/login?redirect=/setlists" className="font-black underline underline-offset-4">
            로그인하기
          </Link>
        </section>
      ) : localSetlists.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          현재 브라우저에 임시 저장된 콘티가 있습니다. 계정 저장소로 가져오면 다른 기기에서도 이어서 볼 수 있습니다.
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={handleImportLocalSetlists} disabled={importing} className="btn-primary min-h-10 px-3">
              {importing ? "가져오는 중" : `임시 콘티 ${localSetlists.length}개 가져오기`}
            </button>
          </div>
        </section>
      ) : null}

      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {loadError ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{loadError}</p> : null}

      {storageMode === "cloud" ? (
        <section className="card p-4">
          <label className="block space-y-1 sm:max-w-xs">
            <span className="field-label">콘티 필터</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="field-input">
              <option value="all">전체</option>
              <option value="personal">개인 콘티</option>
              <option value="team">팀 콘티</option>
              {memberships.map((membership) => (
                <option key={membership.teamId} value={membership.teamId}>
                  {membership.team?.churchName} / {membership.team?.teamName}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      {!loaded ? (
        <div className="card p-8 text-sm text-slate-500">콘티를 불러오는 중입니다.</div>
      ) : filteredSetlists.length === 0 ? (
        <div className="card grid gap-4 p-8 text-center">
          <div>
            <h2 className="text-xl font-black text-slate-950">아직 콘티가 없습니다</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              이번 주 예배 콘티를 만들어 팀원들과 공유해 보세요.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/setlists/new" className="btn-primary">
              새 콘티 만들기
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSetlists.map((setlist) => (
            <SetlistCard
              key={setlist.id}
              setlist={setlist}
              onDelete={handleDeleteRequest}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={() => setDeleteTarget(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-setlist-title"
            className="card w-full max-w-md p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-bold text-rose-600">콘티 삭제</p>
            <h2 id="delete-setlist-title" className="mt-2 text-xl font-black text-slate-950">
              {deleteTarget.title || "제목 없는 콘티"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              이 콘티를 삭제할까요? 삭제한 콘티는 되돌릴 수 없습니다.
            </p>
            {deleteError ? (
              <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{deleteError}</p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary">
                취소
              </button>
              <button type="button" onClick={handleDeleteConfirm} className="btn-danger">
                삭제하기
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
