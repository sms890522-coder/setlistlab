"use client";

type SheetMusicSearchHelperProps = {
  songTitle: string;
};

export function SheetMusicSearchHelper({ songTitle }: SheetMusicSearchHelperProps) {
  const normalizedTitle = songTitle.trim();
  const canSearch = normalizedTitle.length > 0;

  function openSearch(type: "image" | "code") {
    if (!canSearch) return;

    const query = type === "image" ? `${normalizedTitle} 악보` : `${normalizedTitle} 코드 악보`;
    const url =
      type === "image"
        ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`
        : `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
      <div className="space-y-1">
        <h5 className="font-bold text-slate-950">악보 검색 도우미</h5>
        <p className="text-sm leading-6 text-slate-600">곡 제목을 기준으로 악보 이미지를 빠르게 찾아볼 수 있습니다.</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openSearch("image")}
          disabled={!canSearch}
          className="btn-secondary min-h-10 px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          구글 이미지에서 악보 찾기
        </button>
        <button
          type="button"
          onClick={() => openSearch("code")}
          disabled={!canSearch}
          className="btn-secondary min-h-10 px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          코드 악보 검색
        </button>
      </div>

      {canSearch ? null : (
        <p className="mt-2 text-xs font-semibold text-amber-800">곡 제목을 입력하면 악보 검색이 가능합니다.</p>
      )}

      <p className="mt-3 text-xs leading-5 text-amber-900">
        검색 결과의 악보 이미지는 각 사이트와 저작권자에게 권리가 있을 수 있습니다. 콘티연습실은 악보를 직접
        제공하지 않으며, 사용자가 필요한 자료를 직접 확인할 수 있도록 검색을 도와드립니다. 저작권이 있는 악보는
        권리자의 허락 범위 안에서만 사용해 주세요.
      </p>
    </section>
  );
}
