"use client";

import { useEffect, useRef } from "react";

import { AUTO_LEVEL } from "./engine/types";
import type { PlayerStatsSnapshot, StatsLogEntry } from "./use-player-stats";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function formatBandwidth(bps: number | null): string {
  if (bps === null) return "N/A";
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mb/s`;
  return `${(bps / 1000).toFixed(0)} kb/s`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "N/A";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  return `${(bytes / 1000).toFixed(0)} KB`;
}

function formatLevelLabel(index: number, levels: PlayerStatsSnapshot["levels"]): string {
  if (index === AUTO_LEVEL) return "Auto";
  return levels.find((level) => level.index === index)?.label ?? `#${index}`;
}

function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function describeLogEntry(entry: StatsLogEntry, levels: PlayerStatsSnapshot["levels"]): string {
  if (entry.kind === "switch") {
    const from = formatLevelLabel(entry.from, levels);
    const to = formatLevelLabel(entry.to, levels);
    const trigger = entry.auto ? "ABR" : "ručno";
    return `Promena kvaliteta: ${from} → ${to} (${trigger})`;
  }
  return `Zastoj (rebuffering): ${(entry.durationMs / 1000).toFixed(2)}s`;
}

/**
 * "Stats for nerds" — live streaming metrike, po uzoru na YouTube-ov panel.
 *
 * Fokus se hvata unutar overlaya (Tab/Shift+Tab cirkulisu) i vraca na element
 * koji je bio fokusiran pre otvaranja kad se zatvori — projekat trenutno nema
 * gotov focus-trap util, pa je lokalan ovoj komponenti.
 */
export function StatsOverlay({
  snapshot,
  onClose,
}: {
  snapshot: PlayerStatsSnapshot;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab" || !rootRef.current) return;

    const focusable = Array.from(rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Statistika prenosa"
      onKeyDown={onKeyDown}
      // Ne sme da isprovocira kontejnerove precice ispod (npr. "f" za fullscreen)
      // dok korisnik cita/navigira overlay.
      onClick={(event) => event.stopPropagation()}
      className="border-kf-line-strong bg-kf-bg/92 rounded-kf-btn absolute top-3 right-3 z-30 max-h-[calc(100%-1.5rem)] w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto border p-3 font-mono text-[11px] backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-kf-ink text-[12px] font-semibold tracking-[0.04em]">Stats for nerds</h2>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Zatvori statistiku"
          title="Zatvori (Esc)"
          className="text-kf-ink3 hover:text-kf-accent focus-visible:outline-kf-accent cursor-pointer px-1 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ✕
        </button>
      </div>

      <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-kf-ink3">
        <Row label="Rendition" value={formatLevelLabel(snapshot.currentLevel, snapshot.levels)} />
        <Row label="Bandwidth" value={formatBandwidth(snapshot.bandwidthEstimate)} />
        <Row label="Buffer ahead" value={`${snapshot.bufferAheadSeconds.toFixed(1)}s`} />
        <Row
          label="Dropped frames"
          value={`${snapshot.droppedFrames} / ${snapshot.totalFrames}`}
        />
        <Row
          label="Poslednji segment"
          value={
            snapshot.lastFragLoadMs === null
              ? "N/A"
              : `${snapshot.lastFragLoadMs.toFixed(0)}ms · ${formatBytes(snapshot.lastFragSizeBytes)}`
          }
        />
        <Row label="Zastoji (ukupno)" value={String(snapshot.stallCount)} />
      </dl>

      <h3 className="text-kf-ink3 mb-1 text-[10px] tracking-[0.08em] uppercase">Log</h3>
      {snapshot.log.length === 0 ? (
        <p className="text-kf-ink3/70">Još nema događaja.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {snapshot.log.map((entry) => (
            <li key={entry.id} className="text-kf-ink3 leading-tight">
              <span className="text-kf-ink3/60">{formatClock(entry.timestamp)}</span>{" "}
              {describeLogEntry(entry, snapshot.levels)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-kf-ink3/70">{label}</dt>
      <dd className="text-kf-ink tabular-nums">{value}</dd>
    </>
  );
}
