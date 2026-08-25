import { describe, expect, it } from "vitest";

import { cueAt, parseThumbnailVtt } from "@/components/player/thumbnails";

const BASE = "https://cdn.example.com/hls/clip-01-bars/thumbs.vtt";

const SAMPLE = `WEBVTT

00:00:00.000 --> 00:00:02.000
thumbs.jpg#xywh=0,0,160,90

00:00:02.000 --> 00:00:04.000
thumbs.jpg#xywh=160,0,160,90

00:00:04.000 --> 00:00:06.000
thumbs.jpg#xywh=0,90,160,90
`;

describe("parseThumbnailVtt", () => {
  it("cita vremena i koordinate iz #xywh", () => {
    const cues = parseThumbnailVtt(SAMPLE, BASE);

    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject({ start: 0, end: 2, x: 0, y: 0, w: 160, h: 90 });
    expect(cues[2]).toMatchObject({ start: 4, end: 6, x: 0, y: 90 });
  });

  it("razresava relativnu putanju u odnosu na URL .vtt fajla", () => {
    const [cue] = parseThumbnailVtt(SAMPLE, BASE);

    expect(cue?.src).toBe("https://cdn.example.com/hls/clip-01-bars/thumbs.jpg");
  });

  it("radi i sa relativnim base URL-om (lokalni /media)", () => {
    const [cue] = parseThumbnailVtt(SAMPLE, "/media/hls/clip-01-bars/thumbs.vtt");

    expect(cue?.src.endsWith("/media/hls/clip-01-bars/thumbs.jpg")).toBe(true);
  });

  it("podnosi CRLF prelome", () => {
    expect(parseThumbnailVtt(SAMPLE.replace(/\n/g, "\r\n"), BASE)).toHaveLength(3);
  });

  it("preskace cue bez #xywh umesto da padne", () => {
    const mixed = `WEBVTT

00:00:00.000 --> 00:00:02.000
Zdravo, ovo je obican titl.

00:00:02.000 --> 00:00:04.000
thumbs.jpg#xywh=160,0,160,90
`;

    const cues = parseThumbnailVtt(mixed, BASE);

    expect(cues).toHaveLength(1);
    expect(cues[0]?.start).toBe(2);
  });

  it("preskace neispravna vremena i nulte dimenzije", () => {
    const broken = `WEBVTT

lose --> vreme
thumbs.jpg#xywh=0,0,160,90

00:00:04.000 --> 00:00:02.000
thumbs.jpg#xywh=0,0,160,90

00:00:06.000 --> 00:00:08.000
thumbs.jpg#xywh=0,0,0,90
`;

    expect(parseThumbnailVtt(broken, BASE)).toEqual([]);
  });

  it("vraca prazan niz za prazan ulaz", () => {
    expect(parseThumbnailVtt("", BASE)).toEqual([]);
    expect(parseThumbnailVtt("WEBVTT\n", BASE)).toEqual([]);
  });

  it("sortira cue-ove po vremenu", () => {
    const shuffled = `WEBVTT

00:00:04.000 --> 00:00:06.000
thumbs.jpg#xywh=0,90,160,90

00:00:00.000 --> 00:00:02.000
thumbs.jpg#xywh=0,0,160,90
`;

    expect(parseThumbnailVtt(shuffled, BASE).map((cue) => cue.start)).toEqual([0, 4]);
  });
});

describe("cueAt", () => {
  const cues = parseThumbnailVtt(SAMPLE, BASE);

  it("nalazi cue koji pokriva trenutak", () => {
    expect(cueAt(cues, 0)?.start).toBe(0);
    expect(cueAt(cues, 1.9)?.start).toBe(0);
    expect(cueAt(cues, 3)?.start).toBe(2);
    expect(cueAt(cues, 5.5)?.start).toBe(4);
  });

  it("granica pripada narednom cue-u", () => {
    expect(cueAt(cues, 2)?.start).toBe(2);
    expect(cueAt(cues, 4)?.start).toBe(4);
  });

  it("vraca null van opsega", () => {
    expect(cueAt(cues, -1)).toBeNull();
    expect(cueAt(cues, 6)).toBeNull();
    expect(cueAt(cues, 999)).toBeNull();
  });

  it("vraca null za praznu mapu", () => {
    expect(cueAt([], 1)).toBeNull();
  });
});
