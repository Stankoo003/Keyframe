"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import type { CaptionFontFamily, CaptionPrefs } from "@/lib/caption-prefs";

import { readTextTracks } from "./text-tracks";

/**
 * Titlovi koje crtamo SAMI, umesto da ih prepustimo browseru.
 *
 * Zasto uopste: cue kutija koju crta browser zivi u UA shadow stablu <video>
 * elementa, gde nemamo ni layout ni stacking kontrolu, ni moc da promenimo
 * font, boju ili poziciju preko onoga sto `::cue` dozvoljava — a taj skup je
 * i sam nedosledan izmedju browsera. To je pravilo dva konkretna kvara:
 *
 *  1. U desktop Safariju titlovi NESTANU u fullscreen-u. Fullscreen trazimo nad
 *     kontejner divom, a cue kutija ostaje u shadow stablu videa. Koji je tacno
 *     WebKit quirk kriv nije utvrdjeno — i namerno nije bitno: sloj koji je DOM
 *     potomak elementa koji ide u fullscreen ne moze da promasi fullscreen
 *     kutiju, po konstrukciji. Uklanja se cela klasa kvarova, ne pogodjena
 *     hipoteza.
 *  2. `::cue { font-size }` u Safariju nadjacaju sistemska podesavanja titlova,
 *     pa se velicina/boja/pozadina nativno ne bi mogle ponuditi uopste.
 *
 * Parsiranje ostaje BESPLATNO: staza je "hidden" (vidi use-player.ts), pa
 * browser i dalje parsira .vtt i puni `activeCues` — mi samo preuzimamo
 * iscrtavanje onoga sto browser vec izracuna.
 */
