"use client";

import { useEffect } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fokus-zamka za modal — prvo mesto u app-u kojem uopste treba.
 *
 * Tri stvari koje mora da uradi, po WAI-ARIA "Dialog (Modal)" obrascu:
 *  1. Pri otvaranju, fokus ulazi UNUTRA (prvi fokusabilni element).
 *  2. Dok je otvoren, Tab/Shift+Tab kruzi SAMO unutar modala — ne sme da
 *     pobegne nazad na dugmad plejera iza njega.
 *  3. Pri zatvaranju, fokus se vraca na `returnFocusTo` (dugme koje je
 *     otvorilo modal) — bez ovoga bi korisnik tastature posle Esc ostao
 *     "izgubljen" na vrhu dokumenta.
 *
 * Esc zatvara modal ovde, na jednom mestu, umesto da svaki pozivalac dodaje
 * svoj `keydown` handler.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  returnFocusTo: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const focusable = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Prvi fokusabilni element, ili sam kontejner ako modal (jos) nema
    // nijedan — npr. dok se sadrzaj tek montira.
    const first = focusable()[0] ?? container;
    first.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstEl = elements[0]!;
      const lastEl = elements[elements.length - 1]!;
      const active = document.activeElement;

      // Na ivici liste, Tab/Shift+Tab preskace NAZAD unutra umesto van
      // modala — to je cela "zamka".
      if (event.shiftKey && active === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);

    // Uhvaceno OVDE, ne citano u cleanup-u: dugme-okidac ne nestaje dok je
    // modal otvoren, ali React/eslint ne moze to da zna iz same `ref` citanja
    // unutar cleanup-a — vrednost se zato "smrzava" na pocetku efekta.
    const trigger = returnFocusTo.current;

    return () => {
      container.removeEventListener("keydown", onKeyDown);
      // BEZUSLOVNO, ne "samo ako je fokus jos unutra": modal se unmount-uje
      // (vidi `CaptionSettingsModal`, `if (!open) return null`) PRE nego sto
      // ovaj cleanup stigne da se izvrsi, a uklanjanje fokusiranog cvora iz
      // DOM-a browser sam odmah prebaci fokus na <body> — provera "da li je
      // fokus jos u kontejneru" bi zato UVEK bila false, bas u trenutku kad
      // treba da uspe. Jedini nacin da se modal zatvori jeste kroz njegove
      // sopstvene akcije (Esc, klik na pozadinu, dugme) — nema scenarija u
      // kom bi vracanje fokusa na okidac bilo neocekivano.
      trigger?.focus();
    };
  }, [active, containerRef, onClose, returnFocusTo]);
}
