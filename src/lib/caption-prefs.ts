/**
 * Podesavanja titlova u `localStorage`.
 *
 * Zaseban kljuc od `playback-progress`, iako oba pamte korisnikovo stanje:
 * pozicija gledanja je PO SNIMKU i sme da ispadne kad mapa naraste preko svog
 * ogranicenja, a podesavanja titlova su JEDNO globalno podesavanje pristupacnosti
 * koje ne sme da nestane zato sto je korisnik odgledao pedeset snimaka.
 * Razlicit zivotni vek → razlicit kljuc → razlicit modul.
 *
 * SVE JE U try/catch, iz istih razloga kao tamo: Safari u privatnom rezimu baca
 * na `setItem`, browseri sa blokiranim kolacicima trece strane vec na sam
 * pristup `window.localStorage`. Ovo je udobnost; stranica zbog nje ne sme da
 * padne.
 */

const STORAGE_KEY = "keyframe:captions:v1";

/** Ponudjene velicine, kao mnozilac osnovne (vidi `.kf-cue` u globals.css). */
export const CAPTION_SCALES = [0.85, 1, 1.3, 1.6] as const;
export type CaptionScale = (typeof CAPTION_SCALES)[number];
export const DEFAULT_CAPTION_SCALE: CaptionScale = 1;

/** Providnost pozadine iza teksta — 0 je bez pozadine, 1 je puna crna podloga. */
export const CAPTION_BG_OPACITIES = [0, 0.4, 0.78, 1] as const;
export type CaptionBgOpacity = (typeof CAPTION_BG_OPACITIES)[number];
export const DEFAULT_CAPTION_BG_OPACITY: CaptionBgOpacity = 0.78;

/**
 * Pomeraj titlova u sekundama — pozitivno ih kasni, negativno ih ubrzava.
 *
 * Kontinualan (slider), ne fiksan skup kao velicina/pozadina — sinhronizacija
 * je precizan zadatak i korisniku treba korak od 0.1s, ne samo par preseta.
 */
export const CAPTION_DELAY_MIN = -5;
export const CAPTION_DELAY_MAX = 5;
export const CAPTION_DELAY_STEP = 0.1;
export type CaptionDelay = number;
export const DEFAULT_CAPTION_DELAY: CaptionDelay = 0;

function clampCaptionDelay(value: number): CaptionDelay {
  // Zaokruzi na korak da plutajuca tacka ne nakupi npr. 0.1 + 0.1 = 0.20000000000000004.
  const stepped = Math.round(value / CAPTION_DELAY_STEP) * CAPTION_DELAY_STEP;
  return Math.min(CAPTION_DELAY_MAX, Math.max(CAPTION_DELAY_MIN, Math.round(stepped * 10) / 10));
}

/**
 * Sve je u jednom objektu, ne u tri zasebna kljuca — jedno citanje/upis pri
 * svakoj promeni, i jedan mesto za buduce polje (npr. font) bez v2 migracije.
 */
export type CaptionPrefs = {
  scale: CaptionScale;
  bgOpacity: CaptionBgOpacity;
  delaySeconds: CaptionDelay;
};

export const DEFAULT_CAPTION_PREFS: CaptionPrefs = {
  scale: DEFAULT_CAPTION_SCALE,
  bgOpacity: DEFAULT_CAPTION_BG_OPACITY,
  delaySeconds: DEFAULT_CAPTION_DELAY,
};

function isOneOf<T>(values: readonly T[], value: unknown): value is T {
  return values.includes(value as T);
}

/**
 * Vraca sacuvana podesavanja, popunjena podrazumevanim vrednostima za sve sto
 * fali ili nije u redu.
 *
 * Prihvata SAMO vrednosti koje UI zaista nudi. Rucno prepravljen storage ili
 * stariji build ne smeju da daju titlove od 500% preko cele slike.
 */
export function readCaptionPrefs(): CaptionPrefs {
  if (typeof window === "undefined") return DEFAULT_CAPTION_PREFS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CAPTION_PREFS;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_CAPTION_PREFS;

    const { scale, bgOpacity, delaySeconds } = parsed as Partial<CaptionPrefs>;
    return {
      scale: isOneOf(CAPTION_SCALES, scale) ? scale : DEFAULT_CAPTION_SCALE,
      bgOpacity: isOneOf(CAPTION_BG_OPACITIES, bgOpacity) ? bgOpacity : DEFAULT_CAPTION_BG_OPACITY,
      delaySeconds: typeof delaySeconds === "number" ? clampCaptionDelay(delaySeconds) : DEFAULT_CAPTION_DELAY,
    };
  } catch {
    // Neispravan JSON ili nedostupan storage — ponasaj se kao da nema zapisa.
    return DEFAULT_CAPTION_PREFS;
  }
}

/** Delimicna izmena — spaja se preko poslednjeg poznatog stanja. */
export function saveCaptionPrefs(patch: Partial<CaptionPrefs>): void {
  const next = {
    ...getCaptionPrefsSnapshot(),
    ...patch,
    ...(patch.delaySeconds !== undefined
      ? { delaySeconds: clampCaptionDelay(patch.delaySeconds) }
      : {}),
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Pun ili nedostupan storage — tiho odustani.
    }
  }

  cached = next;
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
let cached: CaptionPrefs | null = null;

export function subscribeCaptionPrefs(listener: () => void): () => void {
  listeners.add(listener);

  // `storage` se okida SAMO u drugim tabovima, ne u onom koji je pisao — zato
  // `saveCaptionPrefs` iznad obavestava lokalne slusaoce sam.
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

export function getCaptionPrefsSnapshot(): CaptionPrefs {
  cached ??= readCaptionPrefs();
  return cached;
}

/** Server i prva hidratacija — bez ovoga bi kontrole renderovale razlicito. */
export function getCaptionPrefsServerSnapshot(): CaptionPrefs {
  return DEFAULT_CAPTION_PREFS;
}
