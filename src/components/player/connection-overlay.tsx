"use client";

const MESSAGE = "Veza prekinuta. Pokušavam ponovo…";

/**
 * "Veza prekinuta, pokušavam ponovo" — privremen natpis preko slike dok
 * `usePlayer` ceka da baferovanje/mreza dodju u red (vidi efekat u
 * `use-player.ts`). Cisto informativan, NE modal: nema dugmadi, nema fokusa
 * koji bi trebalo da uhvati — retry je vec u toku sam od sebe, ovo samo
 * kaze da se desava. Isti spinner kao `videos/[slug]/loading.tsx`, radi
 * doslednosti kroz app.
 *
 * Komponenta je UVEK montirana (vidljivost ide kroz `visible`/opacity, ne
 * kroz uslovno renderovanje): `role="status"` region koji bi se pojavio
 * ZAJEDNO sa svojim tekstom citaci cesto propuste — vidi isti razlog u
 * `player-surface.tsx` (druga grana ovog repoa) uz `CaptionOverlay`. Ovako
 * region postoji od pocetka, prazan, i citac hvata promenu teksta.
 */
export function ConnectionOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/55 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <span
        aria-hidden="true"
        className="kf-spin border-t-kf-accent block size-8.5 rounded-full border-[3px] border-white/15"
      />
      <span aria-hidden="true" className="kf-micro text-kf-ink2">
        {MESSAGE}
      </span>

      <span role="status" aria-live="polite" className="sr-only">
        {visible ? MESSAGE : ""}
      </span>
    </div>
  );
}
