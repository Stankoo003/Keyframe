"use client";

import type { PlayerActions, PlayerState } from "./use-player";

/**
 * Čisto prezentacione kontrole. Prima stanje + akcije kao props i NE zna ništa
 * o hls.js-u, engine-u ni <video> elementu (samo `import type`, koji se briše u
 * kompajlu). Zato se renderuje u testu sa lažnim propsима, bez pravog strima.
 */
export function PlayerControls({ state, actions }: { state: PlayerState; actions: PlayerActions }) {
  const { playing, currentTime, duration, buffered, volume, muted } = state;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-2 bg-black/70 px-3 py-2 text-white">
      {/* Seek traka + buffered pozadina */}
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute inset-x-0 h-1 rounded bg-white/20" />
        <div
          className="pointer-events-none absolute h-1 rounded bg-white/40"
          style={{ width: `${bufferedPct}%` }}
        />
        <input
          type="range"
          aria-label="Traka za premotavanje"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => actions.seek(Number(e.target.value))}
          className="relative z-10 w-full accent-white"
        />
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={actions.togglePlay}
          aria-label={playing ? "Pauza" : "Pusti"}
          className="rounded px-2 py-0.5 hover:bg-white/10"
        >
          {playing ? "❚❚" : "▶"}
        </button>

        <span className="text-white/80 tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={actions.toggleMute}
            aria-label={muted ? "Uključi zvuk" : "Utišaj"}
            className="rounded px-2 py-0.5 hover:bg-white/10"
          >
            {muted || volume === 0 ? "🔇" : "🔊"}
          </button>
          <input
            type="range"
            aria-label="Jačina zvuka"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => actions.setVolume(Number(e.target.value))}
            className="w-20 accent-white"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <QualitySelect state={state} onSelect={actions.selectLevel} />
          <button
            type="button"
            onClick={actions.toggleFullscreen}
            aria-label="Ceo ekran"
            className="rounded px-2 py-0.5 hover:bg-white/10"
          >
            ⛶
          </button>
        </div>
      </div>
    </div>
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
      onChange={(e) => onSelect(Number(e.target.value))}
      className="rounded bg-white/10 px-1 py-0.5 text-xs disabled:opacity-50"
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
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