export function CaptionOverlay({
  videoRef,
  activeTextTrack,
  prefs,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Indeks ukljucene staze, ili -1 kad su titlovi ugaseni. */
  activeTextTrack: number;
  prefs: CaptionPrefs;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const visible = activeTextTrack >= 0;

  /**
   * Izvorni tajminzi cue-ova, PRE nego sto im primenimo `delaySeconds`.
   *
   * WeakMap zivi za ceo vek komponente (ne po efektu): kad se delay promeni,
   * efekat ispod se ponovo pokrece i cue.startTime/endTime su vec pomereni od
   * proslog puta. Bez ovog pamcenja bi se drugi pomeraj racunao od vec
   * pomerene vrednosti i pomeraji bi se sabirali umesto da se zamenjuju.
   */
  const originalsRef = useRef(new WeakMap<TextTrackCue, { start: number; end: number }>());

  useEffect(() => {
    const video = videoRef.current;
    // Ugasene titlove ne pratimo uopste — linije se ne renderuju (vidi `visible`
    // nize), pa ustajala vrednost ne smeta, a `attach` je odmah osvezi kad se
    // titlovi ponovo upale.
    if (!video || activeTextTrack < 0) return;

    let el: HTMLTrackElement | null = null;
    let track: TextTrack | null = null;

    const applyDelay = () => {
      const cues = track?.cues;
      if (!cues) return;

      for (let i = 0; i < cues.length; i++) {
        const cue = cues[i];
        if (!cue) continue;

        let original = originalsRef.current.get(cue);
        if (!original) {
          original = { start: cue.startTime, end: cue.endTime };
          originalsRef.current.set(cue, original);
        }
        cue.startTime = original.start + prefs.delaySeconds;
        cue.endTime = original.end + prefs.delaySeconds;
      }
    };

    // KLJUCNO za sinhronizaciju kasno u dugom fajlu: citamo `activeCues` sa
    // STAZE preko `cuechange`, ne sopstveni tajmer nad `currentTime`. Staza
    // sama racuna aktivne cue-ove iz svog (vec ucitanog) niza, pa tacnost ne
    // zavisi od toga koliko je fajl dug ili koliko je cue-ova prosleo.
    const sync = () => {
      setLines(
        Array.from(track?.activeCues ?? []).flatMap((cue) =>
          "text" in cue && typeof cue.text === "string" ? splitCueLines(cue.text) : [],
        ),
      );
    };

    const detach = () => {
      track?.removeEventListener("cuechange", sync);
      el?.removeEventListener("load", sync);
      el = null;
      track = null;
    };

    const attach = () => {
      detach();

      const found = readTextTracks(video)[activeTextTrack];
      if (!found) return sync();

      el = found.el;
      track = found.track;

      // `video.load()` vraca modove na "disabled", a tada `activeCues` ostaje
      // prazan zauvek. Vidi isti komentar u use-player.ts.
      if (track.mode === "disabled") track.mode = "hidden";

      applyDelay();

      track.addEventListener("cuechange", sync);
      el.addEventListener("load", () => {
        applyDelay();
        sync();
      });

      // OBAVEZNO odmah, ne samo na `cuechange`: taj dogadjaj stize tek na
      // sledecoj granici cue-a, pa bi korisnik posle klika na CC gledao prazan
      // ekran do kraja tekuceg cue-a — ponekad i po nekoliko sekundi.
      sync();
    };

    attach();
    // Isti razlog kao u use-player.ts: posle `load()`-a se staze moraju ponovo
    // razresiti, jer stara referenca vise ne vazi.
    video.addEventListener("loadedmetadata", attach);
    video.addEventListener("emptied", attach);

    return () => {
      detach();
      video.removeEventListener("loadedmetadata", attach);
      video.removeEventListener("emptied", attach);
    };
    // `delaySeconds` je namerno u zavisnostima: promena ponovo pokrece attach,
    // sto ponovo primeni pomeraj na sve trenutne cue-ove preko `applyDelay`.
  }, [activeTextTrack, videoRef, prefs.delaySeconds]);

  // Titlovi ugaseni → NEMA kontejnera uopste, ne samo praznog. Prazan
  // `pointer-events-none` sloj preko cele slike je bezopasan, ali test i
  // ugovor trazu doslovno odsustvo cvora — najjednostavnije je ne lagati DOM.
  if (!visible) return null;

  const heightPct = prefs.positionPct * VIDEO_ASPECT_HEIGHT_OVER_WIDTH;

  return (
    /*
     * Poklapa se sa KUTIJOM VIDEA, ne sa kontejnerom. U fullscreen-u kontejner
     * dobija punu visinu ekrana, a video ostaje `aspect-video` prilepljen uz
     * vrh — sidrenje za dno kontejnera bi titlove spustilo u crnu traku ISPOD
     * slike. Zato `top-0` + `aspect-video`, sto reprodukuje kutiju videa bez
     * ijednog merenja.
     *
     * VAZI DOK je <video> `w-full aspect-video` i prvo dete u toku. Ako se ikad
     * centrira kroz `object-contain`, ovaj sloj mora uz njega.
     *
     * `pointer-events-none` nije kozmetika: sloj prekriva celu sliku, pa bi bez
     * njega progutao i klik na video (play/pauza) i prevlacenje seek klizaca.
     *
     * `container-type` stoji OVDE, a ne na kontejneru plejera: `inline-size`
     * povlaci `contain: layout`, sto pravi novi stacking context — na kontejneru
     * bi to promenilo kako se plejer slaze naspram sticky header-a. Ovako je
     * containment zatvoren u kutiju u kojoj se nista drugo ne desava, a `1cqi`
     * je 1% sirine slike. `positionPct` je procenat VISINE, pa se mnozi sa
     * `VIDEO_ASPECT_HEIGHT_OVER_WIDTH` (9/16) da se izrazi u `cqi` bez merenja.
     *
     * BEZ `aria-live` — bio bi monolog, protiv pravila iz use-announcer.ts.
     * BEZ `aria-hidden` — tekst ostaje u stablu pristupacnosti, isto kao sto to
     * rade i nativni cue-ovi. Oba izostanka izgledaju kao propust, pa stoje
     * napisana.
     */
    <div
      data-captions="on"
      style={{ paddingBottom: `${heightPct}cqi` }}
      className="@container pointer-events-none absolute inset-x-0 top-0 z-10 flex aspect-video flex-col items-center justify-end gap-1 px-[6%]"
    >
      {lines.map((line, index) => (
        // Indeks kao kljuc je ovde ispravan: redovi nemaju identitet, lista se
        // menja u celosti i nikad se ne preuredjuje.
        <p
          key={index}
          data-edge={prefs.edgeStyle}
          className="kf-cue"
          style={{
            fontSize: `calc(clamp(15px, 2.6cqi, 56px) * ${prefs.fontSizePct / 100})`,
            fontFamily: FONT_FAMILY_STACKS[prefs.fontFamily],
            color: hexToRgba(prefs.textColor, prefs.textOpacity),
            background: hexToRgba(prefs.bgColor, prefs.bgOpacity),
          }}
        >
          {renderCueMarkup(line)}
        </p>
      ))}
    </div>
  );
}

/** Visina/sirina video kutije (16:9) — pretvara procenat visine u `cqi`. */
const VIDEO_ASPECT_HEIGHT_OVER_WIDTH = 9 / 16;

const FONT_FAMILY_STACKS: Record<CaptionFontFamily, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
};

