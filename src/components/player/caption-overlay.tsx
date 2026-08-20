"use client";

import { useEffect, useRef, useState } from "react";

import type { CaptionBgOpacity, CaptionScale } from "@/lib/caption-prefs";

import { readTextTracks } from "./text-tracks";

/**
 * Titlovi koje crtamo SAMI, umesto da ih prepustimo browseru.
 *
 * Zasto uopste: cue kutija koju crta browser zivi u UA shadow stablu <video>
 * elementa, gde nemamo ni layout ni stacking kontrolu. To je pravilo dva
 * konkretna kvara:
 *
 *  1. U desktop Safariju titlovi NESTANU u fullscreen-u. Fullscreen trazimo nad
 *     kontejner divom, a cue kutija ostaje u shadow stablu videa. Koji je tacno
 *     WebKit quirk kriv nije utvrdjeno — i namerno nije bitno: sloj koji je DOM
 *     potomak elementa koji ide u fullscreen ne moze da promasi fullscreen
 *     kutiju, po konstrukciji. Uklanja se cela klasa kvarova, ne pogodjena
 *     hipoteza.
 *  2. `::cue { font-size }` u Safariju nadjacaju sistemska podesavanja titlova,
 *     pa se velicina nativno ne bi mogla ponuditi uopste.
 *
 * Cena: WebVTT tagovi (<i>, <v Govornik>) se skidaju i renderuje se cist tekst.
 * Nas .vtt nema nijedan; skidanje je odbrambeno (vidi `cueLines`).
 */
export function CaptionOverlay({
  videoRef,
  activeTextTrack,
  scale,
  bgOpacity,
  delaySeconds,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Indeks ukljucene staze, ili -1 kad su titlovi ugaseni. */
  activeTextTrack: number;
  scale: CaptionScale;
  bgOpacity: CaptionBgOpacity;
  /** Pomeraj u sekundama; pozitivno kasni titlove, negativno ih ubrzava. */
  delaySeconds: number;
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
    // Ugasene titlove ne pratimo uopste — `lines` se ne renderuje (vidi `visible`
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
        cue.startTime = original.start + delaySeconds;
        cue.endTime = original.end + delaySeconds;
      }
    };

    const sync = () => {
      setLines(
        Array.from(track?.activeCues ?? []).flatMap((cue) =>
          "text" in cue && typeof cue.text === "string" ? cueLines(cue.text) : [],
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
  }, [activeTextTrack, videoRef, delaySeconds]);

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
     * je 1% sirine slike.
     *
     * BEZ `aria-live` — bio bi monolog, protiv pravila iz use-announcer.ts.
     * BEZ `aria-hidden` — tekst ostaje u stablu pristupacnosti, isto kao sto to
     * rade i nativni cue-ovi. Oba izostanka izgledaju kao propust, pa stoje
     * napisana.
     */
    <div
      data-captions={visible ? "on" : "off"}
      style={{ "--kf-cc-scale": scale, "--kf-cc-bg": bgOpacity } as React.CSSProperties}
      className="@container pointer-events-none absolute inset-x-0 top-0 z-10 flex aspect-video flex-col items-center justify-end gap-1 px-[6%] pb-22"
    >
      {visible &&
        lines.map((line, index) => (
          // Indeks kao kljuc je ovde ispravan: redovi nemaju identitet, lista se
          // menja u celosti i nikad se ne preuredjuje.
          <p key={index} className="kf-cue">
            {line}
          </p>
        ))}
    </div>
  );
}

/** WebVTT poznaje tacno ovih sest entiteta — ne treba pun HTML dekoder. */
const VTT_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&lrm;": "‎",
  "&rlm;": "‏",
};

/**
 * Cue tekst → redovi obicnog teksta.
 *
 * Namerno NE koristi `cue.getCueAsHTML()`: on prelome reda pretvara u <br>
 * elemente ciji je `textContent` prazan string, pa bi citanje fragmenta spojilo
 * dva reda bez razmaka. Uz to bi ubacivanje DocumentFragment-a u React trazilo
 * `ref` + `replaceChildren`, cime taj cvor ispada iz reconciliation-a.
 *
 * Ovako izlaze obicni stringovi koje React renderuje kao tekstualne cvorove —
 * escape-ovanje radi React, `dangerouslySetInnerHTML` se nigde ne pojavljuje.
 */
function cueLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/<[^>]*>/g, "")
        .replace(/&(?:amp|lt|gt|nbsp|lrm|rlm);/g, (match) => VTT_ENTITIES[match] ?? match)
        .trim(),
    )
    .filter((line) => line.length > 0);
}
