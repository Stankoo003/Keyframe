"use client";

/**
 * Detail error boundary.
 *
 * `use client` je OBAVEZAN — isto kao za browse: Next zahteva klijentsku
 * komponentu za error boundary, zbog `reset()` i hvatanja gresaka na klijentu.
 */

import Link from "next/link";
import { useEffect } from "react";

export default function VideoDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[video] render nije uspeo:", error);
  }, [error]);

  return (
    <main className="grid grid-cols-1 items-start gap-6 px-4 pt-5 pb-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7.5 lg:px-5 lg:pt-6.5 lg:pb-12">
      <div className="flex min-w-0 flex-col gap-5">
        <div
          role="alert"
          className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl bg-[#0b0d10] p-6 text-center"
        >
          <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-[10.5px] leading-none font-medium tracking-[0.05em] text-[#ff9d9d]">
            PLAYBACK 4102
          </span>

          <h2 className="text-[17px] leading-[1.3] font-semibold text-white">
            Ovaj snimak nije mogao da se učita
          </h2>

          <p className="max-w-[320px] text-[12.5px] leading-[1.55] text-white/60">
            Podaci o snimku nisu stigli. Pokušaj ponovo ili se vrati na katalog.
          </p>

          {error.digest && (
            <p className="font-mono text-[10px] text-white/40">digest: {error.digest}</p>
          )}

          <div className="mt-1 flex gap-2.5">
            <button
              type="button"
              onClick={reset}
              className="bg-kf-blue cursor-pointer rounded-lg px-3.5 py-2.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Pokušaj ponovo
            </button>
            <Link
              href="/"
              className="rounded-lg border border-white/20 px-3.5 py-2.5 text-[12.5px] font-medium text-white/85 transition-colors hover:bg-white/10"
            >
              Nazad na katalog
            </Link>
          </div>
        </div>
      </div>

      <aside className="border-kf-line bg-kf-bg2 rounded-xl border p-3.5">
        <div className="flex items-baseline justify-between px-0.5 pb-3">
          <h2 className="text-sm leading-none font-semibold">Poglavlja</h2>
          <span className="text-kf-mut font-mono text-[10.5px]">nedostupno</span>
        </div>
        <div className="border-kf-line rounded-[10px] border border-dashed px-4 py-5.5 text-center">
          <p className="text-kf-mut text-[12.5px] leading-[1.55]">
            Poglavlja se učitavaju zajedno sa snimkom. Pojaviće se kad učitavanje uspe.
          </p>
        </div>
      </aside>
    </main>
  );
}
