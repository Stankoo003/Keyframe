#!/usr/bin/env bash
#
# sync-r2.sh — jednokratni sync enkodiranog HLS-a na Cloudflare R2.
#
# Ovo NIJE upload pipeline — pokrece se rucno kad se media regenerise.
#
# Upotreba:
#   scripts/sync-r2.sh              # posalje public/media/hls
#   scripts/sync-r2.sh --dry-run    # pokazi sta bi poslao, bez slanja
#
# Kredencijali se citaju iz .env.local (nije u gitu):
#   R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
#
# Zasto dva prolaza umesto jednog `sync`:
# Object storage svemu stavlja application/octet-stream, sto plejeri odbijaju.
# Content-Type se postavlja PRI UPLOADU i vazi za ceo prolaz, pa .m3u8 i .ts
# moraju ici odvojeno.

set -euo pipefail

die() {
  echo "greska: $*" >&2
  exit 1
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SOURCE_DIR="public/media/hls"
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
[[ -d "$SOURCE_DIR" ]] || die "nema $SOURCE_DIR — pokreni prvo: npm run media:build"

for var in R2_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  [[ -n "${!var:-}" ]] || die "fali $var u .env.local (vidi .env.example)"
done

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
DEST="s3://${R2_BUCKET}/hls"

# aws CLI cita kredencijale iz ovih imena.
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"
# R2 ne podrzava nove integrity headere koje aws CLI v2 salje po defaultu.
export AWS_REQUEST_CHECKSUM_CALCULATION="when_required"
export AWS_RESPONSE_CHECKSUM_VALIDATION="when_required"

echo "izvor   : $SOURCE_DIR"
echo "odrediste: $DEST"
echo "endpoint: $ENDPOINT"
[[ -n "$DRY_RUN" ]] && echo "režim   : DRY RUN (ništa se ne šalje)"
echo

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

echo
if [[ -n "$DRY_RUN" ]]; then
  echo "dry run gotov — ništa nije poslato"
else
  echo "sync gotov"
  echo
  echo "provera:  scripts/verify-cdn.sh"
fi
