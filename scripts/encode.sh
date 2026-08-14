#!/usr/bin/env bash
#
# encode.sh — pravi multi-rendition HLS ladder (VOD) iz jednog izvornog fajla.
#
# Upotreba:
#   scripts/encode.sh <izvorni-fajl> [izlazni-folder]
#   scripts/encode.sh media/source/clip-01.mp4
#   scripts/encode.sh media/source/clip-01.mp4 public/media/clip-01
#
# Ako se izlazni folder izostavi, koristi se $OUT_ROOT/<ime-fajla-bez-ekstenzije>.
#
# Rezultat:
#   <izlaz>/master.m3u8        master playlist sa BANDWIDTH + RESOLUTION po varijanti
#   <izlaz>/360p/index.m3u8    rendition playlist
#   <izlaz>/360p/seg_000.ts    segmenti (~6s)
#   <izlaz>/540p/...
#   <izlaz>/720p/...
#
# Keyframe alignment: sve varijante imaju keyframe na identicnim vremenima, sto je
# uslov da adaptive switching ne pravi glitch. Postize se kroz tri stvari zajedno:
#   -g / -keyint_min   fiksan GOP jednak duzini segmenta
#   -sc_threshold 0    gasi keyframe-ove koje bi enkoder ubacio na promenu scene
#   -force_key_frames  garantuje keyframe tacno na 0s, 6s, 12s... bez obzira na fps
#
# Provera rezultata: scripts/verify-hls.sh <izlazni-folder>

set -euo pipefail

# ── Podesavanja ───────────────────────────────────────────────────────────────

SEGMENT_SECONDS=6

# Izlaz ide u public/ da bi Next.js servirao segmente staticki, bez route handlera.
# U Task 0.4 se isti folder objavljuje na CDN.
OUT_ROOT="${OUT_ROOT:-public/media/hls}"

# Ladder: naziv|sirina|visina|video_bitrate|maxrate|bufsize|audio_bitrate
# Redosled je bitan — ide od najmanje ka najvecoj varijanti.
LADDER=(
  "360p|640|360|800k|856k|1200k|96k"
  "540p|960|540|1400k|1498k|2100k|128k"
  "720p|1280|720|2800k|2996k|4200k|128k"
)

# ── Provere ───────────────────────────────────────────────────────────────────

die() {
  echo "greska: $*" >&2
  exit 1
}

for bin in ffmpeg ffprobe; do
  command -v "$bin" >/dev/null 2>&1 || die "$bin nije instaliran (macOS: brew install ffmpeg)"
done

