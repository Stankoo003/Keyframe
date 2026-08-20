"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";

import {
  CAPTION_DELAY_MAX,
  CAPTION_DELAY_MIN,
  CAPTION_DELAY_STEP,
  CAPTION_EDGE_STYLES,
  CAPTION_FONT_FAMILIES,
  CAPTION_FONT_SIZE_MAX,
  CAPTION_FONT_SIZE_MIN,
  CAPTION_FONT_SIZE_STEP,
  CAPTION_OPACITY_MAX,
  CAPTION_OPACITY_MIN,
  CAPTION_OPACITY_STEP,
  CAPTION_POSITION_MAX,
  CAPTION_POSITION_MIN,
  CAPTION_POSITION_STEP,
  type CaptionEdgeStyle,
  type CaptionFontFamily,
  type CaptionPrefs,
} from "@/lib/caption-prefs";

import { useFocusTrap } from "./use-focus-trap";

const EDGE_LABELS: Record<CaptionEdgeStyle, string> = {
  none: "Bez ivice",
  shadow: "Senka",
  outline: "Kontura",
};

const FONT_FAMILY_LABELS: Record<CaptionFontFamily, string> = {
  sans: "Bezserifni",
  serif: "Serifni",
  mono: "Monospejs",
};

const FONT_FAMILY_PREVIEW_STACKS: Record<CaptionFontFamily, string> = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  mono: "ui-monospace, Menlo, monospace",
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Podesavanja izgleda titlova — prvi modal u app-u.
 *
 * Portal-uje se u `portalTarget` (kontejner plejera), NE u `document.body`:
 * u fullscreen-u se crta SAMO podstablo elementa koji je otisao u fullscreen,
 * pa bi modal na `document.body` u tom trenutku bio nevidljiv — isti razlog
 * zbog kog `CaptionOverlay` zivi u istom kontejneru.
 *
 * Renderuje se samo dok je `open` — kad se zatvori, i modal i njegov
 * `useFocusTrap` u potpunosti nestaju iz stabla, umesto da se sakrivaju.
 */
