/**
 * Strukturisano logovanje grešaka plejera — prati postojeći obrazac
 * `console.error("[scope] poruka:", ...)` iz `src/app/error.tsx`, samo sa
 * dovoljno konteksta (tip, detalji, nivo, pokušaj) da se greška može
 * dijagnostikovati iz same konzole, bez ponavljanja koraka.
 *
 * Nikad ne loguje pun URL — samo putanju, bez query stringa. Segmenti i
 * playliste mogu nositi potpisane URL parametre; ti parametri ne smeju da
 * završe u logovima.
 */

function stripQuery(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    // Relativna putanja ili nevalidan URL — nema query da se seče.
    return url.split("?")[0];
  }
}

export function logPlayerError(context: {
  scope: "hls" | "native";
  type?: string;
  details: string;
  fatal: boolean;
  level?: number;
  attempt?: number;
  message: string;
  url?: string;
}): void {
  const { scope, url, fatal, ...rest } = context;

  // Ne-fatalne greske idu kao `warn`, ne `error`.
  //
  // `bufferSeekOverHole` i slicni su normalan deo rada hls.js-a pri
  // premotavanju — engine ih resava sam i reprodukcija se ne prekida. Kroz
  // `console.error` ih Next dev overlay dize u crveni okvir preko cele
  // stranice, pa bezopasan dogadjaj izgleda kao pad plejera. Fatalne ostaju
  // `error` i dalje se vide odmah.
  const log = fatal ? console.error : console.warn;
  log(`[player:${scope}] ${context.message}`, { ...rest, fatal, path: stripQuery(url) });
}
