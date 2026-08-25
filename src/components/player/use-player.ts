"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SEEK_END_EPSILON_SECONDS } from "./constants";
import { createEngine } from "./engine/create-engine";
import { AUTO_LEVEL, type PlaybackEngine, type QualityLevel } from "./engine/types";
import { readTextTracks } from "./text-tracks";

/** Jedan neprekidan opseg koji je vec preuzet. */
export type BufferedRange = { start: number; end: number };

/** Jedna tekstualna staza, onako kako je kontrole vide. */
export type TextTrackInfo = {
  /** Indeks u `state.textTracks`, NE u `video.textTracks` — vidi `readTextTracks`. */
  index: number;
  lang: string;
  label: string;
};

/** Sve što UI kontrolama treba da renderuju stanje plejera. */
export type PlayerState = {
  ready: boolean;
  playing: boolean;
  seeking: boolean;
  currentTime: number;
  duration: number;
  /** SVI preuzeti opsezi, ne samo poslednji — posle premotavanja ih ima vise. */
  bufferedRanges: BufferedRange[];
  volume: number;
  muted: boolean;
  playbackRate: number;
  fullscreen: boolean;
  levels: QualityLevel[];
  currentLevel: number;
  supportsLevelSelection: boolean;
  /** Prazno kad snimak nema titlove — kontrola se po tome onemogucuje. */
  textTracks: TextTrackInfo[];
  /** Indeks ukljucene staze, ili -1 kad su titlovi ugaseni. */
  activeTextTrack: number;
  error: string | null;
  /**
   * Engine automatski pokusava oporavak (npr. mrezni prekid) — UI ovo
   * prikazuje kao nenametljiv baner, NE kao punu gresku. `error` i
   * `recovering` se medjusobno iskljucuju: kad je oporavak neuspesan,
   * engine emituje `error` i `recovering` se vraca na `false`.
   */
  recovering: boolean;
};

/** Akcije koje UI zove; ne otkrivaju ni <video> ni engine. */
export type PlayerActions = {
  togglePlay: () => void;
  seek: (time: number) => void;
  /** Pomeri za `delta` sekundi, sa clamp-om na [0, duration]. */
  skip: (delta: number) => void;
  setVolume: (volume: number) => void;
  /** Promeni jacinu za `delta`, sa clamp-om na [0, 1]. */
  nudgeVolume: (delta: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  selectLevel: (index: number) => void;
  /** `-1` gasi titlove. Indeks van opsega se ignorise. */
  setTextTrack: (index: number) => void;
  /**
   * Ponovo procita <track> elemente u `state.textTracks`.
   *
   * Postoji zbog titla koji gledalac ucita sa svog racunara: tada se u DOM doda
   * nov <track>, a to nije dogadjaj koji <video> emituje — pa se otkrivanje
   * staza mora pozvati rucno. Vidi `use-local-subtitle.ts`.
   */
  refreshTextTracks: () => void;
  /** Pali prvu stazu ili gasi tekucu. Bez staza ne radi nista. */
  toggleCaptions: () => void;
  toggleFullscreen: () => void;
  /**
   * Rucni "Pokušaj ponovo" — SAMO za `state.error` (neoporavivo stanje).
   * Automatski oporavak ide kroz engine-ov interni retry, bez ovoga — ovo
   * forsira punu rekreaciju engine-a (nov manifest fetch od nule).
   */
  retryPlayback: () => void;
};

const INITIAL: PlayerState = {
  ready: false,
  playing: false,
  seeking: false,
  currentTime: 0,
  duration: 0,
  bufferedRanges: [],
  volume: 1,
  muted: false,
  playbackRate: 1,
  fullscreen: false,
  levels: [],
  currentLevel: AUTO_LEVEL,
  supportsLevelSelection: false,
  textTracks: [],
  activeTextTrack: -1,
  error: null,
  recovering: false,
};

/** Ogranici vrednost na [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Najveca pozicija na koju se sme premotati.
 *
 * `duration` se u HLS-u precizira dok segmenti stizu (28 → 28.0107), pa se cita
 * iz elementa u trenutku premotavanja, a ne kesira.
 */
function maxSeekTarget(video: HTMLVideoElement): number {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (duration <= 0) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, duration - SEEK_END_EPSILON_SECONDS);
}

