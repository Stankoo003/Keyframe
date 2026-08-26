/**
 * Granica između UI-ja i playback engine-a.
 *
 * UI (kontrole) nikad ne importuje hls.js niti zna koji engine je aktivan — vidi
 * samo ovaj interface. Sve što je specifično za HLS (hls.js vs Safari native)
 * živi iza `PlaybackEngine`, na jednom mestu.
 *
 * Engine rešava SAMO ono što je HLS-specifično: učitavanje master playliste u
 * <video> element i rendition ladder (lista kvaliteta, trenutni nivo, promena,
 * fatalne greške). Standardni transport (play/pauza/seek/volume/fullscreen) ide
 * direktno preko HTMLVideoElement DOM API-ja jer je identičan za oba engine-a.
 */

/** Jedna rezolucija iz rendition ladder-a. */
export type QualityLevel = {
  /** Index nivoa unutar engine-a (nije nužno redosled u UI-ju). */
  index: number;
  height: number;
  bitrate: number;
  /** Ljudski čitljiva oznaka, npr. "720p". */
  label: string;
};

/** -1 znači automatski (ABR) izbor nivoa. */
export const AUTO_LEVEL = -1;

/**
 * High-level eventi koje engine emituje ka hook-u.
 *
 * `error` se emituje SAMO kad je greška zaista neoporaviva — sve sto se moze
 * automatski popraviti (retry, degradacija na nizi rendition) engine resava
 * interno i javlja kroz `recovering`/`recovered`/`degraded`, ne kroz `error`.
 */
export type EngineEvent =
  | { type: "levels"; levels: QualityLevel[] }
  /**
   * `level` je ono sto UI kontrole prikazuju (AUTO_LEVEL dok je ABR ukljucen —
   * <select> mora da ostane na "Auto", ne na broju koji ABR trenutno bira).
   * `actualLevel` je STVARNI izabran nivo, uvek numericki, cak i u auto modu —
   * bez njega bi Stats overlay log zauvek pisao "Auto → Auto" i sakrio svaku
   * ABR odluku. `auto` je trigger: true = ABR odluka, false = rucni izbor.
   */
  | { type: "levelswitched"; level: number; actualLevel: number; auto: boolean }
  /** Jedan ucitan segment — koristi Stats overlay za fetch-time log. */
  | { type: "fragloaded"; level: number; loadTimeMs: number; sizeBytes: number; durationS: number }
  /** Engine pokusava automatski oporavak (npr. mrezni prekid); UI ne sme da prikaze punu gresku. */
  | { type: "recovering"; attempt: number; maxAttempts: number; reason: string }
  /** Oporavak iz `recovering` je uspeo — reprodukcija normalno nastavlja. */
  | { type: "recovered" }
  /** Jedan rendition je iskljucen (pokvaren/nedostupan) i vise se ne nudi. */
  | { type: "degraded"; excludedLevel: number; toLevel: number; reason: string }
  /** `details` je sirov hls.js/MediaError kod za logove; `message` je za UI. */
  | { type: "error"; fatal: true; message: string; details: string };

export type EngineListener = (event: EngineEvent) => void;

export interface PlaybackEngine {
  /** Trenutno poznati nivoi (prazno dok se manifest ne parsira). */
  getLevels(): QualityLevel[];
  /** Aktivni nivo; `AUTO_LEVEL` za ABR. */
  getCurrentLevel(): number;
  /**
   * STVARNI nivo koji trenutno igra, uvek numericki — i dok je ABR ukljucen.
   * Za Stats overlay: `getCurrentLevel()` bi u auto modu uvek vratio
   * `AUTO_LEVEL`, sto sakriva sta je ABR zapravo izabrao.
   */
  getActualLevel(): number;
  /** Postavi nivo ručno; `AUTO_LEVEL` vraća na ABR. */
  setLevel(index: number): void;
  /** Da li engine uopšte izlaže ručni izbor nivoa (Safari native ne izlaže). */
  supportsLevelSelection(): boolean;
  /** Procena propusnog opsega u b/s; `null` kad engine nema tu informaciju (native). */
  getBandwidthEstimate(): number | null;
  /** Pretplata na evente; vraća funkciju za odjavu. */
  subscribe(listener: EngineListener): () => void;
  /** Oslobodi resurse i odveži se od <video> elementa. */
  destroy(): void;
}
