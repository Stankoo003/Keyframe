/**
 * Podesavanja izgleda titlova u `localStorage`.
 *
 * Zaseban kljuc od `playback-progress`, iako oba pamte korisnikovo stanje:
 * pozicija gledanja je PO SNIMKU i sme da ispadne kad mapa naraste preko svog
 * ogranicenja, a izgled titlova je JEDNO globalno podesavanje pristupacnosti
 * koje ne sme da nestane zato sto je korisnik odgledao pedeset snimaka, i vazi
 * za SVAKI snimak podjednako.
 * Razlicit zivotni vek → razlicit kljuc → razlicit modul.
 *
 * SVE JE U try/catch, iz istih razloga kao tamo: Safari u privatnom rezimu baca
 * na `setItem`, browseri sa blokiranim kolacicima trece strane vec na sam
 * pristup `window.localStorage`. Ovo je udobnost; stranica zbog nje ne sme da
 * padne.
 */

const STORAGE_KEY = "keyframe:captions:v2";

export const CAPTION_FONT_SIZE_MIN = 50;
export const CAPTION_FONT_SIZE_MAX = 200;
export const CAPTION_FONT_SIZE_STEP = 10;
export const DEFAULT_CAPTION_FONT_SIZE_PCT = 100;

export const CAPTION_FONT_FAMILIES = ["sans", "serif", "mono"] as const;
export type CaptionFontFamily = (typeof CAPTION_FONT_FAMILIES)[number];
export const DEFAULT_CAPTION_FONT_FAMILY: CaptionFontFamily = "sans";

export const CAPTION_EDGE_STYLES = ["none", "shadow", "outline"] as const;
export type CaptionEdgeStyle = (typeof CAPTION_EDGE_STYLES)[number];
export const DEFAULT_CAPTION_EDGE_STYLE: CaptionEdgeStyle = "shadow";

/** Procenat visine slike, od dna — koliko titl "lebdi" iznad donje ivice. */
export const CAPTION_POSITION_MIN = 0;
export const CAPTION_POSITION_MAX = 40;
export const CAPTION_POSITION_STEP = 1;
export const DEFAULT_CAPTION_POSITION_PCT = 8;

export const CAPTION_OPACITY_MIN = 0;
export const CAPTION_OPACITY_MAX = 1;
export const CAPTION_OPACITY_STEP = 0.05;
export const DEFAULT_CAPTION_TEXT_OPACITY = 1;
export const DEFAULT_CAPTION_BG_OPACITY = 0.75;

export const DEFAULT_CAPTION_TEXT_COLOR = "#ffffff";
export const DEFAULT_CAPTION_BG_COLOR = "#000000";

/** Pomeraj titlova u sekundama — pozitivno ih kasni, negativno ih ubrzava. */
export const CAPTION_DELAY_MIN = -5;
export const CAPTION_DELAY_MAX = 5;
export const CAPTION_DELAY_STEP = 0.1;
export const DEFAULT_CAPTION_DELAY = 0;

/**
 * Sve je u jednom objektu, ne u zasebnim kljucevima — jedno citanje/upis pri
 * svakoj promeni, i jedno mesto za buduce polje bez v3 migracije.
 */
export type CaptionPrefs = {
  fontSizePct: number;
  fontFamily: CaptionFontFamily;
  textColor: string;
  textOpacity: number;
  bgColor: string;
  bgOpacity: number;
  edgeStyle: CaptionEdgeStyle;
  positionPct: number;
  delaySeconds: number;
};

export const DEFAULT_CAPTION_PREFS: CaptionPrefs = {
  fontSizePct: DEFAULT_CAPTION_FONT_SIZE_PCT,
  fontFamily: DEFAULT_CAPTION_FONT_FAMILY,
  textColor: DEFAULT_CAPTION_TEXT_COLOR,
  textOpacity: DEFAULT_CAPTION_TEXT_OPACITY,
  bgColor: DEFAULT_CAPTION_BG_COLOR,
  bgOpacity: DEFAULT_CAPTION_BG_OPACITY,
  edgeStyle: DEFAULT_CAPTION_EDGE_STYLE,
  positionPct: DEFAULT_CAPTION_POSITION_PCT,
  delaySeconds: DEFAULT_CAPTION_DELAY,
};

function isOneOf<T>(values: readonly T[], value: unknown): value is T {
  return values.includes(value as T);
}

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function clampNumericPref(value: unknown, min: number, max: number, step: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  // Zaokruzi na korak da plutajuca tacka ne nakupi npr. 0.1 + 0.1 = 0.20000000000000004.
  const stepped = Math.round(value / step) * step;
  const rounded = Math.round(stepped * 1000) / 1000;
  return Math.min(max, Math.max(min, rounded));
}

function sanitizeHexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR_RE.test(value) ? value.toLowerCase() : fallback;
}

/**
 * Vraca sacuvana podesavanja, popunjena podrazumevanim vrednostima za sve sto
 * fali ili nije u redu.
 *
 * Prihvata SAMO vrednosti u granicama koje UI zaista nudi. Rucno prepravljen
 * storage ili stariji build ne smeju da daju titlove van ekrana ili u boji
 * koja nije validan CSS.
 */
