"use client";

import { getActivePracticePresence, heartbeatPracticePresence, type PracticePresence } from "@/lib/db/practicePresence";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import type { Setlist, Song } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type PracticePresencePanelProps = {
  setlist: Setlist;
  song: Song;
};

export function PracticePresencePanel({ setlist, song }: PracticePresencePanelProps) {
  const [presence, setPresence] = useState<PracticePresence[]>([]);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const groupedPresence = useMemo(() => {
    return presence.reduce<Record<string, string[]>>((acc, item) => {
      const names = acc[item.role] ?? [];
      if (!names.includes(item.displayName)) {
        names.push(item.displayName);
      }
      acc[item.role] = names;
      return acc;
    }, {});
  }, [presence]);

  useEffect(() => {
    let cancelled = false;

    async function syncPresence() {
      const shared = await heartbeatPracticePresence(setlist, song).catch(() => false);
      const activePresence = await getActivePracticePresence(setlist.id, song.id).catch(() => []);

      if (cancelled) return;
      setSharingEnabled(shared);
      setPresence(activePresence);
      setLoaded(true);
    }

    syncPresence();
    const intervalId = window.setInterval(syncPresence, 25_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [setlist, song]);

  if (!loaded) {
    return (
      <section className="card p-4">
        <p className="text-sm font-semibold text-slate-500">연습중인 팀원을 확인하는 중입니다.</p>
      </section>
    );
  }

  if (!sharingEnabled && presence.length === 0) {
    return (
      <section className="card p-4">
        <h2 className="font-bold text-slate-950">연습중인 팀원</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          계정에서 연습중 표시 공유를 켜면 같은 팀 콘티를 보는 승인된 팀원에게 현재 연습 중인 상태가 보입니다.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-slate-950">연습중인 팀원</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">같은 team_id의 승인된 팀원만 표시됩니다.</p>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          {presence.length}명 연습중
        </span>
      </div>

      {presence.length === 0 ? (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">아직 이 곡을 연습 중인 팀원이 없습니다.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(groupedPresence).map(([role, names]) => (
            <span key={role} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
              {role}: {names.map((name) => formatMemberNameWithEmoji(role, name)).join(", ")}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
