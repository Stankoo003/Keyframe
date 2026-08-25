"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { prepareSubtitle, SubtitleError } from "./subtitle-source";

/**
 * Titl koji je gledalac ucitao sa svog racunara.
 *
 * `id` je konstantan jer je uvek najvise jedan takav titl — sledeci ucitan fajl
 * zamenjuje prethodni. `lang: "und"` je ISO 639-2 oznaka za "nepoznat jezik":
 * ime fajla ne govori nista o jeziku, a lagati `srcLang` bi zbunilo i citac
 * ekrana i browserov izbor podrazumevane staze.
 */
export type LocalSubtitle = { id: "local"; lang: "und"; label: string; url: string };

/** Duga imena fajlova bi razvukla pilulu u kontrolama preko cele trake. */
const MAX_LABEL = 28;

/**
 * Ucitavanje titla iz korisnikovog fajla — bez servera.
 *
 * Sav posao radi `prepareSubtitle` iz `subtitle-source.ts`, isti modul kojim
 * prolaze i titlovi sa mreze: prepoznavanje formata iz SADRZAJA (a ne iz
 * ekstenzije, koja redovno laze), dekodiranje enkodinga, SRT -> WebVTT i
 * klampovanje na trajanje snimka. Ovde ostaje samo ono sto taj modul namerno
 * nema: `File`, `Blob` i zivotni vek `blob:` URL-a.
 *
 * ZASTO ZASEBAN HOOK, a ne prosirenje `useSubtitleTracks`: taj hook u cleanup-u
 * BEZUSLOVNO opoziva sve blob-ove koje je napravio cim se promeni potpis liste
 * titlova. Korisnikov titl ne sme da nestane zbog tudje promene, pa mu treba
 * sopstveni zivotni vek.
 *
 * Titl NE prezivljava osvezavanje stranice: `blob:` URL umire sa dokumentom, a
 * `File` se ne moze rekonstruisati iz `localStorage`-a. Cuvanje samog teksta bi
 * bilo moguce, ali bi znacilo megabajte u `localStorage`-u po snimku — vidi i
 * napomenu u `caption-prefs.ts` da je taj modul samo za izgled.
 */
export function useLocalSubtitle(videoRef: React.RefObject<HTMLVideoElement | null>): {
  track: LocalSubtitle | null;
  error: string | null;
  load: (file: File) => Promise<void>;
  clear: () => void;
} {
  const [track, setTrack] = useState<LocalSubtitle | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Poslednji napravljen `blob:` URL. Ref, a ne izvedena vrednost iz `track`:
   * cleanup pri unmount-u mora da vidi TEKUCU vrednost, a ne onu zarobljenu u
   * closure-u iz prvog rendera.
   */
  const urlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  // Bez ovoga bi tekst titla ostao u memoriji i posle napustanja stranice sa
  // plejerom — blob zivi dok se ne opozove, bez obzira na React.
  useEffect(() => revoke, [revoke]);

  const load = useCallback(
    async (file: File) => {
      try {
        // Trajanje se cita SAD, ne pri renderu: pre `loadedmetadata` je `NaN`,
        // a tada `srtToVtt` preskace klampovanje umesto da odseca po pogodjenoj
        // vrednosti (vidi taj modul).
        const duration = videoRef.current?.duration;
        const { vtt } = prepareSubtitle(await file.arrayBuffer(), { duration });

        // Tek posle uspesne konverzije — neispravan fajl ne sme da ukloni titl
        // koji je do tada radio.
        revoke();
        const url = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
        urlRef.current = url;

        const name = file.name.length > MAX_LABEL ? `${file.name.slice(0, MAX_LABEL - 1)}…` : file.name;
        setTrack({ id: "local", lang: "und", label: `Moj titl (${name})`, url });
        setError(null);
      } catch (cause) {
        // `SubtitleError` poruke su vec na srpskom i pisane za korisnika; sve
        // ostalo (npr. greska pri citanju fajla) dobija opstu poruku.
        setError(
          cause instanceof SubtitleError ? cause.message : "Titl se nije mogao učitati.",
        );
      }
    },
    [revoke, videoRef],
  );

  const clear = useCallback(() => {
    revoke();
    setTrack(null);
    setError(null);
  }, [revoke]);

  return { track, error, load, clear };
}
