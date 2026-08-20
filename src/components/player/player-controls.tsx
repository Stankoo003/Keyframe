"use client";

import { formatTime } from "@/lib/format";

import { PLAYBACK_RATES, SEEK_STEP_SECONDS } from "./constants";
import type { PlayerActions, PlayerState } from "./use-player";

/**
 * Čisto prezentacione kontrole. Prima stanje + akcije kao props i NE zna ništa
 * o hls.js-u, engine-u ni <video> elementu (samo `import type`, koji se briše u
 * kompajlu). Zato se renderuje u testu sa lažnim propsima, bez pravog strima.
 *
 * Redosled u traci je iz zahteva, uz podesavanja titlova odmah uz same titlove:
 *   play/pauza · nazad · napred · zvuk · vreme · titlovi · podesavanja titlova ·
 *   kvalitet · brzina · fullscreen
 *
 * Izgled je iz Claude Design fajla `KeyFrame Player.dc.html`: staza 4px, cyan
 * napredak, beo okrugli thumb sa oreolom, i pilule sa mono tekstom desno.
 */
export function PlayerControls({
  state,
  actions,
  captionSettingsOpen,
  onOpenCaptionSettings,
  captionSettingsTriggerRef,
  chapterStarts = [],
  currentChapter = -1,
}: {
  state: PlayerState;
  actions: PlayerActions;
  /** Da li je modal za podesavanja titlova otvoren; vlasnik stanja je `PlayerSurface`. */
  captionSettingsOpen: boolean;
  onOpenCaptionSettings: () => void;
  /** Dugme koje otvara modal — `PlayerSurface` mu vraca fokus pri zatvaranju. */
  captionSettingsTriggerRef: React.RefObject<HTMLButtonElement | null>;
  /** Pocetci poglavlja u sekundama — crtice na traci. Prazno = ne crta se nista. */
  chapterStarts?: readonly number[];
  /** Index tekuceg poglavlja; njegova crtica se boji u cyan. */
  currentChapter?: number;
}) {
  const { playing, currentTime, duration, bufferedRanges, volume, muted, playbackRate } = state;

  const pct = (seconds: number) => (duration > 0 ? (seconds / duration) * 100 : 0);

  return (
    /*
     * Gradijent je jaci nego u dizajnu iz istog razloga kao hero na katalogu:
     * dizajn racuna na taman kadar, a SMPTE test slika je puna zasicenost — sa
     * blazim gradijentom se traka i vreme gube preko zute i cyan trake.
     */
    <div className="flex flex-col gap-2 bg-linear-to-t from-[rgba(8,9,11,.96)] via-[rgba(8,9,11,.62)] to-transparent px-4 pt-10 pb-4 sm:px-5.5">
      {/*
       * Seek traka. Sve sto se vidi je iscrtano ispod, a <input> je providan i
       * lezi preko — tako klik, prevlacenje, tastatura i citac ekrana i dalje
       * idu kroz nativnu kontrolu, bez rucnog racunanja pozicije misa.
       */}
      <div className="relative flex h-5.5 items-center">
        <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-[3px] bg-white/16">
          {/* SVI preuzeti opsezi — posle premotavanja se vide praznine među njima. */}
          {bufferedRanges.map((range) => (
            <div
              key={`${range.start}-${range.end}`}
              className="absolute inset-y-0 bg-white/28"
              style={{
                left: `${pct(range.start)}%`,
                width: `${Math.max(0, pct(range.end) - pct(range.start))}%`,
              }}
            />
          ))}

          <div
            className="bg-kf-accent absolute inset-y-0 left-0"
            style={{ width: `${pct(currentTime)}%` }}
          />
        </div>

        {/*
         * Granice poglavlja.
         *
         * Prvo poglavlje (start 0) se preskace — crtica na samom pocetku trake
         * ne razdvaja nista.
         *
         * Crtice su `pointer-events-none`: klik meta je kartica poglavlja ispod
         * plejera. Crtica siroka 2px je preuska za klik, a da bi bila klikabilna
         * morala bi da stoji iznad `<input>`-a i tu bi gutala prevlacenje.
         */}
        {chapterStarts
          .filter((start) => start > 0 && start < duration)
          .map((start) => (
            <div
              key={start}
              aria-hidden="true"
              data-active={chapterStarts[currentChapter] === start}
              className="data-[active=true]:bg-kf-accent pointer-events-none absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-[1px] bg-[rgba(8,9,11,.85)]"
              style={{ left: `${pct(start)}%` }}
            />
          ))}

        <input
          type="range"
          aria-label="Traka za premotavanje"
          // Bez ovoga citac cita sirov broj sekundi ("184") umesto "3:04 od 8:30".
          aria-valuetext={`${formatTime(currentTime)} od ${formatTime(duration)}`}
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => actions.seek(Number(event.target.value))}
          className="kf-range relative z-10 w-full"
        />
      </div>

      {/*
       * `flex-wrap` je namerno: na 390px se ceo set ne uklapa u jedan red, pa se
       * desna grupa prelama u drugi umesto da se kontrole preklope. Sakrivanje
       * nije opcija — zadatak trazi da SVE kontrole budu dostupne.
       */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={actions.togglePlay}
            // Namerno BEZ `aria-pressed`: play/pause je dugme koje menja znacenje,
            // a ne prekidac. "Pauza, pritisnuto" se cita dvosmisleno.
            aria-label={playing ? "Pauza" : "Pusti"}
            title={playing ? "Pauza" : "Pusti"}
            className={`bg-kf-ink text-kf-accent-ink flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full font-mono text-[13px] transition-colors hover:bg-white sm:size-10 ${FOCUS_RING}`}
          >
            {playing ? "❙❙" : "▶"}
          </button>

          <SkipButton onClick={() => actions.skip(-SEEK_STEP_SECONDS)} delta={-SEEK_STEP_SECONDS} />
          <SkipButton onClick={() => actions.skip(SEEK_STEP_SECONDS)} delta={SEEK_STEP_SECONDS} />

          {/*
           * Dugme za utisavanje stoji uvek; klizac se krije ispod `sm`. Na
           * dodirnim uredjajima se jacina i inace podesava tasterima uredjaja
           * (iOS ignorise `video.volume`), a klizac bi tu samo trosio sirinu.
           */}
          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={actions.toggleMute}
              // Prekidac: labela je STALNA, stanje nosi `aria-pressed`. Kad bi se
              // menjalo oboje, citac bi stanje izgovorio dvaput i protivrecno.
              aria-label="Utišaj zvuk"
              aria-pressed={muted}
              title={muted ? "Uključi zvuk" : "Utišaj"}
              className={`text-kf-ink3 hover:text-kf-accent cursor-pointer font-mono text-[12px] transition-colors ${FOCUS_RING}`}
            >
              {muted || volume === 0 ? "🔇" : "🔊"}
            </button>
            <input
              type="range"
              aria-label="Jačina zvuka"
              aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => actions.setVolume(Number(event.target.value))}
              className="kf-range kf-range-sm hidden h-1 w-20 rounded-xs bg-white/18 sm:block"
              style={{
                backgroundImage: `linear-gradient(to right, var(--kf-ink3) ${(muted ? 0 : volume) * 100}%, transparent ${(muted ? 0 : volume) * 100}%)`,
              }}
            />
          </div>

          <span className="text-kf-ink3 font-mono text-[12px] whitespace-nowrap tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CaptionsButton state={state} onToggle={actions.toggleCaptions} />

          <CaptionSettingsButton
            state={state}
            open={captionSettingsOpen}
            onOpen={onOpenCaptionSettings}
            triggerRef={captionSettingsTriggerRef}
          />

          <QualitySelect state={state} onSelect={actions.selectLevel} />

          <select
            aria-label="Brzina reprodukcije"
            value={playbackRate}
            onChange={(event) => actions.setPlaybackRate(Number(event.target.value))}
            className={PILL}
          >
            {PLAYBACK_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={actions.toggleFullscreen}
            aria-label="Ceo ekran"
            aria-pressed={state.fullscreen}
            title="Ceo ekran"
            className={PILL}
          >
            ⤢
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pilula iz dizajna — zajednicki izgled za CC, kvalitet, brzinu i fullscreen.
 * Jedan string umesto cetiri kopije, da se ne raziđu.
 */
/**
 * Vidljiv fokus je zahtev, ne ukras — zato stoji u konstanti koju dele SVA
 * dugmad. Da svako nosi svoju kopiju, prvo bi se razislo, a onda bi neko dugme
 * ostalo na podrazumevanom prstenu koji se na tamnoj podlozi jedva vidi.
 */
const FOCUS_RING =
  "focus-visible:outline-kf-accent focus-visible:outline-2 focus-visible:outline-offset-2";

const PILL =
  "bg-kf-fill border-kf-line-strong text-kf-ink3 hover:bg-kf-fill-hover cursor-pointer rounded-lg border px-2.5 py-1.5 font-mono text-[11px] leading-none tracking-[0.06em] transition-colors disabled:cursor-default disabled:hover:bg-kf-fill " +
  FOCUS_RING;

/** Tekstualno dugme za preskakanje; znak i broj se izvode iz `delta`. */
function SkipButton({ onClick, delta }: { onClick: () => void; delta: number }) {
  const label = `${delta < 0 ? "−" : "+"}${Math.abs(delta)}s`;
  const title = delta < 0 ? `Nazad ${Math.abs(delta)} sekundi` : `Napred ${delta} sekundi`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      title={title}
      className={`text-kf-ink3 hover:text-kf-accent shrink-0 cursor-pointer p-1.5 font-mono text-[12px] whitespace-nowrap transition-colors ${FOCUS_RING}`}
    >
      {label}
    </button>
  );
}

const AUTO = -1;

function QualitySelect({
  state,
  onSelect,
}: {
  state: PlayerState;
  onSelect: (index: number) => void;
}) {
  // Native HLS (Safari) ne izlaže ladder → samo "Auto", disabled.
  const disabled = !state.supportsLevelSelection || state.levels.length === 0;

  return (
    <select
      aria-label="Kvalitet"
      disabled={disabled}
      value={state.currentLevel}
      onChange={(event) => onSelect(Number(event.target.value))}
      className={`${PILL} disabled:opacity-40`}
    >
      <option value={AUTO}>Auto</option>
      {state.levels.map((level) => (
        <option key={level.index} value={level.index}>
          {level.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Prekidac za titlove.
 *
 * Kad snimak nema titl, dugme je ONEMOGUCENO a ne sakriveno — isto kako se
 * ponasa `QualitySelect` kad engine ne izlaze ladder. Dva razloga: traka se ne
 * prelama kad se predje sa snimka na snimak, a korisnik nauci da titlova nema
 * na OVOM snimku, umesto da zakljuci da ih plejer uopste ne podrzava.
 *
 * Onemoguceno dugme uz to nije fokusabilno, pa prestaje i da bude prazna stanica
 * pri tabovanju.
 */
function CaptionsButton({ state, onToggle }: { state: PlayerState; onToggle: () => void }) {
  const unavailable = state.textTracks.length === 0;
  const on = state.activeTextTrack >= 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={unavailable}
      data-on={on}
      aria-pressed={on}
      aria-label={unavailable ? "Titlovi — nema titlova za ovaj snimak" : "Titlovi"}
      title={unavailable ? "Nema titlova za ovaj snimak" : "Titlovi (C)"}
      className={`${PILL} data-[on=true]:border-kf-accent data-[on=true]:text-kf-accent disabled:opacity-40`}
    >
      CC
    </button>
  );
}

/**
 * Otvara modal za podesavanja izgleda titlova (`CaptionSettingsModal`, u
 * `player-surface.tsx`).
 *
 * Obican `<button>`, ne `<details>`: modal ima sopstvenu fokus-zamku i vraca
 * fokus TACNO na `triggerRef` (vidi `use-focus-trap.ts`), sto `<details>` ne
 * ume — Enter/Space za otvaranje dolaze besplatno jer je ovo dugme.
 *
 * ONEMOGUCENO kad snimak nema staze, iz istog razloga kao `CaptionsButton`:
 * podesavanje nepostojecih titlova je prazna kontrola koja ne radi nista, a
 * onemoguceno dugme ispada iz tab redosleda.
 *
 * NIJE onemoguceno kad titlovi postoje ali su ugaseni — podesiti izgled je
 * legitimno i pre nego sto se upale.
 */
function CaptionSettingsButton({
  state,
  open,
  onOpen,
  triggerRef,
}: {
  state: PlayerState;
  open: boolean;
  onOpen: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const disabled = state.textTracks.length === 0;

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Podešavanja titlova"
      title={disabled ? "Nema titlova za ovaj snimak" : "Podešavanja titlova"}
      className={`${PILL} disabled:opacity-40`}
    >
      Titlovi ⚙
    </button>
  );
}
