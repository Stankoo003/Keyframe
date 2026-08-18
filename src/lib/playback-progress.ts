/**
 * Pamcenje pozicije gledanja, po snimku, u `localStorage`.
 *
 * Zasto localStorage a ne baza: pozicija je licna i vezana za uredjaj, a nemamo
 * korisnicke naloge — nema koga da veze zapis u bazi. Kad nalozi dodju, ovaj
 * modul je jedino mesto koje treba zameniti.
 *
 * Kljuc je `Video.id` iz baze, ne slug: slug se moze promeniti, id ne.
 *
 * SVE JE U try/catch. `localStorage` baca u vise stvarnih slucajeva — Safari u
 * privatnom rezimu na `setItem`, browseri sa blokiranim kolacicima trece strane
 * vec na sam pristup `window.localStorage`. Nastavak gledanja je udobnost;
 * stranica zbog njega ne sme da padne.
 */

const STORAGE_KEY = "keyframe:progress:v1";

/** Ispod ovoliko nema sta da se nastavi — korisnik tek sto je pustio. */
export const MIN_RESUME_SECONDS = 10;

/** Ovoliko pre kraja se snimak racuna kao odgledan i zapis se brise. */
const FINISHED_TAIL_SECONDS = 15;

/** Koliko snimaka se pamti; stariji ispadaju. Bez ovoga mapa raste bez granice. */
const MAX_ENTRIES = 50;

/** `t` = pozicija u sekundama, `at` = kad je upisano (za izbacivanje najstarijih). */
type Entry = { t: number; at: number };
type Store = Record<string, Entry>;

function readStore(): Store {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    return parsed as Store;
  } catch {
    // Neispravan JSON ili nedostupan storage — ponasaj se kao da nema zapisa.
    return {};
  }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Pun ili nedostupan storage — tiho odustani.
  }
}

/** Sacuvana pozicija, ili `null` kad je nema. */
export function readProgress(videoId: string): number | null {
  const entry = readStore()[videoId];
  if (!entry || typeof entry.t !== "number" || !Number.isFinite(entry.t)) return null;
  return entry.t >= MIN_RESUME_SECONDS ? entry.t : null;
}

/**
 * Upisi poziciju.
 *
 * Zapis se BRISE u dva slucaja umesto da se upise:
 * prerano (ispod `MIN_RESUME_SECONDS` — nema sta da se nastavi) i pri samom
 * kraju (odgledano — sledeci put treba krenuti ispocetka, ne sa 8:28).
 */
export function saveProgress(videoId: string, seconds: number, duration: number): void {
  if (!Number.isFinite(seconds) || !Number.isFinite(duration) || duration <= 0) return;

  const tooEarly = seconds < MIN_RESUME_SECONDS;
  const finished = seconds >= duration - FINISHED_TAIL_SECONDS;

  if (tooEarly || finished) {
    clearProgress(videoId);
    return;
  }

  const store = readStore();
  store[videoId] = { t: seconds, at: Date.now() };

  const ids = Object.keys(store);
  if (ids.length > MAX_ENTRIES) {
    // Najskoriji ostaju; visak ispada s repa.
    const keep = ids
      .sort((a, b) => (store[b]?.at ?? 0) - (store[a]?.at ?? 0))
      .slice(0, MAX_ENTRIES);

    const trimmed: Store = {};
    for (const id of keep) {
      const entry = store[id];
      if (entry) trimmed[id] = entry;
    }
    writeStore(trimmed);
    return;
  }

  writeStore(store);
}

export function clearProgress(videoId: string): void {
  const store = readStore();
  if (!(videoId in store)) return;

  delete store[videoId];
  writeStore(store);
}
