#!/usr/bin/env bash
#
# verify-cdn.sh — provera da je media dostupna sa CDN-a sa tacnim zaglavljima.
#
# Upotreba:
#   scripts/verify-cdn.sh                    # koristi NEXT_PUBLIC_MEDIA_BASE_URL iz .env.local
#   scripts/verify-cdn.sh https://pub-x.r2.dev
#
# Proverava, preko HEAD zahteva:
#   1. master playlista je dostupna preko HTTPS
#   2. Content-Type je application/vnd.apple.mpegurl za .m3u8, video/mp2t za .ts
#   3. CORS dozvoljava app origin
#
# Izlazni kod 0 = sve proslo.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

die() {
  echo "greska: $*" >&2
  exit 1
}

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

BASE="${1:-${NEXT_PUBLIC_MEDIA_BASE_URL:-}}"
[[ -n "$BASE" ]] || die "nema base URL-a — prosledi ga kao argument ili postavi NEXT_PUBLIC_MEDIA_BASE_URL u .env.local"
BASE="${BASE%/}"

APP_ORIGIN="${APP_ORIGIN:-http://localhost:3000}"
FAILED=0

pass() { echo "  ✓ $*"; }
fail() {
  echo "  ✗ $*"
  FAILED=1
}

# Prvi klip iz lokalnog foldera sluzi kao uzorak za HLS provere.
#
# Nije fatalno kad ga nema: HLS izlaz je gitignore-ovan pa ga svez klon nema,
# ali titlovi se drze u gitu i mogu da se provere i tada.
CLIP="$(ls public/media/hls 2>/dev/null | head -1)"

# Titlovi su u gitu, pa se uzorak cita iz repoa, a ne sa CDN-a.
CAPTION="$(ls public/media/captions/*.vtt 2>/dev/null | head -1)"
CAPTION="${CAPTION##*/}"

echo "base URL : $BASE"
echo "app origin: $APP_ORIGIN"
echo "uzorak   : ${CLIP:-(nema lokalnog HLS-a)}"
echo "titl     : ${CAPTION:-(nema)}"
echo

# Vraca "<http_code>|<content-type>|<allow-origin>"
#
# Imena zaglavlja se prvo spustaju na mala slova: HTTP/1.1 ih salje sa velikim
# pocetnim slovom, HTTP/2 sva mala, a `awk` na macOS-u nema GNU-ov IGNORECASE.
probe() {
  curl -sI -H "Origin: $APP_ORIGIN" "$1" |
    tr -d '\r' |
    awk '{ line = $0; header = tolower($1) }
         /^HTTP/ { code = $2 }
         header == "content-type:" { ct = $2; sub(/;.*/, "", ct) }
         header == "access-control-allow-origin:" { ao = $2 }
         END { print code "|" ct "|" ao }'
}

check() {
  local url="$1" expected_ct="$2" label="$3"
  local result code ct ao
  result="$(probe "$url")"
  code="${result%%|*}"
  ct="$(cut -d'|' -f2 <<<"$result")"
  ao="$(cut -d'|' -f3 <<<"$result")"

  if [[ "$code" != "200" ]]; then
    fail "$label — HTTP $code (ocekivano 200)"
    return
  fi
  pass "$label — HTTP 200"

  if [[ "$ct" == "$expected_ct" ]]; then
    pass "$label — Content-Type: $ct"
  else
    fail "$label — Content-Type: '${ct:-prazan}', ocekivano '$expected_ct'"
  fi

  if [[ -n "$ao" ]]; then
    pass "$label — CORS: Access-Control-Allow-Origin: $ao"
  else
    fail "$label — nema Access-Control-Allow-Origin (CORS nije podesen na bucketu)"
  fi
}

if [[ -z "$CLIP" ]]; then
  echo "HLS provere preskocene — nema public/media/hls (pokreni: npm run media:build)"
else
  echo "master playlista"
  check "$BASE/hls/$CLIP/master.m3u8" "application/vnd.apple.mpegurl" "master.m3u8"

  echo
  echo "rendition playliste i segmenti"
  # Rezolucije se citaju iz lokalnog izlaza, ne iz fiksne liste — inace bi
  # dodavanje stepenika u ladder (encode.sh) tiho ostalo neprovereno.
  RENDITIONS=()
  while IFS= read -r dir; do
    [[ -n "$dir" ]] && RENDITIONS+=("$(basename "$dir")")
  done < <(find "public/media/hls/$CLIP" -mindepth 1 -maxdepth 1 -type d | sort)

  for r in "${RENDITIONS[@]}"; do
    check "$BASE/hls/$CLIP/$r/index.m3u8" "application/vnd.apple.mpegurl" "$r/index.m3u8"
    check "$BASE/hls/$CLIP/$r/seg_000.ts" "video/mp2t" "$r/seg_000.ts"
  done
fi

# Titlovi se proveravaju posebno: <track> je CORS fetch (vidi `crossOrigin` u
# player-surface.tsx), pa pogresan Content-Type ili odsutan ACAO znaci da se
# .vtt preuzme a cue-ovi ostanu prazni — bez ijedne greske u konzoli.
echo
echo "titlovi"
if [[ -z "$CAPTION" ]]; then
  fail "nema .vtt u public/media/captions"
else
  check "$BASE/captions/$CAPTION" "text/vtt" "$CAPTION"
fi

echo
echo "reprodukcija sa CDN-a"
if [[ -z "$CLIP" ]]; then
  echo "  (preskoceno — nema lokalnog uzorka)"
elif command -v ffprobe >/dev/null 2>&1; then
  if ffprobe -v error -show_entries stream=codec_name -of csv=p=0 \
    "$BASE/hls/$CLIP/master.m3u8" >/dev/null 2>&1; then
    pass "ffprobe uspesno cita stream"
  else
    fail "ffprobe ne moze da procita stream sa CDN-a"
  fi
else
  echo "  – ffprobe nije instaliran, preskacem"
fi

echo
if [[ $FAILED -eq 0 ]]; then
  echo "sve provere prosle"
else
  echo "neke provere nisu prosle"
fi

exit $FAILED
