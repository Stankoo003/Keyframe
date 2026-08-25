#!/usr/bin/env bash
#
# make-thumbs.sh — pravi sličice za seek traku (sprite + mapa) za jedan video.
#
# Upotreba:
#   scripts/make-thumbs.sh <izvor> <izlazni-folder>
#   scripts/make-thumbs.sh media/source/clip-01.mp4 public/media/hls/clip-01
#   scripts/make-thumbs.sh --slug solar-eclipse
#
# Rezultat:
#   <izlaz>/thumbs.jpg   sprite: mreza pločica 160x90, 10 u redu
#   <izlaz>/thumbs.vtt   za svaki vremenski opseg koji isecak sprite-a uzeti
#
# Zasto zaseban skript, a ne samo korak u encode.sh: video koji je vec objavljen
# nema uvek izvorni fajl pri ruci, a re-enkodiranje samo zbog sličica bi bacilo
# desetine minuta i ponovo poslalo sve segmente na CDN. Sa `--slug` se pločice
# citaju pravo iz objavljenog HLS strima — segmenti se ne diraju.
#
# `encode.sh` poziva ovaj skript, pa logika postoji na jednom mestu.
#
# Posle: npm run media:sync (da thumbs.jpg i thumbs.vtt odu na CDN)

set -euo pipefail

# ── Podesavanja ───────────────────────────────────────────────────────────────

THUMB_W=160
THUMB_H=90
THUMB_COLS=10

# Gornja granica broja pločica. Bez nje bi sprite za snimak od sat vremena na
# 2s bio 1800 pločica, tj. slika preko 25 megapiksela.
THUMB_MAX_TILES=200

# Ispod ovoga sličice postaju gusce nego sto hover moze da razlikuje.
THUMB_MIN_INTERVAL=2

OUT_ROOT="${OUT_ROOT:-public/media/hls}"

# ── Provere ───────────────────────────────────────────────────────────────────

die() {
  echo "greska: $*" >&2
  exit 1
}

for bin in ffmpeg ffprobe; do
  command -v "$bin" >/dev/null 2>&1 || die "$bin nije instaliran (macOS: brew install ffmpeg)"
done

[[ $# -ge 1 ]] || die "upotreba: $0 <izvor> <izlazni-folder>  |  $0 --slug <slug>"

# ── Odredjivanje izvora i izlaza ──────────────────────────────────────────────

if [[ "$1" == "--slug" ]]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$ROOT"

  SLUG="${2:-}"
  [[ -n "$SLUG" ]] || die "upotreba: $0 --slug <slug>"

  # shellcheck disable=SC1091
  [[ -f .env.local ]] && {
    set -a
    source .env.local
    set +a
  }

  OUT="$OUT_ROOT/$SLUG"
  mkdir -p "$OUT"

  # 360p je dovoljan: pločica je ionako 160px siroka, a manja rendition znaci
  # visestruko manje skinutih segmenata.
  BASE="${NEXT_PUBLIC_MEDIA_BASE_URL:-}"
  if [[ -n "$BASE" ]]; then
    SRC="${BASE%/}/hls/$SLUG/360p/index.m3u8"
  else
    SRC="$OUT/360p/index.m3u8"
    [[ -f "$SRC" ]] || die "nema $SRC, a NEXT_PUBLIC_MEDIA_BASE_URL nije postavljen"
  fi
else
  SRC="$1"
  [[ $# -ge 2 ]] || die "upotreba: $0 <izvor> <izlazni-folder>"
  OUT="$2"
  mkdir -p "$OUT"
fi

# ── Racunica ──────────────────────────────────────────────────────────────────

DURATION="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC" 2>/dev/null || true)"
[[ -n "$DURATION" && "$DURATION" != "N/A" ]] || die "ne mogu da procitam trajanje iz: $SRC"

# ceil(trajanje / MAX_TILES), ali nikad ispod minimuma.
INTERVAL="$(awk -v d="$DURATION" -v max="$THUMB_MAX_TILES" -v min="$THUMB_MIN_INTERVAL" \
  'BEGIN { i = int(d / max); if (i * max < d) i++; if (i < min) i = min; print i }')"

# Koliko pločica ffmpeg zapravo proizvede: fps=1/N uzorkuje na 0, N, 2N, ... sve
# dok je uzorak STROGO pre kraja, sto je tacno ceil(trajanje / N). Kod klipa od
# 28s na 2s to je 14 (0..26), ne 15 — visak cue bi pokazivao na praznu pločicu.
COUNT="$(awk -v d="$DURATION" -v n="$INTERVAL" \
  'BEGIN { c = int(d / n); if (c * n < d) c++; if (c < 1) c = 1; print c }')"
ROWS=$(((COUNT + THUMB_COLS - 1) / THUMB_COLS))

echo "izvor      : $SRC"
echo "slicice    : $COUNT kom (na ${INTERVAL}s, mreza ${THUMB_COLS}x${ROWS})"

# ── Sprite ────────────────────────────────────────────────────────────────────
#
# force_original_aspect_ratio=decrease + pad cuva odnos stranica kod izvora koji
# nije 16:9 — isti obrazac kao u ladder filter-grafu.
#
# `tile` uvek popuni celu mrezu (visak pločica ostaje crn); to je u redu jer
# thumbs.vtt opisuje samo onoliko cue-ova koliko ih stvarno ima.

ffmpeg -y -hide_banner -loglevel error -i "$SRC" \
  -vf "fps=1/${INTERVAL},scale=${THUMB_W}:${THUMB_H}:force_original_aspect_ratio=decrease,pad=${THUMB_W}:${THUMB_H}:(ow-iw)/2:(oh-ih)/2,tile=${THUMB_COLS}x${ROWS}" \
  -frames:v 1 -q:v 5 \
  "$OUT/thumbs.jpg"

# ── Mapa ──────────────────────────────────────────────────────────────────────
#
# Putanja u cue-u je RELATIVNA (`thumbs.jpg`), bez hosta i bez vodece kose crte
# — isto pravilo kao za putanje u bazi. Plejer je razresava u odnosu na URL
# samog .vtt fajla, pa isti fajl radi i lokalno i sa CDN-a.

{
  echo "WEBVTT"
  echo
  i=0
  while [[ $i -lt $COUNT ]]; do
    start=$((i * INTERVAL))
    end=$((start + INTERVAL))
    x=$(((i % THUMB_COLS) * THUMB_W))
    y=$(((i / THUMB_COLS) * THUMB_H))

    printf '%02d:%02d:%02d.000 --> %02d:%02d:%02d.000\n' \
      $((start / 3600)) $((start % 3600 / 60)) $((start % 60)) \
      $((end / 3600)) $((end % 3600 / 60)) $((end % 60))
    printf 'thumbs.jpg#xywh=%d,%d,%d,%d\n\n' "$x" "$y" "$THUMB_W" "$THUMB_H"

    i=$((i + 1))
  done
} >"$OUT/thumbs.vtt"

echo "gotovo     : $OUT/thumbs.jpg + thumbs.vtt"
