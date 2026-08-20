/**
 * Konverzija titla — jedini deo ove funkcije koji stvarno moze da bude netacan,
 * a ne vidi se golim okom (pogresna milisekunda izgleda isto kao tacna).
 *
 * Zato je testirano OVDE, a ne kroz Playwright: logika je cista, pa joj browser
 * ne treba; e2e proverava samo da se rezultat zaista prikaze.
 */
import { describe, expect, it } from "vitest";

import {
  decodeSubtitleBytes,
  detectSubtitleFormat,
  prepareSubtitle,
  srtToVtt,
  SubtitleError,
} from "@/components/player/subtitle-source";

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("detectSubtitleFormat", () => {
  it("prepoznaje VTT po potpisu", () => {
    expect(detectSubtitleFormat("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nZdravo")).toBe("vtt");
  });

  it("prepoznaje SRT iz sadrzaja, bez obzira na ime fajla", () => {
    expect(detectSubtitleFormat("1\n00:00:01,000 --> 00:00:02,000\nZdravo")).toBe("srt");
  });

  it("baca na fajl koji nije ni jedno ni drugo", () => {
    expect(() => detectSubtitleFormat("<html><body>404</body></html>")).toThrow(SubtitleError);
  });
});

describe("srtToVtt", () => {
  it("konvertuje ispravan fajl i tacno prevodi cue KASNO u fajlu", () => {
    // Prvi cue je trivijalan; greska u satima ili u dopuni milisekundi vidi se
    // tek na velikim vremenima, pa je bas taj cue ovde i poenta.
    const srt = [
      "1",
      "00:00:01,000 --> 00:00:02,500",
      "Prvi",
      "",
      "842",
      "01:02:03,456 --> 01:02:07,890",
      "Kasni cue",
      "u dva reda",
    ].join("\n");

    const { vtt, repairs } = srtToVtt(srt);

    expect(repairs).toEqual([]);
    expect(vtt).toBe(
      [
        "WEBVTT",
        "",
        "00:00:01.000 --> 00:00:02.500",
        "Prvi",
        "",
        "01:02:03.456 --> 01:02:07.890",
        "Kasni cue",
        "u dva reda",
        "",
      ].join("\n"),
    );
  });

  it("baca kad nijedno vreme nije ispravno", () => {
    const srt = "1\n00:00:01 -> 00:00:02\nTekst\n\n2\nnula --> jedan\nTekst";
    expect(() => srtToVtt(srt)).toThrow(/nijedan ispravan cue/);
  });

  it("preskace pojedinacan neispravan cue, ali zadrzi ostale", () => {
    const srt = "1\n00:00:01,000 --> 00:00:02,000\nDobar\n\n2\nXX --> YY\nLos";
    const { vtt, repairs } = srtToVtt(srt);

    expect(vtt).toContain("00:00:01.000 --> 00:00:02.000");
    expect(vtt).not.toContain("Los");
    expect(repairs).toHaveLength(1);
  });

  it("sortira cue-ove van redosleda", () => {
    const srt = "1\n00:00:10,000 --> 00:00:12,000\nDrugi\n\n2\n00:00:01,000 --> 00:00:02,000\nPrvi";
    const { vtt, repairs } = srtToVtt(srt);

    expect(vtt.indexOf("Prvi")).toBeLessThan(vtt.indexOf("Drugi"));
    expect(repairs.join(" ")).toMatch(/redosled/);
  });

  it("preskace cue kome kraj nije posle pocetka", () => {
    const srt =
      "1\n00:00:05,000 --> 00:00:05,000\nNula\n\n2\n00:00:09,000 --> 00:00:08,000\nUnazad\n\n3\n00:00:10,000 --> 00:00:11,000\nDobar";
    const { vtt, repairs } = srtToVtt(srt);

    expect(vtt).not.toContain("Nula");
    expect(vtt).not.toContain("Unazad");
    expect(vtt).toContain("Dobar");
    expect(repairs).toHaveLength(2);
  });

  it("skracuje cue preko kraja snimka i odbacuje one koji pocinju posle njega", () => {
    const srt =
      "1\n00:00:08,000 --> 00:00:15,000\nPreklapa kraj\n\n2\n00:00:30,000 --> 00:00:32,000\nPosle kraja";
    const { vtt, repairs } = srtToVtt(srt, { duration: 10 });

    expect(vtt).toContain("00:00:08.000 --> 00:00:10.000");
    expect(vtt).not.toContain("Posle kraja");
    expect(repairs).toHaveLength(2);
  });

  it("bez poznatog trajanja ne skracuje nista", () => {
    const srt = "1\n00:00:08,000 --> 00:00:15,000\nCeo";
    expect(srtToVtt(srt, { duration: Number.NaN }).vtt).toContain("--> 00:00:15.000");
  });

  it("podnosi CRLF, tacku umesto zareza i visak koordinata iza vremena", () => {
    const srt = "1\r\n00:00:01.000 --> 00:00:02,000 X1:0 X2:100\r\nTekst\r\n";
    expect(srtToVtt(srt).vtt).toContain("00:00:01.000 --> 00:00:02.000");
  });
});

describe("decodeSubtitleBytes", () => {
  it("cita UTF-8 sa BOM-om i skida BOM", () => {
    expect(decodeSubtitleBytes(bytes("﻿WEBVTT"))).toBe("WEBVTT");
  });

  it("dekodira Windows-1252 fajl umesto da vrati mojibake", () => {
    // "café" u Windows-1252: 0xE9 je samostalan bajt, sto nije validan UTF-8.
    const buffer = new Uint8Array([0x63, 0x61, 0x66, 0xe9]).buffer as ArrayBuffer;
    expect(decodeSubtitleBytes(buffer)).toBe("café");
  });

  it("baca jasnu gresku kad ni fallback ne daje smislen tekst", () => {
    // 0x81 i 0x8D u Windows-1252 nemaju mapiranje — ostaju C1 kontrolni znaci.
    const buffer = new Uint8Array([0x81, 0x8d, 0x90]).buffer as ArrayBuffer;
    expect(() => decodeSubtitleBytes(buffer)).toThrow(/UTF-8/);
  });
});

describe("prepareSubtitle", () => {
  it("VTT prolazi nepromenjen", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nZdravo\n";
    expect(prepareSubtitle(bytes(vtt))).toEqual({ vtt, format: "vtt", repairs: [] });
  });

  it("SRT se konvertuje i prijavljuje kao SRT", () => {
    const result = prepareSubtitle(bytes("1\n00:00:01,000 --> 00:00:02,000\nZdravo"));
    expect(result.format).toBe("srt");
    expect(result.vtt.startsWith("WEBVTT")).toBe(true);
  });
});
