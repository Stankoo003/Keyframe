"use client";

/**
 * Browse error boundary.
 *
 * `use client` je OBAVEZAN — Next zahteva da error boundary bude klijentska
 * komponenta, jer prima `reset()` i mora da hvata greske i pri renderu na
 * klijentu. Ovo nije stvar ukusa nego ugovor framework-a.
 */

import { useEffect } from "react";

import { PageShell } from "@/components/page-shell";

export default function BrowseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[browse] render nije uspeo:", error);
  }, [error]);

  return (
    <PageShell className="pt-7 pb-20">
      <div
        role="alert"
        className="border-kf-line bg-kf-surface rounded-kf-card mx-auto my-16 max-w-130 border p-7 text-center"
      >
        <span className="bg-kf-danger-soft text-kf-danger kf-micro inline-block rounded-md px-2.5 py-1.5 tracking-[0.16em]">
          Catalog 503
        </span>

        <h2 className="mt-4 mb-2 text-lg leading-tight font-semibold">
          Katalog nije mogao da se učita
        </h2>

        <p className="text-kf-mut mx-auto mb-5 max-w-85 text-[13px] leading-[1.55]">
          Baza nije odgovorila. Ništa nije izgubljeno — pokušaj ponovo, ili proveri da li je
          pokrenuta sa <code className="text-kf-ink3 font-mono">npm run db:up</code>.
        </p>

        {error.digest && (
          <p className="text-kf-mut2 mb-5 font-mono text-[10.5px]">digest: {error.digest}</p>
        )}

        <button
          type="button"
          onClick={reset}
          className="bg-kf-accent text-kf-accent-ink rounded-kf-btn kf-focus-ring hover:bg-kf-accent-hover cursor-pointer px-4 py-2.5 text-[13px] font-semibold transition-colors"
        >
          Pokušaj ponovo
        </button>
      </div>
    </PageShell>
  );
}