export function readCaptionPrefs(): CaptionPrefs {
  if (typeof window === "undefined") return DEFAULT_CAPTION_PREFS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CAPTION_PREFS;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_CAPTION_PREFS;

    const p = parsed as Partial<CaptionPrefs>;
    return {
      fontSizePct: clampNumericPref(
        p.fontSizePct,
        CAPTION_FONT_SIZE_MIN,
        CAPTION_FONT_SIZE_MAX,
        CAPTION_FONT_SIZE_STEP,
        DEFAULT_CAPTION_FONT_SIZE_PCT,
      ),
      fontFamily: isOneOf(CAPTION_FONT_FAMILIES, p.fontFamily) ? p.fontFamily : DEFAULT_CAPTION_FONT_FAMILY,
      textColor: sanitizeHexColor(p.textColor, DEFAULT_CAPTION_TEXT_COLOR),
      textOpacity: clampNumericPref(
        p.textOpacity,
        CAPTION_OPACITY_MIN,
        CAPTION_OPACITY_MAX,
        CAPTION_OPACITY_STEP,
        DEFAULT_CAPTION_TEXT_OPACITY,
      ),
      bgColor: sanitizeHexColor(p.bgColor, DEFAULT_CAPTION_BG_COLOR),
      bgOpacity: clampNumericPref(
        p.bgOpacity,
        CAPTION_OPACITY_MIN,
        CAPTION_OPACITY_MAX,
        CAPTION_OPACITY_STEP,
        DEFAULT_CAPTION_BG_OPACITY,
      ),
      edgeStyle: isOneOf(CAPTION_EDGE_STYLES, p.edgeStyle) ? p.edgeStyle : DEFAULT_CAPTION_EDGE_STYLE,
      positionPct: clampNumericPref(
        p.positionPct,
        CAPTION_POSITION_MIN,
        CAPTION_POSITION_MAX,
        CAPTION_POSITION_STEP,
        DEFAULT_CAPTION_POSITION_PCT,
      ),
      delaySeconds: clampNumericPref(
        p.delaySeconds,
        CAPTION_DELAY_MIN,
        CAPTION_DELAY_MAX,
        CAPTION_DELAY_STEP,
        DEFAULT_CAPTION_DELAY,
      ),
    };
  } catch {
    // Neispravan JSON ili nedostupan storage — ponasaj se kao da nema zapisa.
    return DEFAULT_CAPTION_PREFS;
  }
}

/** Delimicna izmena — spaja se preko poslednjeg poznatog stanja, pa se validira. */
export function saveCaptionPrefs(patch: Partial<CaptionPrefs>): void {
  const merged = { ...getCaptionPrefsSnapshot(), ...patch };
  const next: CaptionPrefs = {
    fontSizePct: clampNumericPref(
      merged.fontSizePct,
      CAPTION_FONT_SIZE_MIN,
      CAPTION_FONT_SIZE_MAX,
      CAPTION_FONT_SIZE_STEP,
      DEFAULT_CAPTION_FONT_SIZE_PCT,
    ),
    fontFamily: isOneOf(CAPTION_FONT_FAMILIES, merged.fontFamily)
      ? merged.fontFamily
      : DEFAULT_CAPTION_FONT_FAMILY,
    textColor: sanitizeHexColor(merged.textColor, DEFAULT_CAPTION_TEXT_COLOR),
    textOpacity: clampNumericPref(
      merged.textOpacity,
      CAPTION_OPACITY_MIN,
      CAPTION_OPACITY_MAX,
      CAPTION_OPACITY_STEP,
      DEFAULT_CAPTION_TEXT_OPACITY,
    ),
    bgColor: sanitizeHexColor(merged.bgColor, DEFAULT_CAPTION_BG_COLOR),
    bgOpacity: clampNumericPref(
      merged.bgOpacity,
      CAPTION_OPACITY_MIN,
      CAPTION_OPACITY_MAX,
      CAPTION_OPACITY_STEP,
      DEFAULT_CAPTION_BG_OPACITY,
    ),
    edgeStyle: isOneOf(CAPTION_EDGE_STYLES, merged.edgeStyle) ? merged.edgeStyle : DEFAULT_CAPTION_EDGE_STYLE,
    positionPct: clampNumericPref(
      merged.positionPct,
      CAPTION_POSITION_MIN,
      CAPTION_POSITION_MAX,
      CAPTION_POSITION_STEP,
      DEFAULT_CAPTION_POSITION_PCT,
    ),
    delaySeconds: clampNumericPref(
      merged.delaySeconds,
      CAPTION_DELAY_MIN,
      CAPTION_DELAY_MAX,
      CAPTION_DELAY_STEP,
      DEFAULT_CAPTION_DELAY,
    ),
  };

  persist(next);
}

/** Vraca sve na podrazumevano, u jednom upisu. */
export function resetCaptionPrefs(): void {
  persist(DEFAULT_CAPTION_PREFS);
}

function persist(next: CaptionPrefs): void {
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
  // `persist` iznad obavestava lokalne slusaoce sam.
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
