"use client";

/**
 * Detail error boundary.
 *
 * `use client` je OBAVEZAN — isto kao za browse: Next zahteva klijentsku
 * komponentu za error boundary, zbog `reset()` i hvatanja gresaka na klijentu.
 */

import Link from "next/link";
import { useEffect } from "react";

import { PageShell } from "@/components/page-shell";

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
    <PageShell className="pt-7 pb-18">
      <div className="mx-auto max-w-275">
        <div
          role="alert"
          className="kf-frame border-kf-line rounded-kf-card flex aspect-video min-w-0 flex-col items-center justify-center gap-3.5 border p-6 text-center"
        >
          <span className="bg-kf-danger-soft text-kf-danger kf-micro rounded-md px-2.5 py-1.5 tracking-[0.16em]">
            Playback 4102
          </span>

          <h2 className="text-[17px] leading-[1.3] font-semibold">
            Ovaj snimak nije mogao da se učita
          </h2>

          <p className="text-kf-ink2 max-w-80 text-[13px] leading-[1.55]">
            Podaci o snimku nisu stigli. Pokušaj ponovo ili se vrati na katalog.
          </p>

          {error.digest && (
            <p className="text-kf-mut2 font-mono text-[10px]">digest: {error.digest}</p>
          )}

          <div className="mt-1 flex gap-2.5">
            <button
              type="button"
              onClick={reset}
              className="bg-kf-accent text-kf-accent-ink rounded-kf-btn hover:bg-kf-accent-hover cursor-pointer px-4 py-2.5 text-[13px] font-semibold transition-colors"
            >
              Pokušaj ponovo
            </button>
            <Link
              href="/"
              className="border-kf-line-strong text-kf-ink3 rounded-kf-btn hover:bg-kf-fill border px-4 py-2.5 text-[13px] font-medium transition-colors"
            >
              Nazad na katalog
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
