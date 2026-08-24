/**
 * Podesavanja titlova u `localStorage`.
 *
 * Zaseban kljuc od `playback-progress`, iako oba pamte korisnikovo stanje:
 * pozicija gledanja je PO SNIMKU i sme da ispadne kad mapa naraste preko svog
 * ogranicenja, a velicina titlova je JEDNO globalno podesavanje pristupacnosti
 * koje ne sme da nestane zato sto je korisnik odgledao pedeset snimaka.
 * Razlicit zivotni vek → razlicit kljuc → razlicit modul.
 *
 * SVE JE U try/catch, iz istih razloga kao tamo: Safari u privatnom rezimu baca
 * na `setItem`, browseri sa blokiranim kolacicima trece strane vec na sam
 * pristup `window.localStorage`. Ovo je udobnost; stranica zbog nje ne sme da
 * padne.
 */

const STORAGE_KEY = "keyframe:captions:v1";

/**
 * Ponudjene velicine, kao mnozilac osnovne (vidi `.kf-cue` u globals.css).
 *
 * Stoje OVDE, a ne u components/player/constants.ts, da bi validacija pri
 * citanju cuvala tacno onaj skup koji UI nudi — bez drugog izvora istine.
 * Obrnut smer (lib uvozi iz components) bi izvrnuo zavisnosti.
 */
export const CAPTION_SCALES = [0.85, 1, 1.3, 1.6] as const;

export type CaptionScale = (typeof CAPTION_SCALES)[number];

export const DEFAULT_CAPTION_SCALE: CaptionScale = 1;

/** Objekat, ne go broj — sledece podesavanje (font, providnost) ulazi bez v2. */
type Prefs = { scale: CaptionScale };

function isCaptionScale(value: unknown): value is CaptionScale {
  return CAPTION_SCALES.includes(value as CaptionScale);
}

/**
 * Vraca sacuvanu velicinu, ili podrazumevanu ako ista nije u redu.
 *
 * Prihvata SAMO vrednost koju UI zaista nudi. Rucno prepravljen storage ili
 * stariji build ne smeju da daju titlove od 500% preko cele slike.
 */
export function readCaptionScale(): CaptionScale {
  if (typeof window === "undefined") return DEFAULT_CAPTION_SCALE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CAPTION_SCALE;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_CAPTION_SCALE;

    const { scale } = parsed as Partial<Prefs>;
    return isCaptionScale(scale) ? scale : DEFAULT_CAPTION_SCALE;
  } catch {
    // Neispravan JSON ili nedostupan storage — ponasaj se kao da nema zapisa.
    return DEFAULT_CAPTION_SCALE;
  }
}

export function saveCaptionScale(scale: CaptionScale): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ scale } satisfies Prefs));
  } catch {
    // Pun ili nedostupan storage — tiho odustani.
  }

  cached = scale;
  listeners.forEach((listener) => listener());
}

/* ── Spoljni store, za `useSyncExternalStore` ────────────────────────────────
 *
 * Zasto ne obicno citanje u efektu: server nema `localStorage`, pa bi svaka
 * vrednost procitana pri prvom renderu bila hydration mismatch. `getServerSnapshot`
 * postoji tacno zbog toga — server i prva hidratacija vide podrazumevanu
 * vrednost, a prava stigne odmah posle, bez `setState` u efektu.
 */

const listeners = new Set<() => void>();

/** Kes da `getSnapshot` ne parsira JSON u svakom renderu (a ima ih dosta —
 *  plejer se prerenderuje na svaki otkucaj vremena). Rusi ga upis i drugi tab. */
let cached: CaptionScale | null = null;

export function subscribeCaptionScale(listener: () => void): () => void {
  listeners.add(listener);

  // `storage` se okida SAMO u drugim tabovima, ne u onom koji je pisao — zato
  // `saveCaptionScale` iznad obavestava lokalne slusaoce sam.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getCaptionScaleSnapshot(): CaptionScale {
  cached ??= readCaptionScale();
  return cached;
}

/** Server i prva hidratacija — bez ovoga bi <select> renderovao razlicito. */
export function getCaptionScaleServerSnapshot(): CaptionScale {
  return DEFAULT_CAPTION_SCALE;
}
