#!/usr/bin/env bash
#
# sync-r2.sh — jednokratni sync enkodiranog HLS-a na Cloudflare R2.
#
# Ovo NIJE upload pipeline — pokrece se rucno kad se media regenerise.
#
# Upotreba:
#   scripts/sync-r2.sh              # posalje public/media/{hls,captions}
#   scripts/sync-r2.sh --dry-run    # pokazi sta bi poslao, bez slanja
#
# Kredencijali se citaju iz .env.local (nije u gitu):
#   R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
#
# Zasto cetiri prolaza umesto jednog `sync`:
# Object storage svemu stavlja application/octet-stream, sto plejeri odbijaju.
# Content-Type se postavlja PRI UPLOADU i vazi za ceo prolaz, pa .m3u8, .ts,
# .jpg, .vtt i .srt moraju ici odvojeno.
#
# Titlovi dolaze iz DRUGOG direktorijuma (public/media/captions) i jedini su
# koji se drze u gitu — HLS izlaz se regenerise skriptama, .vtt je rucno
# pregledan tekst. Zato svaki od ta dva izvora ima svoj gard: skripta radi i
# kad postoji samo jedan od njih.

set -euo pipefail

die() {
  echo "greska: $*" >&2
  exit 1
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SOURCE_DIR="public/media/hls"
CAPTIONS_DIR="public/media/captions"
DRY_RUN=""

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN="--dryrun"

# ── Kredencijali ──────────────────────────────────────────────────────────────

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

command -v aws >/dev/null 2>&1 || die "aws CLI nije instaliran (macOS: brew install awscli)"
if [[ ! -d "$SOURCE_DIR" && ! -d "$CAPTIONS_DIR" ]]; then
  die "nema ni $SOURCE_DIR ni $CAPTIONS_DIR — pokreni prvo: npm run media:build"
fi

for var in R2_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  [[ -n "${!var:-}" ]] || die "fali $var u .env.local (vidi .env.example)"
done

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
DEST="s3://${R2_BUCKET}/hls"
CAPTIONS_DEST="s3://${R2_BUCKET}/captions"

# aws CLI cita kredencijale iz ovih imena.
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"
# R2 ne podrzava nove integrity headere koje aws CLI v2 salje po defaultu.
export AWS_REQUEST_CHECKSUM_CALCULATION="when_required"
export AWS_RESPONSE_CHECKSUM_VALIDATION="when_required"

echo "izvor   : $SOURCE_DIR, $CAPTIONS_DIR"
echo "odrediste: $DEST"
echo "endpoint: $ENDPOINT"
[[ -n "$DRY_RUN" ]] && echo "režim   : DRY RUN (ništa se ne šalje)"
echo

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "preskacem HLS — nema $SOURCE_DIR"
else

# ── Prolaz 1: playliste ───────────────────────────────────────────────────────

echo "── .m3u8 → application/vnd.apple.mpegurl"
aws s3 cp "$SOURCE_DIR" "$DEST" \
  --recursive \
  --exclude "*" --include "*.m3u8" \
  --content-type "application/vnd.apple.mpegurl" \
  --cache-control "public, max-age=60" \
  --endpoint-url "$ENDPOINT" \
  $DRY_RUN

# ── Prolaz 2: segmenti ────────────────────────────────────────────────────────

echo
echo "── .ts → video/mp2t"
aws s3 cp "$SOURCE_DIR" "$DEST" \
  --recursive \
  --exclude "*" --include "*.ts" \
  --content-type "video/mp2t" \
  --cache-control "public, max-age=31536000, immutable" \
  --endpoint-url "$ENDPOINT" \
  $DRY_RUN

# ── Prolaz 3: posteri ─────────────────────────────────────────────────────────

echo
echo "── .jpg → image/jpeg"
aws s3 cp "$SOURCE_DIR" "$DEST" \
  --recursive \
  --exclude "*" --include "*.jpg" \
  --content-type "image/jpeg" \
  --cache-control "public, max-age=86400" \
  --endpoint-url "$ENDPOINT" \
  $DRY_RUN

# ── Prolaz 3b: thumbs.vtt ─────────────────────────────────────────────────────
#
# Poseban prolaz jer .vtt iz hls/ nije titl nego mapa sličica za seek traku, pa
# ne moze da ide zajedno sa Prolazom 4 (druga destinacija i drugi max-age).
# Menja se samo pri re-enkodiranju, kao i poster — otuda isti max-age.

echo
echo "── .vtt (slicice) → text/vtt"
aws s3 cp "$SOURCE_DIR" "$DEST" \
  --recursive \
  --exclude "*" --include "*.vtt" \
  --content-type "text/vtt; charset=utf-8" \
  --cache-control "public, max-age=86400" \
  --endpoint-url "$ENDPOINT" \
  $DRY_RUN

fi

# ── Prolaz 4: titlovi ─────────────────────────────────────────────────────────
#
# Kratak max-age: .vtt se ispravlja rucno i mora da se osvezi bez cekanja.

if [[ ! -d "$CAPTIONS_DIR" ]]; then
  echo
  echo "preskacem titlove — nema $CAPTIONS_DIR"
else
  echo
  echo "── .vtt → text/vtt"
  aws s3 cp "$CAPTIONS_DIR" "$CAPTIONS_DEST" \
    --recursive \
    --exclude "*" --include "*.vtt" \
    --content-type "text/vtt; charset=utf-8" \
    --cache-control "public, max-age=300" \
    --endpoint-url "$ENDPOINT" \
    $DRY_RUN

  # SRT ide zasebno jer mu je Content-Type drugi. Bez `charset` namerno:
  # enkoding SRT-a nije pouzdan (cesto Windows-1252), a plejer ga i ne cita
  # odavde — bajtove dekodira sam, vidi src/components/player/subtitle-source.ts.
  echo
  echo "── .srt → application/x-subrip"
  aws s3 cp "$CAPTIONS_DIR" "$CAPTIONS_DEST" \
    --recursive \
    --exclude "*" --include "*.srt" \
    --content-type "application/x-subrip" \
    --cache-control "public, max-age=300" \
    --endpoint-url "$ENDPOINT" \
    $DRY_RUN
fi

echo
if [[ -n "$DRY_RUN" ]]; then
  echo "dry run gotov — ništa nije poslato"
else
  echo "sync gotov"
  echo
  echo "provera:  scripts/verify-cdn.sh"
fi
