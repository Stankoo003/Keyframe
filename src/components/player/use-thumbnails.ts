"use client";

import { useEffect, useState } from "react";

import { parseThumbnailVtt, type ThumbnailCue } from "./thumbnails";

/**
 * Sličice jednog snimka: isecci + oblik mreze u spriteu.
 *
 * `cols`/`rows` ne pisu u `.vtt`-u — citaju se iz ucitane slike. Potrebni su
 * jer se sličica na kartici poglavlja skalira na sirinu kartice, a to se u CSS-u
 * radi procentualnim `background-size`-om, koji trazi broj polja mreze. Preview
 * iznad seek trake ih ne koristi (tamo je isecak u nativnoj velicini).
 */
export type ThumbnailMap = {
  cues: readonly ThumbnailCue[];
  cols: number;
  rows: number;
};

/** Stabilna referenca — da povratna vrednost ne bude nov objekat na svaki render. */
const NONE: ThumbnailMap = { cues: [], cols: 0, rows: 0 };

/**
 * Ucitava `thumbs.vtt` i sam sprite.
 *
 * Za razliku od `use-subtitle-tracks.ts`, neuspeh se NE prijavljuje: sličice su
 * ukras, ne sadrzaj. Video enkodiran pre nego sto je sprite postojao vraca 404,
 * i to je ocekivano stanje — baner ili greska u konzoli bi bili laz.
 *
 * Rezultat se objavljuje tek kad se slika ZAISTA ucita. Time se dobija dvoje:
 * dimenzije mreze, i to da prvi hover nikad ne pokaze prazan okvir.
 */
export function useThumbnails(vttUrl: string | null): ThumbnailMap {
  /*
   * Uz mapu se pamti i URL sa kog je stigla, pa se rezultat IZVODI umesto da se
   * resetuje. Da se drzi samo mapa, promena videa bi na tren pokazivala sličice
   * prethodnog, dok novi fetch ne stigne.
   */
  const [loaded, setLoaded] = useState<{ url: string; map: ThumbnailMap } | null>(null);

  useEffect(() => {
    if (!vttUrl) return;

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(vttUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));

        const cues = parseThumbnailVtt(await response.text(), vttUrl);
        if (cancelled) return;
        if (cues.length === 0) throw new Error("nema cue-ova");

        const first = cues[0]!;
        const map = await loadSpriteGrid(first);
        if (cancelled) return;

        setLoaded({ url: vttUrl, map: { cues, ...map } });
      } catch {
        // Namerno tiho — vidi komentar iznad.
        if (!cancelled) setLoaded({ url: vttUrl, map: NONE });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [vttUrl]);

  return loaded !== null && loaded.url === vttUrl ? loaded.map : NONE;
}

/**
 * Ucitava sprite i racuna koliko polja mreza ima.
 *
 * Deljenjem prirodne velicine slike velicinom pločice — a ne konstantom iz
 * `encode.sh` — mreza sme da se promeni u skripti bez izmene u plejeru.
 */
function loadSpriteGrid(cue: ThumbnailCue): Promise<{ cols: number; rows: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const cols = Math.round(image.naturalWidth / cue.w);
      const rows = Math.round(image.naturalHeight / cue.h);

      if (cols < 1 || rows < 1) reject(new Error("sprite manji od jedne pločice"));
      else resolve({ cols, rows });
    };
    image.onerror = () => reject(new Error(`sprite se nije ucitao: ${cue.src}`));

    image.src = cue.src;
  });
}
