"use client";

import { PLAYBACK_RATES, SEEK_STEP_SECONDS } from "./constants";
import type { PlayerActions, PlayerState } from "./use-player";

/**
 * Čisto prezentacione kontrole. Prima stanje + akcije kao props i NE zna ništa
 * o hls.js-u, engine-u ni <video> elementu (samo `import type`, koji se briše u
 * kompajlu). Zato se renderuje u testu sa lažnim propsima, bez pravog strima.
 *
 * Redosled u traci je iz zahteva:
 *   play/pauza · nazad · napred · vreme · zvuk · titlovi · kvalitet · brzina · fullscreen
 *
 * Titlovi su namerno onemogućeni — dolaze u svom zadatku. Slot stoji da raspored
 * kasnije ne mora da se prepravlja.
 */
export function PlayerControls({ state, actions }: { state: PlayerState; actions: PlayerActions }) {
  const { playing, currentTime, duration, bufferedRanges, volume, muted, playbackRate } = state;

  const pct = (seconds: number) => (duration > 0 ? (seconds / duration) * 100 : 0);

  return (
    <div className="flex flex-col gap-2 bg-linear-to-t from-black/80 to-black/40 px-3 py-2 text-white">
      {/* Seek traka: preuzeti opsezi ispod, klizač iznad. */}
      <div className="relative flex h-4 items-center">
        <div className="pointer-events-none absolute inset-x-0 h-1 rounded-full bg-white/20" />

        {/* SVI preuzeti opsezi — posle premotavanja se vide praznine među njima. */}
        {bufferedRanges.map((range) => (
          <div
            key={`${range.start}-${range.end}`}
            className="pointer-events-none absolute h-1 rounded-full bg-white/40"
            style={{
              left: `${pct(range.start)}%`,
              width: `${Math.max(0, pct(range.end) - pct(range.start))}%`,
            }}
          />
        ))}

        <input
          type="range"
          aria-label="Traka za premotavanje"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => actions.seek(Number(event.target.value))}
          className="relative z-10 w-full accent-white"
        />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <IconButton
          onClick={actions.togglePlay}
          label={playing ? "Pauza" : "Pusti"}
          text={playing ? "❚❚" : "▶"}
        />

        <IconButton
          onClick={() => actions.skip(-SEEK_STEP_SECONDS)}
          label={`Nazad ${SEEK_STEP_SECONDS} sekundi`}
          text={`⟲${SEEK_STEP_SECONDS}`}
        />
        <IconButton
          onClick={() => actions.skip(SEEK_STEP_SECONDS)}
          label={`Napred ${SEEK_STEP_SECONDS} sekundi`}
          text={`${SEEK_STEP_SECONDS}⟳`}
        />

        <span className="ml-1 text-white/80 tabular-nums">
          {formatClock(currentTime)} / {formatClock(duration)}
        </span>

        <div className="flex items-center gap-1">
          <IconButton
            onClick={actions.toggleMute}
            label={muted ? "Uključi zvuk" : "Utišaj"}
            text={muted || volume === 0 ? "🔇" : "🔊"}
          />
          <input
            type="range"
            aria-label="Jačina zvuka"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(event) => actions.setVolume(Number(event.target.value))}
            className="w-20 accent-white"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Slot za titlove — popunjava se u zasebnom zadatku. */}
          <button
            type="button"
            disabled
            title="Titlovi — dolaze u sledećem zadatku"
            aria-label="Titlovi (još nedostupno)"
            className="rounded px-2 py-0.5 text-xs opacity-40"
          >
            CC
          </button>

          <QualitySelect state={state} onSelect={actions.selectLevel} />

          <select
            aria-label="Brzina reprodukcije"
            value={playbackRate}
            onChange={(event) => actions.setPlaybackRate(Number(event.target.value))}
            className="rounded bg-white/10 px-1 py-0.5 text-xs"
          >
            {PLAYBACK_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>

          <IconButton onClick={actions.toggleFullscreen} label="Ceo ekran" text="⛶" />
        </div>
      </div>
    </div>
  );
}

function IconButton({
  onClick,
  label,
  text,
}: {
  onClick: () => void;
  label: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded px-2 py-0.5 tabular-nums transition-colors hover:bg-white/15"
    >
      {text}
    </button>
  );
}

const AUTO = -1;

function QualitySelect({
  state,
  onSelect,
}: {
  state: PlayerState;
  onSelect: (index: number) => void;
}) {
  // Native HLS (Safari) ne izlaže ladder → samo "Auto", disabled.
  const disabled = !state.supportsLevelSelection || state.levels.length === 0;

  return (
    <select
      aria-label="Kvalitet"
      disabled={disabled}
      value={state.currentLevel}
      onChange={(event) => onSelect(Number(event.target.value))}
      className="rounded bg-white/10 px-1 py-0.5 text-xs disabled:opacity-40"
    >
      <option value={AUTO}>Auto</option>
      {state.levels.map((level) => (
        <option key={level.index} value={level.index}>
          {level.label}
        </option>
      ))}
    </select>
  );
}

/** Sekunde → "m:ss". */
function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
