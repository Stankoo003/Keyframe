"use client";

import { useEffect, useRef } from "react";

/**
 * Desni-klik meni preko slike — jedina jasno "meni" povrsina koju plejer ima
 * (nema settings-dropdown u traci kontrola). Trenutno nosi samo Stats for
 * nerds toggle; napravljen tako da nove stavke mogu da se dodaju bez izmene
 * pozicioniranja/zatvaranja logike.
 *
 * Zatvara se na Escape, klik van menija ili izbor stavke; fokus se vraca na
 * `returnFocusTo` po zatvaranju (isti obrazac kao StatsOverlay).
 */
export function PlayerContextMenu({
  x,
  y,
  statsEnabled,
  onToggleStats,
  onClose,
  returnFocusTo,
}: {
  x: number;
  y: number;
  statsEnabled: boolean;
  onToggleStats: () => void;
  onClose: () => void;
  returnFocusTo: React.RefObject<HTMLElement | null>;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const itemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    itemRef.current?.focus();
    // Kopija u efekat-scope: cleanup mora da vidi element koji je bio meta pri
    // OTVARANJU, ne sto god `returnFocusTo.current` postane u medjuvremenu.
    const elementToRefocus = returnFocusTo.current;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      elementToRefocus?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- otvara se jednom po pojavljivanju
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      ref={rootRef}
      role="menu"
      aria-label="Plejer meni"
      onKeyDown={onKeyDown}
      style={{ left: x, top: y }}
      className="border-kf-line-strong bg-kf-bg/95 rounded-kf-btn absolute z-40 min-w-44 border py-1 font-mono text-[12px] shadow-lg backdrop-blur-xl"
    >
      <button
        ref={itemRef}
        type="button"
        role="menuitemcheckbox"
        aria-checked={statsEnabled}
        onClick={() => {
          onToggleStats();
          onClose();
        }}
        className="text-kf-ink3 hover:bg-kf-fill hover:text-kf-ink focus-visible:outline-kf-accent flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        Stats for nerds
        <span aria-hidden="true">{statsEnabled ? "✓" : ""}</span>
      </button>
    </div>
  );
}
