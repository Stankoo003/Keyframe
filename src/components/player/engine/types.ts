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

/** High-level eventi koje engine emituje ka hook-u. */
export type EngineEvent =
  | { type: "levels"; levels: QualityLevel[] }
  | { type: "levelswitched"; level: number }
  | { type: "error"; fatal: boolean; message: string };

export type EngineListener = (event: EngineEvent) => void;

export interface PlaybackEngine {
  /** Trenutno poznati nivoi (prazno dok se manifest ne parsira). */
  getLevels(): QualityLevel[];
  /** Aktivni nivo; `AUTO_LEVEL` za ABR. */
  getCurrentLevel(): number;
  /** Postavi nivo ručno; `AUTO_LEVEL` vraća na ABR. */
  setLevel(index: number): void;
  /** Da li engine uopšte izlaže ručni izbor nivoa (Safari native ne izlaže). */
  supportsLevelSelection(): boolean;
  /** Pretplata na evente; vraća funkciju za odjavu. */
  subscribe(listener: EngineListener): () => void;
  /** Oslobodi resurse i odveži se od <video> elementa. */
  destroy(): void;
}
