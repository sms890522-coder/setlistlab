export type YTPlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlaybackRate: () => number;
  getPlayerState: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate: (rate: number) => void;
};

export type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: { target: YTPlayer }) => void;
        onError?: (event: { data: number }) => void;
        onStateChange?: (event: { data: number }) => void;
        onPlaybackRateChange?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YOUTUBE_ENDED = 0;
export const YOUTUBE_PLAYING = 1;

export function isReadyPlayer(player: YTPlayer | null): player is YTPlayer {
  return Boolean(
    player &&
      typeof player.getCurrentTime === "function" &&
      typeof player.getDuration === "function" &&
      typeof player.getPlaybackRate === "function" &&
      typeof player.getPlayerState === "function" &&
      typeof player.pauseVideo === "function" &&
      typeof player.playVideo === "function" &&
      typeof player.seekTo === "function" &&
      typeof player.setPlaybackRate === "function",
  );
}

export function safeDestroy(player: YTPlayer | null) {
  if (player && typeof player.destroy === "function") {
    player.destroy();
  }
}

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    const previousCallback = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      reject(new Error("YouTube IFrame API load timeout"));
    }, 12000);

    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (window.YT?.Player) {
        window.clearTimeout(timeout);
        resolve(window.YT);
      }
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("YouTube IFrame API script failed"));
      };
      document.head.appendChild(script);
    }
  });
}

export function getYouTubeErrorMessage(code: number) {
  if (code === 2) return "유튜브 영상 ID가 올바르지 않습니다. 링크를 다시 확인해 주세요.";
  if (code === 5) return "이 브라우저에서 재생할 수 없는 유튜브 영상입니다.";
  if (code === 100) return "삭제되었거나 공개되지 않은 유튜브 영상입니다.";
  if (code === 101 || code === 150) return "이 영상은 외부 사이트 임베드를 허용하지 않습니다.";
  return "유튜브 영상을 재생할 수 없습니다. 다른 링크로 다시 시도해 주세요.";
}
