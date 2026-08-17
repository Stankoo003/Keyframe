import type { ChapterDto } from "@/domain/video";
import { formatTime, percentOf } from "@/lib/format";

/**
 * Okvir plejera po mockupu — poster, dugme, traka sa oznakama poglavlja,
 * red kontrola.
 *
 * VAZNO: ovo je jos uvek samo prikaz. Pravi HLS plejer dolazi u zasebnom
 * zadatku i popunjava isti okvir, bez menjanja rasporeda oko njega.
 *
 * Zato su sve kontrole `<span aria-hidden="true">`, a ne `<button>`: tastatura
 * i citaci ekrana ne smeju da naidju na kontrolu koja ne radi nista. Vizuelno
 * je identicno mockupu, a nikom nije obecano ponasanje koje ne postoji.
 */
export function PlayerFrame({
  posterUrl,
  manifestUrl,
  durationSeconds,
  chapters,
}: {
  posterUrl: string | null;
  manifestUrl: string;
  durationSeconds: number;
  chapters: readonly ChapterDto[];
}) {
  // Ime fajla je dovoljno; pun URL bi prekrio pola kadra.
  const manifestLabel = manifestUrl.split("/").slice(-2).join("/");

  return (
    <div className="border-kf-line relative aspect-video overflow-hidden rounded-xl border bg-[#0b0d10]">
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt=""
          width={1280}
          height={720}
          className="absolute inset-0 size-full object-cover opacity-70"
        />
      ) : (
        <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.05)_0_8px,transparent_8px_16px)]" />
      )}

      <span className="absolute top-3 left-3.5 font-mono text-[10px] leading-none text-white/50">
        hls · {manifestLabel}
      </span>

      <span
        aria-hidden="true"
        className="bg-kf-blue absolute top-1/2 left-1/2 flex size-[62px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-[0_8px_30px_rgba(0,0,0,.45)]"
      >
        <span className="ml-[5px] block h-0 w-0 border-y-[11px] border-l-[17px] border-y-transparent border-l-white" />
      </span>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 bg-linear-to-t from-black/70 to-transparent px-4 pt-3.5 pb-3">
        <div aria-hidden="true" className="relative h-1 rounded-full bg-white/25">
          {/* Oznake poglavlja na traci — jedini deo koji nosi prave podatke. */}
          {chapters.map((chapter) => (
            <span
              key={chapter.id}
              className="absolute top-[-2px] h-2 w-px bg-white/60"
              style={{ left: `${percentOf(chapter.startSeconds, durationSeconds)}%` }}
            />
          ))}
        </div>

        <div className="flex items-center gap-3.5 font-mono text-[11px] text-white/85">
          <span aria-hidden="true" className="flex gap-[3px]">
            <span className="block h-3 w-[3px] bg-current" />
            <span className="block h-3 w-[3px] bg-current" />
          </span>
          <span>0:00 / {formatTime(durationSeconds)}</span>
          <span className="flex-1" />
          <span aria-hidden="true">CC</span>
          <span aria-hidden="true">1.0×</span>
          <span aria-hidden="true">720p</span>
          <span
            aria-hidden="true"
            className="block size-[11px] rounded-[2px] border-[1.5px] border-current"
          />
        </div>
      </div>
    </div>
  );
}
