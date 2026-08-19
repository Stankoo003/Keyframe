"use client";

import { formatTime } from "@/lib/format";

/**
 * Ponuda da se nastavi od sacuvane pozicije.
 *
 * Ciste prezentacione kontrole — ne cita `localStorage` niti dira <video>.
 * Odluku donosi `PlayerStage`; ovde su samo dva dugmeta i tekst.
 *
 * Namerno NE pomera reprodukciju samo od sebe: zahtev trazi PONUDU. Traka stoji
 * preko dna slike, iznad kontrola, i nestaje sama ako je korisnik ignorise.
 */
export function ResumePrompt({
  seconds,
  onResume,
  onRestart,
}: {
  seconds: number;
  onResume: () => void;
  onRestart: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Nastavak gledanja"
      className="border-kf-line-strong bg-kf-bg/85 rounded-kf-btn absolute inset-x-3 bottom-20 z-20 flex flex-wrap items-center justify-between gap-3 border px-4 py-3 backdrop-blur-xl sm:inset-x-5"
    >
      <p className="text-kf-ink2 text-[13px]">
        Prekinuo si na <span className="text-kf-ink font-mono">{formatTime(seconds)}</span>.
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onResume}
          className="bg-kf-accent text-kf-accent-ink rounded-kf-btn hover:bg-kf-accent-hover cursor-pointer px-3.5 py-2 text-[13px] font-semibold transition-colors"
        >
          Nastavi od {formatTime(seconds)}
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="border-kf-line-strong text-kf-ink3 rounded-kf-btn hover:bg-kf-fill cursor-pointer border px-3.5 py-2 text-[13px] font-medium transition-colors"
        >
          Ispočetka
        </button>
      </div>
    </div>
  );
}