/** `#rrggbb` + providnost [0,1] → `rgba(...)`, jedini oblik boje koji CSS trazi. */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** WebVTT poznaje tacno ovih sest entiteta — ne treba pun HTML dekoder. */
const VTT_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&lrm;": "‎",
  "&rlm;": "‏",
};

function decodeVttEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|nbsp|lrm|rlm);/g, (match) => VTT_ENTITIES[match] ?? match);
}

/** Cue tekst → redovi, bez skidanja markupa (vidi `renderCueMarkup`). */
function splitCueLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Bilo koji tag OSIM <i>/<b> (npr. <v Govornik>, <c>) — nepodrzan, izbaci se. */
const UNSUPPORTED_TAG_RE = /<\/?(?!(?:i|b)(?:[\s>]|$))[a-z][^>]*>/gi;

const IB_TAG_RE = /<(\/?)(i|b)>/gi;

type CueSegment = string | { tag: "i" | "b"; children: CueSegment[] };

/**
 * Cue red → React cvorovi, uz podrzavanje `<i>` i `<b>` (kurziv/podebljano).
 *
 * Namerno NE koristi `cue.getCueAsHTML()`: on prelome reda pretvara u <br>
 * elemente ciji je `textContent` prazan string, a fragment bi u React trazio
 * `dangerouslySetInnerHTML` ili rucni `ref` + `replaceChildren`, cime taj cvor
 * ispada iz reconciliation-a. Ovako se gradi mala stablo struktura i predaje
 * Reactu kao obicni elementi — escape-ovanje teksta i dalje radi React sam.
 */
function renderCueMarkup(line: string): React.ReactNode {
  const cleaned = line.replace(UNSUPPORTED_TAG_RE, "");
  const root: CueSegment[] = [];
  const stack: CueSegment[][] = [root];

  let lastIndex = 0;
  IB_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = IB_TAG_RE.exec(cleaned))) {
    const [full, closing, tag] = match as unknown as [string, string, "i" | "b"];
    const textBefore = cleaned.slice(lastIndex, match.index);
    if (textBefore) stack[stack.length - 1]!.push(decodeVttEntities(textBefore));

    if (closing) {
      // Nepoklopljen zatvarajuci tag (npr. vec zatvoren cue koji prelazi
      // preko granice reda) — ignorisan umesto da srusi ostatak parsiranja.
      if (stack.length > 1) stack.pop();
    } else {
      const node: CueSegment = { tag: tag.toLowerCase() as "i" | "b", children: [] };
      stack[stack.length - 1]!.push(node);
      stack.push(node.children);
    }

    lastIndex = match.index + full.length;
  }

  const rest = cleaned.slice(lastIndex);
  if (rest) stack[stack.length - 1]!.push(decodeVttEntities(rest));

  return renderSegments(root);
}

function renderSegments(segments: CueSegment[]): React.ReactNode {
  return segments.map((segment, index) => {
    if (typeof segment === "string") return <Fragment key={index}>{segment}</Fragment>;
    const Tag = segment.tag === "i" ? "em" : "strong";
    return <Tag key={index}>{renderSegments(segment.children)}</Tag>;
  });
}
