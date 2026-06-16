"use client";

import { useEffect, useState } from "react";

export function AddToHomeScreenGuide() {
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios/.test(userAgent);

    setShowGuide(isIos && isSafari && !isStandalone);
  }, []);

  if (!showGuide) return null;

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
      <p className="font-black">iPhone 홈 화면 추가 안내</p>
      <p className="mt-1">
        iPhone에서 푸시 알림을 받으려면 Safari 공유 버튼을 누른 뒤 “홈 화면에 추가”를 선택해 주세요. 홈 화면에 추가한
        콘티연습실 앱에서 알림을 켤 수 있습니다.
      </p>
    </div>
  );
}
