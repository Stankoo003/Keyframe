"use client";

import { PlayerControls } from "./player-controls";
import { usePlayer } from "./use-player";

/**
 * Container plejera: drži <video> element, kroz `usePlayer` kreira engine i
 * prosleđuje stanje `PlayerControls`-u. Sam ne dodiruje hls.js — sav HLS je iza
 * engine-a. <video> je bez `controls` atributa: nativne kontrole su isključene,
 * koristimo isključivo naš UI.
 *
 * `src` stize gotov spolja (`video.manifestUrl` iz baze), a ne gradi se ovde iz
 * slug-a: relativna putanja i base URL se spajaju na jednom mestu, u
 * `src/server/videos.ts`, pa plejer ne mora da zna kako je media organizovana.
 */
export function HlsPlayer({
  src,
  title,
  poster,
}: {
  src: string;
  title?: string;
  poster?: string | null;
}) {
  const { videoRef, containerRef, state, actions } = usePlayer(src);

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="group border-kf-line relative overflow-hidden rounded-xl border bg-black"
    >
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        aria-label={title ? `Video: ${title}` : "Video"}
        onClick={actions.togglePlay}
        className="aspect-video w-full cursor-pointer bg-black"
      />

      {state.error ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-400">
          Greška pri reprodukciji: {state.error}
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <PlayerControls state={state} actions={actions} />
        </div>
      )}
    </div>
  );
}
