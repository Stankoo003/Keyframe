"use client";

import { useEffect, useMemo, useState } from "react";

import type { SubtitleDto } from "@/domain/video";

import { prepareSubtitle, SubtitleError } from "./subtitle-source";

export type SubtitleTrack = {
  id: string;
  lang: string;
  label: string;
  /** `blob:` URL sa konvertovanim WebVTT-om. */
  url: string;
};

export type SubtitleFailure = { id: string; label: string; message: string };

/**
 * Titlovi se ne kace direktno na <track src>, nego se prvo preuzmu i pretvore
 * u blob.
 *
 * Isti put vazi i za VTT i za SRT, iako VTT konverziju ne trazi. Dve prednosti:
 * provera enkodinga (vidi `subtitle-source.ts`) vazi za oba formata, i
 * neuspeh se vidi OVDE, kao poruka, umesto da bude `error` dogadjaj na <track>
 * elementu iz kog se ne moze saznati sta je poslo naopako.
 *
 * Cena: titl se vise ne strimuje kroz sam element, nego prolazi kroz `fetch` —
 * pa mora da prodje CORS (isto pravilo koje je vec vazilo zbog `crossOrigin`
 * atributa na <video>, vidi `player-surface.tsx`).
 */
export function useSubtitleTracks(
  subtitles: readonly SubtitleDto[],
  videoRef: React.RefObject<HTMLVideoElement | null>,
): { tracks: SubtitleTrack[]; failures: SubtitleFailure[] } {
  /**
   * Rezultat nosi i potpis liste za koju je nastao. Bez toga bi se, dok se novi
   * titlovi preuzimaju, jos uvek vracale staze prethodnog snimka — a njihovi
   * blob-ovi su u tom trenutku vec opozvani.
   */
  const [result, setResult] = useState<{
    signature: string;
    tracks: SubtitleTrack[];
    failures: SubtitleFailure[];
  }>(EMPTY);

  /**
   * Efekat NE sme da zavisi od same `subtitles` reference: roditelj je pravi u
   * renderu, pa bi svaki render ponovo preuzeo titlove i napravio nove blob-ove
   * — tacno curenje koje ovaj zadatak treba da izbegne. Potpis liste je stabilan.
   */
  const signature = useMemo(
    () => subtitles.map((subtitle) => `${subtitle.id}:${subtitle.url}`).join("|"),
    [subtitles],
  );

  useEffect(() => {
    if (signature === "") return;

    const controller = new AbortController();
    const created: string[] = [];
    let cancelled = false;

    void (async () => {
      const tracks: SubtitleTrack[] = [];
      const failures: SubtitleFailure[] = [];

      for (const subtitle of subtitles) {
        try {
          const response = await fetch(subtitle.url, { signal: controller.signal });
          if (!response.ok) throw new SubtitleError(`server je vratio ${response.status}`);

          // Trajanje se cita u trenutku konverzije. Ako metapodaci jos nisu
          // stigli (`NaN`), klampovanje se preskace — vidi `srtToVtt`.
          const duration = videoRef.current?.duration;
          const { vtt } = prepareSubtitle(await response.arrayBuffer(), { duration });

          const url = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
          created.push(url);
          tracks.push({ id: subtitle.id, lang: subtitle.lang, label: subtitle.label, url });
        } catch (error) {
          if (controller.signal.aborted) return;
          failures.push({
            id: subtitle.id,
            label: subtitle.label,
            message: error instanceof SubtitleError ? error.message : "titl se nije ucitao",
          });
        }
      }

      if (cancelled) return;
      setResult({ signature, tracks, failures });
    })();

    return () => {
      cancelled = true;
      controller.abort();
      // Bezuslovno oslobadjanje: blob ostaje u memoriji sve dok se ne opozove,
      // pa bi prebacivanje snimaka bez ovoga curilo ceo tekst titla po snimku.
      created.forEach((url) => URL.revokeObjectURL(url));
    };
    // `subtitles` i `videoRef` se citaju unutra, ali okidac je iskljucivo
    // potpis liste — vidi komentar uz `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return result.signature === signature ? result : EMPTY;
}

const EMPTY = { signature: "", tracks: [], failures: [] };
