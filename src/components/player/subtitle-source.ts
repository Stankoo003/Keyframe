/**
 * Priprema titla za <track>: bajtovi sa mreze -> WebVTT tekst.
 *
 * Browser u <track> prihvata ISKLJUCIVO WebVTT. Da bi se podrzao i SRT — a
 * vecina titlova u divljini jeste SRT — konverzija mora negde da se desi; ovde
 * se desava u browseru, pa server ostaje samo staticni fajl-server.
 *
 * Modul je namerno CIST: bez DOM-a, bez `fetch`-a, bez `Blob`-a. Sve to radi
 * `use-subtitle-tracks.ts`. Razlog je testabilnost — parsiranje tajminga i
 * dekodiranje enkodinga su jedini delovi koji stvarno umeju da budu netacni, a
 * ovako se proveravaju obicnim unit testom, bez browsera.
 */

/** Greska koja se sme pokazati korisniku — poruka je vec na srpskom. */
export class SubtitleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubtitleError";
  }
}

export type SubtitleFormat = "vtt" | "srt";

export type PreparedSubtitle = {
  /** Gotov WebVTT tekst, spreman za Blob. */
  vtt: string;
  /** Prepoznati format ULAZA (ne izlaza — izlaz je uvek VTT). */
  format: SubtitleFormat;
  /** Sta je popravljeno u letu; prazno kad je fajl bio ispravan. */
  repairs: string[];
};

type Cue = { start: number; end: number; text: string };

/**
 * Dekodiranje bajtova u tekst.
 *
 * SRT fajlovi u divljini su vrlo cesto Windows-1252 ili neki drugi 8-bitni
 * kodni raspored, jer ih generisu stari alati. Ako se takav fajl procita kao
 * UTF-8, ne puca nista — dobiju se mojibake karakteri, tj. titl koji se prikaze
 * ali je smece. Zato je `fatal: true` obavezan: bolje pasti na fallback nego
 * tiho prikazati "Å¡" umesto "š".
 */
export function decodeSubtitleBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // BOM je jedini pouzdan signal enkodinga koji fajl moze da nosi u sebi.
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return stripBom(new TextDecoder("utf-16le").decode(bytes));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return stripBom(new TextDecoder("utf-16be").decode(bytes));
  }

  try {
    return stripBom(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    // Nije validan UTF-8. Windows-1252 je daleko najcesci sledeci kandidat i
    // nikad ne baca (svaki bajt ima mapiranje), pa se rezultat mora proveriti
    // rucno — inace bi fallback bio samo drugi nacin da se propusti smece.
    const fallback = stripBom(new TextDecoder("windows-1252").decode(bytes));

    if (looksLikeGarbage(fallback)) {
      throw new SubtitleError(
        "Titl nije u UTF-8 kodiranju i ne moze se pouzdano dekodirati. Sacuvajte fajl kao UTF-8.",
      );
    }

    return fallback;
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * C1 kontrolni opseg (U+0080–U+009F) i U+FFFD u tekstu titla ne postoje kod
 * ispravno dekodiranog fajla — ali se pojavljuju kad se pogodio pogresan kodni
 * raspored. To je granica izmedju "dekodirano" i "mojibake".
 */
function looksLikeGarbage(text: string): boolean {
  return /[\u0080-\u009F\uFFFD]/.test(text);
}

/**
 * Format se odredjuje iz SADRZAJA, ne iz ekstenzije.
 *
 * Ekstenzija je puka konvencija imenovanja i redovno laze — `.srt` fajl koji je
 * zapravo VTT, ili obrnuto, nije redak. Potpis u sadrzaju je jedini podatak
 * koji dolazi od alata koji je fajl napravio.
 */
export function detectSubtitleFormat(text: string): SubtitleFormat {
  const head = text.trimStart();

  // WEBVTT mora biti prva rec fajla, po specifikaciji.
  if (/^WEBVTT(\s|$)/.test(head)) return "vtt";

  // SRT nema potpis, pa se prepoznaje po svojoj timing liniji: jedina razlika u
  // odnosu na VTT je zarez kao decimalni separator.
  if (/^\s*\d{1,2}:\d{2}:\d{2},\d{1,3}\s*-->/m.test(text)) return "srt";

  throw new SubtitleError("Fajl nije prepoznat ni kao WebVTT ni kao SRT.");
}

/**
 * `HH:MM:SS,mmm`, uz toleranciju na tacku, jednocifrene sate i `MM:SS,mmm`.
 *
 * Eksportovano jer isti oblik vremena stoji i u `thumbs.vtt` mapi sličica
 * (`./thumbnails.ts`) — jedan parser umesto dve kopije koje bi se razisle.
 */
export function parseTimestamp(raw: string): number | null {
  const match = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/.exec(raw.trim());
  if (!match) return null;

  const [, hours, minutes, seconds, fraction] = match;
  // "1" u ",1" znaci desetinku, ne milisekundu — zato dopuna nulama zdesna.
  const millis = Number((fraction ?? "0").padEnd(3, "0"));

  return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds) + millis / 1000;
}

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 1000));
  const ms = total % 1000;
  const s = Math.floor(total / 1000) % 60;
  const m = Math.floor(total / 60_000) % 60;
  const h = Math.floor(total / 3_600_000);

  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