export function CaptionSettingsModal({
  open,
  onClose,
  portalTarget,
  triggerRef,
  prefs,
  onChange,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  portalTarget: React.RefObject<HTMLElement | null>;
  /** Dugme koje je otvorilo modal — fokus se vraca na njega pri zatvaranju. */
  triggerRef: React.RefObject<HTMLElement | null>;
  prefs: CaptionPrefs;
  onChange: (patch: Partial<CaptionPrefs>) => void;
  onReset: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, panelRef, onClose, triggerRef);

  if (!open || !portalTarget.current) return null;

  return createPortal(
    <div
      // `absolute inset-0` se oslanja na kontejner koji je vec `relative`
      // (isti kao za `CaptionOverlay`) — nema potrebe za `fixed`, a `fixed`
      // bi u fullscreen-u i dalje bio ispravan, ali oslanjanje na roditelja
      // drzi oba sloja pod istim pravilom.
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
      // Klik na pozadinu zatvara — standardno ponasanje modala; klik na sam
      // panel ne sme da se popne dovde (vidi `stopPropagation` ispod).
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kf-caption-settings-title"
        onClick={(event) => event.stopPropagation()}
        className="border-kf-line-strong bg-kf-surface rounded-kf-card flex max-h-full w-full max-w-sm flex-col gap-4 overflow-y-auto border p-4 text-sm shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="kf-caption-settings-title" className="text-kf-ink font-semibold">
            Podešavanja titlova
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori"
            title="Zatvori"
            className="text-kf-ink3 hover:text-kf-accent focus-visible:outline-kf-accent cursor-pointer rounded p-1 text-lg leading-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            ✕
          </button>
        </div>

        {/* Pregled uzivo — isti stil koji tekuci cue-ovi vec nose. */}
        <div className="flex items-center justify-center rounded-md bg-[repeating-conic-gradient(#2a2c30_0%_25%,#1a1b1e_0%_50%)] bg-[length:16px_16px] p-4">
          <span
            data-edge={prefs.edgeStyle}
            className="kf-cue"
            style={{
              fontSize: `${Math.round(16 * (prefs.fontSizePct / 100))}px`,
              fontFamily: FONT_FAMILY_PREVIEW_STACKS[prefs.fontFamily],
              color: hexToRgba(prefs.textColor, prefs.textOpacity),
              background: hexToRgba(prefs.bgColor, prefs.bgOpacity),
            }}
          >
            Ovako izgledaju titlovi
          </span>
        </div>

        <Field label="Veličina fonta" value={`${prefs.fontSizePct}%`}>
          <input
            type="range"
            aria-label="Veličina fonta titlova"
            min={CAPTION_FONT_SIZE_MIN}
            max={CAPTION_FONT_SIZE_MAX}
            step={CAPTION_FONT_SIZE_STEP}
            value={prefs.fontSizePct}
            onChange={(event) => onChange({ fontSizePct: Number(event.target.value) })}
            className="kf-range kf-range-sm h-1 w-full rounded-xs bg-white/18"
          />
        </Field>

        <Field label="Font">
          <select
            aria-label="Font titlova"
            value={prefs.fontFamily}
            onChange={(event) => onChange({ fontFamily: event.target.value as CaptionFontFamily })}
            className={SELECT}
          >
            {CAPTION_FONT_FAMILIES.map((family) => (
              <option key={family} value={family}>
                {FONT_FAMILY_LABELS[family]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ivica teksta">
          <div className="flex gap-1">
            {CAPTION_EDGE_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                aria-pressed={prefs.edgeStyle === style}
                onClick={() => onChange({ edgeStyle: style })}
                className={`${PILL_SMALL} data-[on=true]:border-kf-accent data-[on=true]:text-kf-accent`}
                data-on={prefs.edgeStyle === style}
              >
                {EDGE_LABELS[style]}
              </button>
            ))}
          </div>
        </Field>

        <div className="border-kf-line border-t pt-3">
          <ColorOpacityField
            label="Boja teksta"
            color={prefs.textColor}
            opacity={prefs.textOpacity}
            onColorChange={(textColor) => onChange({ textColor })}
            onOpacityChange={(textOpacity) => onChange({ textOpacity })}
          />
        </div>

        <ColorOpacityField
          label="Boja pozadine"
          color={prefs.bgColor}
          opacity={prefs.bgOpacity}
          onColorChange={(bgColor) => onChange({ bgColor })}
          onOpacityChange={(bgOpacity) => onChange({ bgOpacity })}
        />

        <Field label="Pozicija" value={`${prefs.positionPct}%`}>
          <input
            type="range"
            aria-label="Vertikalna pozicija titlova, procenat od dna slike"
            min={CAPTION_POSITION_MIN}
            max={CAPTION_POSITION_MAX}
            step={CAPTION_POSITION_STEP}
            value={prefs.positionPct}
            onChange={(event) => onChange({ positionPct: Number(event.target.value) })}
            className="kf-range kf-range-sm h-1 w-full rounded-xs bg-white/18"
          />
        </Field>

        <Field
          label="Pomeraj (sinhronizacija)"
          value={prefs.delaySeconds === 0 ? "0 s" : `${prefs.delaySeconds > 0 ? "+" : ""}${prefs.delaySeconds.toFixed(1)} s`}
        >
          <input
            type="range"
            aria-label="Vremenski pomeraj titlova"
            min={CAPTION_DELAY_MIN}
            max={CAPTION_DELAY_MAX}
            step={CAPTION_DELAY_STEP}
            value={prefs.delaySeconds}
            onChange={(event) => onChange({ delaySeconds: Number(event.target.value) })}
            className="kf-range kf-range-sm h-1 w-full rounded-xs bg-white/18"
          />
        </Field>

        <div className="flex justify-between pt-1">
          <button type="button" onClick={onReset} className={PILL_SMALL}>
            Podrazumevano
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-kf-accent text-kf-accent-ink hover:brightness-110 cursor-pointer rounded-lg px-3 py-1.5 font-mono text-[11px] leading-none tracking-[0.06em] transition-[filter]"
          >
            Gotovo
          </button>
        </div>
      </div>
    </div>,
    portalTarget.current,
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-kf-ink3 flex items-center justify-between">
        {label}
        {value !== undefined && <span className="font-mono tabular-nums">{value}</span>}
      </span>
      {children}
    </label>
  );
}

function ColorOpacityField({
  label,
  color,
  opacity,
  onColorChange,
  onOpacityChange,
}: {
  label: string;
  color: string;
  opacity: number;
  onColorChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-kf-ink3 flex items-center justify-between">
        {label}
        <span className="font-mono tabular-nums">{Math.round(opacity * 100)}%</span>
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
          className="border-kf-line-strong h-7 w-9 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
        />
        <input
          type="range"
          aria-label={`${label} — providnost`}
          min={CAPTION_OPACITY_MIN}
          max={CAPTION_OPACITY_MAX}
          step={CAPTION_OPACITY_STEP}
          value={opacity}
          onChange={(event) => onOpacityChange(Number(event.target.value))}
          className="kf-range kf-range-sm h-1 w-full rounded-xs bg-white/18"
        />
      </div>
    </div>
  );
}

const SELECT =
  "bg-kf-fill border-kf-line-strong text-kf-ink3 cursor-pointer rounded-md border px-2 py-1.5 font-mono text-[11px] leading-none";

const PILL_SMALL =
  "bg-kf-fill border-kf-line-strong text-kf-ink3 hover:bg-kf-fill-hover cursor-pointer rounded-md border px-2 py-1.5 font-mono text-[11px] leading-none transition-colors focus-visible:outline-kf-accent focus-visible:outline-2 focus-visible:outline-offset-2";
