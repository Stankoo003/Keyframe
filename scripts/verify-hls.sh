#!/usr/bin/env bash
#
# verify-hls.sh — provera da je HLS izlaz ispravan i da su keyframe-ovi poravnati.
#
# Upotreba:
#   scripts/verify-hls.sh <folder-sa-master.m3u8>
#   scripts/verify-hls.sh media/hls/clip-01
#
# Proverava:
#   1. master.m3u8 postoji i svaka varijanta ima BANDWIDTH i RESOLUTION
#   2. svaka varijanta ima index.m3u8, EXT-X-PLAYLIST-TYPE:VOD i segmente
#   3. keyframe-ovi su na identicnim vremenima u SVIM varijantama
#
# Izlazni kod 0 = sve proslo, 1 = nesto ne valja.

set -uo pipefail

die() {
  echo "greska: $*" >&2
  exit 1
}

command -v ffprobe >/dev/null 2>&1 || die "ffprobe nije instaliran"

[[ $# -ge 1 ]] || die "upotreba: $0 <folder-sa-master.m3u8>"

DIR="${1%/}"
MASTER="$DIR/master.m3u8"
FAILED=0

pass() { echo "  ✓ $*"; }
fail() {
  echo "  ✗ $*"
  FAILED=1
}

# ── 1. Master playlist ────────────────────────────────────────────────────────

echo "master playlist"

[[ -f "$MASTER" ]] || die "nema master playliste: $MASTER"
pass "$MASTER postoji"

VARIANT_LINES="$(grep -c '^#EXT-X-STREAM-INF' "$MASTER" || true)"
if [[ "$VARIANT_LINES" -ge 3 ]]; then
  pass "$VARIANT_LINES varijante (minimum 3)"
else
  fail "samo $VARIANT_LINES varijanti, treba najmanje 3"
fi

while IFS= read -r line; do
  desc="$(sed 's/^#EXT-X-STREAM-INF://' <<<"$line" | cut -c1-70)"
  if grep -q 'BANDWIDTH=' <<<"$line" && grep -q 'RESOLUTION=' <<<"$line"; then
    pass "$desc"
  else
    fail "fali BANDWIDTH ili RESOLUTION: $desc"
  fi
done < <(grep '^#EXT-X-STREAM-INF' "$MASTER")

# ── 2. Rendition playliste ────────────────────────────────────────────────────

echo
echo "rendition playliste"

# Bez `mapfile` — macOS dolazi sa bash 3.2 koji ga nema.
PLAYLISTS=()
while IFS= read -r rel; do
  [[ -n "$rel" ]] && PLAYLISTS+=("$rel")
done < <(grep -v '^#' "$MASTER" | grep -v '^$')

[[ ${#PLAYLISTS[@]} -gt 0 ]] || die "master ne referencira nijednu playlistu"

for rel in "${PLAYLISTS[@]}"; do
  pl="$DIR/$rel"
  if [[ ! -f "$pl" ]]; then
    fail "$rel ne postoji"
    continue
  fi

  segments="$(grep -c '\.ts$' "$pl" || true)"

  if ! grep -q '^#EXT-X-PLAYLIST-TYPE:VOD' "$pl"; then
    fail "$rel — fali EXT-X-PLAYLIST-TYPE:VOD"
  elif [[ "$segments" -lt 1 ]]; then
    fail "$rel — nema segmenata"
  else
    pass "$rel — $segments segmenata, VOD"
  fi
done

# ── 3. Sličice za seek traku ──────────────────────────────────────────────────
#
# Nedostatak sličica ne kvari reprodukciju (plejer tiho preskace hover preview),
# ali jeste znak da je enkodiranje raden starijom verzijom skripta.

echo
echo "slicice"

if [[ -f "$DIR/thumbs.jpg" ]]; then
  pass "thumbs.jpg postoji"
else
  fail "nema thumbs.jpg"
fi

if [[ ! -f "$DIR/thumbs.vtt" ]]; then
  fail "nema thumbs.vtt"
elif ! head -n 1 "$DIR/thumbs.vtt" | grep -q '^WEBVTT'; then
  fail "thumbs.vtt ne pocinje sa WEBVTT"
else
  cues="$(grep -c '#xywh=' "$DIR/thumbs.vtt" || true)"
  if [[ "$cues" -lt 1 ]]; then
    fail "thumbs.vtt nema nijedan cue sa #xywh="
  else
    pass "thumbs.vtt — $cues slicica"
  fi
fi

# ── 4. Keyframe alignment ─────────────────────────────────────────────────────
#
# Za svaku varijantu izvlacimo vremena svih keyframe-ova (I-frejmova) i
# poredimo ih sa prvom varijantom. Moraju biti identicna do na 1ms.

echo
echo "keyframe alignment"

REFERENCE=""
REF_NAME=""

for rel in "${PLAYLISTS[@]}"; do
  pl="$DIR/$rel"
  [[ -f "$pl" ]] || continue

  name="$(dirname "$rel")"

  # concat protokol spaja sve segmente u jedan logicki tok, pa dobijamo
  # apsolutna vremena keyframe-ova kroz ceo rendition.
  seg_dir="$DIR/$name"
  segs=()
  while IFS= read -r s; do
    [[ -n "$s" ]] && segs+=("$seg_dir/$s")
  done < <(grep '\.ts$' "$pl")
  [[ ${#segs[@]} -gt 0 ]] || continue

  list="$(printf '%s|' "${segs[@]}")"

  times="$(ffprobe -v error -select_streams v:0 \
    -show_entries frame=pts_time,pict_type \
    -of csv=p=0 "concat:${list%|}" 2>/dev/null |
    awk -F, '$2 == "I" { printf "%.3f\n", $1 }' | sort -n | uniq)"

  count="$(wc -l <<<"$times" | tr -d ' ')"

  if [[ -z "$REFERENCE" ]]; then
    REFERENCE="$times"
    REF_NAME="$name"
    pass "$name — $count keyframe-ova (referenca): $(tr '\n' ' ' <<<"$times")"
  elif [[ "$times" == "$REFERENCE" ]]; then
    pass "$name — $count keyframe-ova, identicno kao $REF_NAME"
  else
    fail "$name — keyframe-ovi se NE poklapaju sa $REF_NAME"
    echo "      $REF_NAME: $(tr '\n' ' ' <<<"$REFERENCE")"
    echo "      $name: $(tr '\n' ' ' <<<"$times")"
  fi
done

# ── Rezime ────────────────────────────────────────────────────────────────────

echo
if [[ $FAILED -eq 0 ]]; then
  echo "sve provere prosle"
else
  echo "neke provere nisu prosle"
fi

exit $FAILED