/** Procita sve preuzete opsege iz medija elementa. */
function readBufferedRanges(video: HTMLVideoElement): BufferedRange[] {
  return Array.from({ length: video.buffered.length }, (_, index) => ({
    start: video.buffered.start(index),
    end: video.buffered.end(index),
  }));
}

/**
 * Veže <video> element i `PlaybackEngine` u reaktivno React stanje.
 *
 * Transport (play/seek/volume/fullscreen) čita se iz DOM-a i piše na <video>
 * direktno — to nije HLS-specifično. Engine se koristi samo za rendition ladder
 * i fatalne greške. Time kontrole ostaju iste bez obzira koji engine vozi.
 */
export function usePlayer(src: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);
  /**
   * Poslednja TRAZENA pozicija, dok seek jos nije slegao.
   *
   * Bez ovoga se brzi uzastopni pritisci gube: svaki bi racunao od
   * `video.currentTime`, koji se jos nije pomerio, pa bi svih pet dalo isti cilj.
   */
  const pendingSeekRef = useRef<number | null>(null);
  /** Postavlja ga efekat za otkrivanje staza; cita ga `refreshTextTracks`. */
  const syncTextTracksRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<PlayerState>(INITIAL);
  /**
   * Rucni retry posle neoporavive greske — inkrement forsira efekat ispod
   * da ponovo napravi engine (isti obrazac kao promena `src`), jer `src`
   * sam po sebi ostaje nepromenjen.
   */
  const [retryNonce, setRetryNonce] = useState(0);

  /**
   * Lanac kroz koji se kreiranje engine-a serijalizuje.
   *
   * `createEngine` je asinhron (dinamicki `import("hls.js")`). Bez lanca, Strict
   * Mode montira efekat dvaput pa se drugi engine zakaci na isti <video> dok
   * prvi jos nastaje; kad se prvi promise razresi, njegov `destroy()` otkine
   * MediaSource drugome — slika stoji, `duration` ostane 0.
   *
   * Isto se desi i kad se `src` promeni brze nego sto engine stigne da nastane,
   * pa ovo nije samo dev-problem.
   */
  const setupChainRef = useRef<Promise<void>>(Promise.resolve());

  const patch = useCallback((partial: Partial<PlayerState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  // Kreiranje/uništavanje engine-a uz promenu izvora.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    // Drzimo i lokalno: cleanup mora da moze da unisti engine i pre nego sto
    // stigne u `engineRef`.
    let engine: PlaybackEngine | null = null;

    setState(INITIAL);

    const setup = setupChainRef.current.then(async () => {
      if (disposed) return;

      try {
        const created = await createEngine(video, src);

        if (disposed) {
          created.destroy();
          return;
        }

        engine = created;
        engineRef.current = created;

        patch({
          ready: true,
          supportsLevelSelection: created.supportsLevelSelection(),
          currentLevel: created.getCurrentLevel(),
        });

        created.subscribe((event) => {
          if (event.type === "levels") patch({ levels: event.levels });
          else if (event.type === "levelswitched") patch({ currentLevel: event.level });
          else if (event.type === "recovering") patch({ recovering: true });
          else if (event.type === "recovered") patch({ recovering: false });
          else if (event.type === "error") patch({ error: event.message, recovering: false });
          // "degraded" ne trazi posebno UI polje — `levels`/`currentLevel"
          // patch iznad vec pokriva sta korisnik treba da vidi.
        });
      } catch (err: unknown) {
        if (!disposed) patch({ error: err instanceof Error ? err.message : String(err) });
      }
    });

    setupChainRef.current = setup;

    return () => {
      disposed = true;
      engine?.destroy();
      engineRef.current = null;
    };
  }, [src, retryNonce, patch]);

  // Pretplata na <video> DOM evente za transport-stanje.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncTime = () => {
      patch({ currentTime: video.currentTime, bufferedRanges: readBufferedRanges(video) });
    };
    const syncMeta = () =>
      patch({ duration: Number.isFinite(video.duration) ? video.duration : 0 });
    const syncPlay = () => patch({ playing: !video.paused });
    const syncVolume = () => patch({ volume: video.volume, muted: video.muted });
    const syncRate = () => patch({ playbackRate: video.playbackRate });

    const onSeeking = () => patch({ seeking: true });
    const onSeeked = () => {
      // Seek je sleteo — sledece preskakanje krece od stvarne pozicije.
      pendingSeekRef.current = null;
      patch({
        seeking: false,
        currentTime: video.currentTime,
        bufferedRanges: readBufferedRanges(video),
      });
    };

    video.addEventListener("timeupdate", syncTime);
    video.addEventListener("progress", syncTime);
    video.addEventListener("durationchange", syncMeta);
    video.addEventListener("loadedmetadata", syncMeta);
    video.addEventListener("play", syncPlay);
    video.addEventListener("pause", syncPlay);
    video.addEventListener("volumechange", syncVolume);
    video.addEventListener("ratechange", syncRate);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);

    return () => {
      video.removeEventListener("timeupdate", syncTime);
      video.removeEventListener("progress", syncTime);
      video.removeEventListener("durationchange", syncMeta);
      video.removeEventListener("loadedmetadata", syncMeta);
      video.removeEventListener("play", syncPlay);
      video.removeEventListener("pause", syncPlay);
      video.removeEventListener("volumechange", syncVolume);
      video.removeEventListener("ratechange", syncRate);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [patch]);

  /**
   * Otkrivanje tekstualnih staza.
   *
   * Ne radi se jednom, nego se ponavlja na `loadedmetadata` i `emptied`, jer
   * `native-engine.destroy()` zove `video.load()` — a `load()` po specifikaciji
   * vraca <track> modove na "disabled". U Strict Mode-u destroy prvog engine-a
   * stize POSLE attach-a drugog, pa bi jednokratno postavljanje bilo tiho
   * pobrisano. Ovako se stanje samo izleci.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const sync = () => {
      const found = readTextTracks(video);

      found.forEach(({ track }) => {
        // UVEK "hidden", i kad su titlovi upaljeni. U tom modu se cue-ovi
        // parsiraju i `activeCues` se puni, ali UA ne crta nista — iscrtavanje
        // je nase, vidi caption-overlay.tsx. Da ijedna staza ostane "showing",
        // Safari bi crtao i svoje, pa bi se titlovi videli DVAPUT.
        //
        // Ovo je jedino mesto u kodu koje pise mod. Bezuslovno, da ga ni jedan
        // drugi sloj ne vrati na "showing"; upis istog moda je no-op.
        track.mode = "hidden";
      });

      patch({
        textTracks: found.map(({ track }, index) => ({
          index,
          lang: track.language,
          label: track.label,
        })),
      });
    };

    sync();
    // Izlaz ka `actions.refreshTextTracks()` — vidi komentar uz tu akciju.
    syncTextTracksRef.current = sync;

    const elements = readTextTracks(video).map(({ el }) => el);
    const onTrackLoad = () => sync();
    const onTrackError = (event: Event) => {
      // Titl koji se ne ucita mora da nestane iz stanja — inace ostaje ukljucena
      // kontrola koja ne radi nista, tacno ono sto ovaj zadatak treba da spreci.
      const el = event.currentTarget as HTMLTrackElement;
      console.warn(`Titl se nije ucitao: ${el.src}`);
      patch({
        textTracks: readTextTracks(video)
          .filter(({ el: candidate }) => candidate !== el)
          .map(({ track }, index) => ({ index, lang: track.language, label: track.label })),
        activeTextTrack: -1,
      });
    };

    elements.forEach((el) => {
      el.addEventListener("load", onTrackLoad);
      el.addEventListener("error", onTrackError);
    });
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("emptied", sync);

    return () => {
      elements.forEach((el) => {
        el.removeEventListener("load", onTrackLoad);
        el.removeEventListener("error", onTrackError);
      });
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("emptied", sync);
      syncTextTracksRef.current = null;
    };
  }, [src, patch]);

  // Fullscreen stanje prati document, jer korisnik može izaći Esc-om.
  useEffect(() => {
    const onFsChange = () => {
      const active = document.fullscreenElement != null;
      patch({ fullscreen: active });

      // Neki browseri, pri izlasku iz fullscreen-a (dugme, "f", ili
      // browserov Esc), obore fokus na <body> umesto da ga zadrze — korisnik
      // tastature bi tad morao da tabuje ispočetka od vrha stranice. Kontejner
      // vec ima `tabIndex={0}` i sve precice su na njemu, pa je najprostiji
      // pouzdan cilj za vracanje fokusa — bez potrebe da se pamti tacno koji
      // je element bio fokusiran pre ulaska u fullscreen.
      if (!active && (document.activeElement === document.body || document.activeElement == null)) {
        containerRef.current?.focus();
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [patch]);

  const actions: PlayerActions = {
    togglePlay: useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      if (video.paused) {
        // play() vraca Promise koji se odbija sa AbortError kad ga pauza pretekne
        // pre nego sto reprodukcija stigne da krene. To je ocekivano — korisnikova
        // kasnija akcija je pobedila. Sve ostalo pustamo dalje da se ne izgubi.
        video.play().catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          throw error;
        });
      } else {
        video.pause();
      }
    }, []),
    seek: useCallback((time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const target = clamp(time, 0, maxSeekTarget(video));
      pendingSeekRef.current = target;
      video.currentTime = target;
    }, []),

    /**
     * Preskakanje koje se SABIRA pri brzim uzastopnim pritiscima.
     *
     * Osnova je `pendingSeekRef`, ne `video.currentTime`: dok seek jos traje,
     * element moze i dalje prijavljivati staru poziciju, pa bi pet brzih
     * pritisaka sletelo na +5s umesto na +25s. Ref se brise na `seeked`.
     */
    skip: useCallback(
      (delta: number) => {
        const video = videoRef.current;
        if (!video) return;

        const base = pendingSeekRef.current ?? video.currentTime;
        const target = clamp(base + delta, 0, maxSeekTarget(video));

        pendingSeekRef.current = target;
        video.currentTime = target;
        // Odmah osvezi prikaz; `timeupdate` stigne tek kad seek slegne.
        patch({ currentTime: target });
      },
      [patch],
    ),

    setVolume: useCallback((volume: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = clamp(volume, 0, 1);
      if (volume > 0) video.muted = false;
    }, []),
    /** `delta` je vec potpisan korak, npr. `+VOLUME_STEP` ili `-VOLUME_STEP`. */
    nudgeVolume: useCallback((delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      const next = clamp(video.volume + delta, 0, 1);
      video.volume = next;
      if (next > 0) video.muted = false;
    }, []),
    toggleMute: useCallback(() => {
      if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
    }, []),

    /**
     * Brzina ostaje na elementu i prezivljava pauzu, play i premotavanje —
     * `playbackRate` se ne resetuje ni na jedan od njih. Stanje se sinhronizuje
     * kroz `ratechange`, pa UI ne moze da se razidje sa elementom.
     */
    setPlaybackRate: useCallback((rate: number) => {
      if (videoRef.current) videoRef.current.playbackRate = rate;
    }, []),

    selectLevel: useCallback((index: number) => {
      engineRef.current?.setLevel(index);
    }, []),

    setTextTrack: useCallback((index: number) => {
      setState((prev) => {
        if (index >= prev.textTracks.length) return prev;
        return { ...prev, activeTextTrack: index < 0 ? -1 : index };
      });
    }, []),

    refreshTextTracks: useCallback(() => {
      syncTextTracksRef.current?.();
    }, []),

    /**
     * Gard stoji OVDE, a ne na pozivnom mestu, da bi dugme i precica na
     * tastaturi delili jedno pravilo — bez staza ovo je no-op.
     */
    toggleCaptions: useCallback(() => {
      setState((prev) => {
        if (prev.textTracks.length === 0) return prev;
        return { ...prev, activeTextTrack: prev.activeTextTrack >= 0 ? -1 : 0 };
      });
    }, []),
    toggleFullscreen: useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      // Na iPhone-u `Element.requestFullscreen` uopste ne postoji — samo video
      // ume u nativni fullscreen. Bez ovog garda poziv baca.
      if (typeof container.requestFullscreen !== "function") return;

      if (document.fullscreenElement) void document.exitFullscreen();
      else void container.requestFullscreen();
    }, []),
    retryPlayback: useCallback(() => setRetryNonce((n) => n + 1), []),
  };

  return { videoRef, containerRef, state, actions };
}
