#!/usr/bin/env bash
#
# make-sample-clips.sh — pravi sinteticke izvorne klipove ffmpeg-om.
#
# Postoji da bi repo bio samodovoljan: niko ne mora da skida video sa interneta
# da bi regenerisao medije. Klipovi su 1080p30, 20-30s, sa tonom, i vizuelno se
# razlikuju da se u plejeru vidi kad se prelazi sa jednog na drugi.
#
# Upotreba:
#   scripts/make-sample-clips.sh [izlazni-folder]     # podrazumevano media/source
#
# Za prave klipove umesto ovih, vidi sekciju "Media pipeline" u README-u.

set -euo pipefail

die() {
  echo "greska: $*" >&2
  exit 1
}

command -v ffmpeg >/dev/null 2>&1 || die "ffmpeg nije instaliran (macOS: brew install ffmpeg)"

OUT="${1:-media/source}"
mkdir -p "$OUT"

# naziv|trajanje_s|video_filter|frekvencija_tona
CLIPS=(
  "clip-01-bars|24|smptebars=size=1920x1080:rate=30|440"
  "clip-02-motion|28|testsrc2=size=1920x1080:rate=30|523"
  "clip-03-fractal|20|mandelbrot=size=1920x1080:rate=30|659"
  "clip-04-noise|26|life=size=1920x1080:rate=30:mold=10:ratio=0.1:death_color=#C83232:life_color=#00FF00|784"
)

for entry in "${CLIPS[@]}"; do
  IFS='|' read -r name duration vfilter freq <<<"$entry"
  target="$OUT/$name.mp4"

  if [[ -f "$target" ]]; then
    echo "preskacem  : $target (vec postoji)"
    continue
  fi

  echo "pravim     : $target (${duration}s)"

  # Trajanje ide kroz -t, ne kroz opciju filtera — neki lavfi izvori
  # (mandelbrot, life) nemaju `duration` opciju.
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -t "$duration" -i "$vfilter" \
    -f lavfi -t "$duration" -i "sine=frequency=${freq}:sample_rate=48000" \
    -c:v libx264 -preset veryfast -pix_fmt yuv420p -crf 20 \
    -c:a aac -b:a 128k \
    -shortest "$target"
done

echo
echo "gotovo — izvorni klipovi u $OUT:"
ls -lh "$OUT" | tail -n +2 | awk '{ print "  " $9 "  " $5 }'