/**
 * SRT -> WebVTT.
 *
 * Sama konverzija je sitna (zaglavlje + zarez u tacku); posao je validacija.
 * Politika: popravi sto se bezbedno moze, padni samo kad ne ostane nijedan
 * upotrebljiv cue. Tiho vracanje praznog VTT-a je najgori ishod — plejer bi
 * izgledao kao da radi, a titlova ne bi bilo.
 *
 * `duration` je opciono jer se trajanje snimka ne zna pre `loadedmetadata`.
 * Kad se ne zna, klampovanje se preskace — bolje nego klampovati na pogodjenu
 * vrednost i odseci ispravne cue-ove.
 */
export function srtToVtt(
  text: string,
  { duration }: { duration?: number } = {},
): { vtt: string; repairs: string[] } {
  const repairs: string[] = [];
  const limit = typeof duration === "number" && Number.isFinite(duration) ? duration : null;

  const cues: Cue[] = [];
  let malformedTimings = 0;

  for (const block of text.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;

    // Redni broj je opcion u praksi — preskace se ako postoji.
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    const timingLine = timingIndex === -1 ? null : lines[timingIndex];
    if (timingLine == null) continue;

    const [rawStart, rawEnd] = timingLine.split("-->");
    // Neki alati posle vremena dopisuju koordinate ("X1:0 X2:100"); visak se
    // odbacuje, jer WebVTT na tom mestu ocekuje svoja cue podesavanja.
    const start = parseTimestamp(rawStart ?? "");
    const end = parseTimestamp((rawEnd ?? "").trim().split(/\s+/)[0] ?? "");

    if (start === null || end === null) {
      malformedTimings += 1;
      repairs.push(`Preskocen cue sa neispravnim vremenom: "${timingLine.trim()}"`);
      continue;
    }

    const body = lines.slice(timingIndex + 1).join("\n");
    if (body.trim() === "") continue;

    if (end <= start) {
      repairs.push(`Preskocen cue na ${formatTimestamp(start)} — kraj nije posle pocetka.`);
      continue;
    }

    if (limit !== null) {
      if (start >= limit) {
        repairs.push(`Preskocen cue na ${formatTimestamp(start)} — pocinje posle kraja snimka.`);
        continue;
      }
      if (end > limit) {
        repairs.push(`Skracen cue na ${formatTimestamp(start)} — kraj je bio posle kraja snimka.`);
        cues.push({ start, end: limit, text: body });
        continue;
      }
    }

    cues.push({ start, end, text: body });
  }

  if (cues.length === 0) {
    throw new SubtitleError(
      malformedTimings > 0
        ? "Titl nema nijedan ispravan cue — vremena su neispravna."
        : "Titl ne sadrzi nijedan cue.",
    );
  }

  // Cue-ovi van redosleda su cesti kod rucno spajanih fajlova. WebVTT parser ih
  // ne mora odbaciti, ali `activeCues` tad ume da preskoci cue — pa se sortira.
  const sorted = [...cues];
  sorted.sort((a, b) => a.start - b.start);
  if (sorted.some((cue, index) => cue !== cues[index])) {
    repairs.push("Cue-ovi nisu bili u redosledu — sortirani po vremenu pocetka.");
  }

  const body = sorted
    .map((cue) => `${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}\n${cue.text}`)
    .join("\n\n");

  return { vtt: `WEBVTT\n\n${body}\n`, repairs };
}

/**
 * Ceo put: bajtovi -> WebVTT tekst, bez obzira na ulazni format.
 *
 * VTT prolazi nepromenjen (samo dekodiran) — postojeci titlovi rade tacno kao
 * pre, a dobijaju istu proveru enkodinga kao SRT.
 */
export function prepareSubtitle(
  buffer: ArrayBuffer,
  options: { duration?: number } = {},
): PreparedSubtitle {
  const text = decodeSubtitleBytes(buffer);
  const format = detectSubtitleFormat(text);

  if (format === "vtt") return { vtt: text, format, repairs: [] };

  const { vtt, repairs } = srtToVtt(text, options);
  return { vtt, format, repairs };
}
