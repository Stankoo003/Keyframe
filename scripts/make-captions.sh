#!/usr/bin/env bash
#
# make-captions.sh — transkribuje zvuk jednog klipa u WebVTT.
#
# Upotreba:
#   scripts/make-captions.sh solar-eclipse        # jezik podrazumevano en
#   scripts/make-captions.sh solar-eclipse en
#
# NIJE build korak i NE pise u public/media/captions.
#
# Masinski transkript se ne isporucuje neproveren: whisper na tisini ume da
# izmisli recenice ("Thanks for watching."), lomi vlastita imena i cepa fraze
# na delice koji bljesnu i ne stignu da se procitaju. Zato ovo pise u /tmp, a
# covek prepise rezultat u repo tek posle citanja.
#
# Preduslovi:  brew install ffmpeg whisper-cpp
#              model u ~/.cache/whisper (skida se sam ako ga nema)

set -euo pipefail

die() {
  echo "greska: $*" >&2
  exit 1
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SLUG="${1:-}"
LANG_CODE="${2:-en}"
[[ -n "$SLUG" ]] || die "upotreba: scripts/make-captions.sh <slug> [jezik]"

command -v ffmpeg >/dev/null 2>&1 || die "ffmpeg nije instaliran (macOS: brew install ffmpeg)"
command -v whisper-cli >/dev/null 2>&1 || die "whisper-cli nije instaliran (macOS: brew install whisper-cpp)"

# ── Odakle zvuk ───────────────────────────────────────────────────────────────
#
# Base URL se cita iz .env.local, nikad se ne kuca u skriptu — isto pravilo kao
# u aplikaciji. Kad je prazan, media se sluzi lokalno iz public/media.

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

BASE="${NEXT_PUBLIC_MEDIA_BASE_URL:-}"
BASE="${BASE%/}"

# 360p, ne master: audio je isti u svakom renditionu (encode.sh enkodira isti
# izvorni zvuk za sve), pa nema razloga skidati najveci video za nista.
if [[ -n "$BASE" ]]; then
  SOURCE="$BASE/hls/$SLUG/360p/index.m3u8"
else
  SOURCE="public/media/hls/$SLUG/360p/index.m3u8"
  [[ -f "$SOURCE" ]] || die "nema $SOURCE — pokreni prvo: npm run media:build"
fi

MODEL_DIR="$HOME/.cache/whisper"
MODEL="$MODEL_DIR/ggml-small.en.bin"
WORK="${TMPDIR:-/tmp}/keyframe-captions"
mkdir -p "$WORK" "$MODEL_DIR"

WAV="$WORK/$SLUG.wav"
OUT_BASE="$WORK/$SLUG.$LANG_CODE.raw"

echo "izvor : $SOURCE"
echo "model : $MODEL"
echo "radni : $WORK"
echo

# ── Model ─────────────────────────────────────────────────────────────────────
#
# small.en, a ne base.en: na snimku sa bukom u pozadini razlika je vidljiva.
# Varijante sa `.en` uz to mnogo redje odlutaju u drugi jezik.

if [[ ! -f "$MODEL" ]]; then
  echo "── skidam model (~460 MB, jednom)"
  curl -L --progress-bar -o "$MODEL" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin"
fi

# ── Zvuk ──────────────────────────────────────────────────────────────────────
#
# 16 kHz mono PCM je jedini format koji whisper.cpp prima.

echo "── izvlacim zvuk"
ffmpeg -y -v error -i "$SOURCE" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$WAV"

echo "── proveravam ima li uopste govora"
SILENCE="$(ffmpeg -hide_banner -i "$WAV" -af "silencedetect=noise=-30dB:d=2" -f null - 2>&1 |
  grep -c "silence_start" || true)"
echo "   intervala tisine duzih od 2 s: $SILENCE"

# ── Transkripcija ─────────────────────────────────────────────────────────────
#
# -ml 42 -sow drzi cue na jednom redu; bez toga jedan cue ume da pokrije trecinu
# kadra. Pragovi (-et/-lpt/-nth) teraju dekoder da ODUSTANE na segmentu u koji
# nije siguran, umesto da izmisli tekst — to je glavna odbrana od halucinacija.

echo "── transkribujem (ume da potraje nekoliko minuta)"
whisper-cli \
  -m "$MODEL" \
  -f "$WAV" \
  -l "$LANG_CODE" \
  -t 8 \
  -ovtt -of "$OUT_BASE" \
  -ml 42 -sow \
  -et 2.40 -lpt -1.00 -nth 0.60 \
  -np

echo
echo "sirov transkript: $OUT_BASE.vtt"
echo
echo "SLEDECE — rucno, ne automatski:"
echo "  1. procitaj ceo fajl; obrisi cue-ove koji su pali u tisinu"
echo "     (tipicno 'Thanks for watching.' na samom kraju)"
echo "  2. ispravi vlastita imena — whisper ih redovno lomi"
echo "  3. spoji delice krace od ~0.4 s u susedni cue"
echo "  4. tek onda prepisi u public/media/captions/$SLUG.$LANG_CODE.vtt"
echo "     i dodaj NOTE zaglavlje o tome sta je ispravljano"
