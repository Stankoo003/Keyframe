"use client";

import { masterPlaylistUrl } from "@/lib/media";

import { PlayerControls } from "./player-controls";
import { usePlayer } from "./use-player";

/**
 * Container plejera: drži <video> element, kroz `usePlayer` kreira engine i
 * prosleđuje stanje `PlayerControls`-u. Sam ne dodiruje hls.js — sav HLS je iza
 * engine-a. <video> je bez `controls` atributa: nativne kontrole su isključene,
 * koristimo isključivo naš UI.
 */
export function HlsPlayer({ clip, title }: { clip: string; title?: string }) {
  const src = masterPlaylistUrl(clip);
  const { videoRef, containerRef, state, actions } = usePlayer(src);

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="group relative overflow-hidden rounded-lg bg-black"
    >
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
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
