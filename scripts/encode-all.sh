#!/usr/bin/env bash
#
# encode-all.sh — pusti encode.sh na svaki klip u izvornom folderu, pa verifikuj.
#
# Upotreba:
#   scripts/encode-all.sh [izvorni-folder]     # podrazumevano media/source

set -euo pipefail

SRC_DIR="${1:-media/source}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ -d "$SRC_DIR" ]] || {
  echo "greska: nema foldera $SRC_DIR — pokreni prvo scripts/make-sample-clips.sh" >&2
  exit 1
}

FOUND=0
FAILED=0

for src in "$SRC_DIR"/*.mp4 "$SRC_DIR"/*.mov "$SRC_DIR"/*.mkv; do
  [[ -f "$src" ]] || continue
  FOUND=$((FOUND + 1))

  echo "═══ $src"
  "$HERE/encode.sh" "$src"
  echo
done

[[ $FOUND -gt 0 ]] || {
  echo "greska: nijedan video fajl u $SRC_DIR" >&2
  exit 1
}

echo "═══ verifikacija"
echo

for dir in "${OUT_ROOT:-media/hls}"/*/; do
  [[ -f "$dir/master.m3u8" ]] || continue
  echo "── $dir"
  "$HERE/verify-hls.sh" "$dir" || FAILED=1
  echo
done

if [[ $FAILED -eq 0 ]]; then
  echo "svih $FOUND klipova enkodirano i verifikovano"
else
  echo "neki klipovi nisu prosli verifikaciju" >&2
  exit 1
fi
