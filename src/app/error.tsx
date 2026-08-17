"use client";

/**
 * Browse error boundary.
 *
 * `use client` je OBAVEZAN — Next zahteva da error boundary bude klijentska
 * komponenta, jer prima `reset()` i mora da hvata greske i pri renderu na
 * klijentu. Ovo nije stvar ukusa nego ugovor framework-a.
 */

import { useEffect } from "react";

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
    <main className="px-5 pt-6.5 pb-10">
      <div
        role="alert"
        className="border-kf-line bg-kf-bg mx-auto my-10 max-w-[520px] rounded-xl border p-6.5 text-center shadow-[var(--kf-shade)]"
      >
        <span className="bg-kf-danger-soft text-kf-danger inline-block rounded-md px-2.5 py-1 font-mono text-[10.5px] leading-none font-medium tracking-[0.05em]">
          CATALOG 503
        </span>

        <h2 className="mt-3.5 mb-1.5 text-lg leading-[1.25] font-semibold">
          Katalog nije mogao da se učita
        </h2>

        <p className="text-kf-mut mx-auto mb-5 max-w-[360px] text-[13px] leading-[1.55]">
          Baza nije odgovorila. Ništa nije izgubljeno — pokušaj ponovo, ili proveri da li je
          pokrenuta sa <code className="font-mono">npm run db:up</code>.
        </p>

        {error.digest && (
          <p className="text-kf-mut mb-5 font-mono text-[10.5px]">digest: {error.digest}</p>
        )}

        <button
          type="button"
          onClick={reset}
          className="bg-kf-blue text-kf-blue-ink cursor-pointer rounded-lg px-3.5 py-2.5 text-[12.5px] font-medium transition-opacity hover:opacity-90"
        >
          Pokušaj ponovo
        </button>
      </div>
    </main>
  );
}
