/**
 * Podesavanja plejera na jednom mestu.
 *
 * `SEEK_STEP_SECONDS` narocito: koriste ga I dugmad za preskakanje I strelice na
 * tastaturi. Da je zapisan na dva mesta, jednog dana bi se razisli i korisnik bi
 * dobio razlicit pomak zavisno od toga da li je kliknuo ili pritisnuo taster.
 */

/** Pomak dugmadi za preskakanje i strelica levo/desno. */
export const SEEK_STEP_SECONDS = 5;

/**
 * Koliko pre kraja se zaustavlja premotavanje.
 *
 * Skok na tacno `duration` nema uzorak u baferu — MSE tu nema sta da dekodira,
 * pa hls.js digne fatalnu `media error 4` i plejer ostane mrtav. Svi ozbiljni
 * plejeri zato staju malo pre kraja.
 */
export const SEEK_END_EPSILON_SECONDS = 0.25;

/** Korak klizaca za jacinu, i strelica gore/dole. */
export const VOLUME_STEP = 0.05;

/** Ponudjene brzine reprodukcije. */
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Koliko mirovanja pre nego sto se kontrole sakriju — samo dok video svira. */
export const CONTROLS_HIDE_MS = 3000;

/**
 * Koliko dugo se ceka posle `waiting`/`stalled` pre nego sto se prikaze
 * "veza prekinuta" natpis.
 *
 * Kratki `waiting` eventi su normalni (start baferovanja, seek preko
 * nepreuzetog dela) i ne smeju da izazovu treperenje natpisa — samo
 * baferovanje koje potraje DUZE od ovoga lici na stvaran problem sa mrezom.
 */
export const STALL_GRACE_MS = 1500;