[[ $# -ge 1 ]] || die "upotreba: $0 <izvorni-fajl> [izlazni-folder]"

SRC="$1"
[[ -f "$SRC" ]] || die "izvorni fajl ne postoji: $SRC"

BASENAME="$(basename "${SRC%.*}")"
OUT="${2:-$OUT_ROOT/$BASENAME}"

# ── Analiza izvora ────────────────────────────────────────────────────────────

# Ako izvor nema audio, generisemo tisinu — HLS plejeri ocekuju audio u svakoj
# varijanti, a bez toga bi -map a:0 pukao.
HAS_AUDIO=0
if ffprobe -v error -select_streams a:0 -show_entries stream=index \
  -of csv=p=0 "$SRC" 2>/dev/null | grep -q .; then
  HAS_AUDIO=1
fi

SRC_HEIGHT="$(ffprobe -v error -select_streams v:0 -show_entries stream=height \
  -of csv=p=0 "$SRC")"
[[ -n "$SRC_HEIGHT" ]] || die "ne mogu da procitam rezoluciju iz: $SRC"

# fps se koristi samo za racunanje GOP-a; force_key_frames radi posao i kad je
# fps razlomljen (npr. 30000/1001), ali -g mora biti ceo broj.
FPS_RAW="$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate \
  -of csv=p=0 "$SRC")"
FPS="$(awk -F'/' '{ printf "%.0f", ($2 ? $1/$2 : $1) }' <<<"$FPS_RAW")"
[[ "$FPS" -gt 0 ]] 2>/dev/null || FPS=30
GOP=$((FPS * SEGMENT_SECONDS))

echo "izvor      : $SRC (${SRC_HEIGHT}p, ${FPS}fps, audio: $([[ $HAS_AUDIO -eq 1 ]] && echo da || echo ne))"
echo "izlaz      : $OUT"
echo "segment    : ${SEGMENT_SECONDS}s   GOP: $GOP frejmova"

# ── Sastavljanje ffmpeg poziva ────────────────────────────────────────────────

rm -rf "$OUT"
mkdir -p "$OUT"

COUNT=${#LADDER[@]}

# filter_complex: podeli ulazni video na N grana i skaliraj svaku.
# force_original_aspect_ratio=decrease + pad cuva odnos stranica bez izobličenja.
FILTER="[0:v]split=${COUNT}"
for i in $(seq 0 $((COUNT - 1))); do
  FILTER+="[v${i}]"
done
FILTER+=";"

for i in $(seq 0 $((COUNT - 1))); do
  IFS='|' read -r _name width height _vb _mr _bs _ab <<<"${LADDER[$i]}"
  FILTER+="[v${i}]scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease,"
  FILTER+="pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}out];"
done
FILTER="${FILTER%;}"

ARGS=(-y -hide_banner -loglevel warning -stats -i "$SRC")

# Bez audio zapisa u izvoru — ubaci tihi stereo track.
if [[ $HAS_AUDIO -eq 0 ]]; then
  ARGS+=(-f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=48000")
fi

ARGS+=(-filter_complex "$FILTER")

AUDIO_INPUT=$([[ $HAS_AUDIO -eq 1 ]] && echo "0:a:0" || echo "1:a:0")
VAR_MAP=""

for i in $(seq 0 $((COUNT - 1))); do
  IFS='|' read -r name _w _h vbitrate maxrate bufsize abitrate <<<"${LADDER[$i]}"

  ARGS+=(-map "[v${i}out]" -map "$AUDIO_INPUT")

  ARGS+=(
    "-c:v:${i}" libx264
    "-preset:v:${i}" veryfast
    "-profile:v:${i}" main
    "-b:v:${i}" "$vbitrate"
    "-maxrate:v:${i}" "$maxrate"
    "-bufsize:v:${i}" "$bufsize"
  )

  ARGS+=("-c:a:${i}" aac "-b:a:${i}" "$abitrate" "-ac:a:${i}" 2 "-ar:a:${i}" 48000)

  VAR_MAP+="v:${i},a:${i},name:${name} "
done

# Keyframe alignment — vazi za sve video izlaze.
ARGS+=(
  -g "$GOP"
  -keyint_min "$GOP"
  -sc_threshold 0
  -force_key_frames "expr:gte(t,n_forced*${SEGMENT_SECONDS})"
)

[[ $HAS_AUDIO -eq 0 ]] && ARGS+=(-shortest)

ARGS+=(
  -f hls
  -hls_time "$SEGMENT_SECONDS"
  -hls_playlist_type vod
  -hls_segment_type mpegts
  -hls_flags independent_segments
  -hls_list_size 0
  -hls_segment_filename "$OUT/%v/seg_%03d.ts"
  -master_pl_name "master.m3u8"
  -var_stream_map "${VAR_MAP% }"
  "$OUT/%v/index.m3u8"
)

echo "ladder     : $(printf '%s ' "${LADDER[@]%%|*}")"
echo

ffmpeg "${ARGS[@]}"

# ── Rezime ────────────────────────────────────────────────────────────────────

echo
echo "gotovo: $OUT/master.m3u8"
du -sh "$OUT" | awk '{ print "ukupno     : " $1 }'
echo
echo "provera:  scripts/verify-hls.sh $OUT"
