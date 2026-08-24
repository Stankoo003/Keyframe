import Link from "next/link";

import type { VideoListItem } from "@/domain/video";
import { formatTime } from "@/lib/format";

/**
 * Kartica u katalogu, po dizajnu: prugasti poster 16:9 sa mono oznakom u
 * sredini, trajanje u pilulici dole desno, pa naslov i mono meta red.
 *
 * Podizanje na hover ide kroz `motion-safe:` — pod `prefers-reduced-motion`
 * Tailwind sam gasi varijantu, pa animacija ne mora da se hvata rucno u CSS-u.
 *
 * Serverska komponenta — samo podaci i markup.
 */
export function VideoCard({ video }: { video: VideoListItem }) {
  return (
    <Link href={`/videos/${video.slug}`} className="group flex flex-col">
      <div className="kf-stripes border-kf-line group-hover:border-kf-accent-line rounded-kf-thumb relative aspect-video overflow-hidden border transition-[transform,border-color] duration-220 motion-safe:group-hover:-translate-y-0.75">
        {video.posterUrl && (
          // Poster stize sa CDN-a; next/image bi trazio remotePatterns po hostu
          // koji dolazi iz env configa, pa bi konfiguracija zavisila od okruzenja.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.posterUrl}
            alt=""
            width={640}
            height={360}
            className="absolute inset-0 size-full object-cover"
          />
        )}

        {!video.posterUrl && (
          <span className="kf-micro absolute inset-0 flex items-center justify-center text-[10px] text-[#4b545c]">
            {video.slug}
          </span>
        )}

        <span className="bg-kf-bg/80 text-kf-ink3 absolute right-2.5 bottom-2.5 rounded-md px-1.75 py-1 font-mono text-[10px] leading-none">
          {formatTime(video.durationSeconds)}
        </span>
      </div>

      <span className="group-hover:text-kf-accent mt-3 text-[15px] leading-[1.3] font-medium tracking-[-0.01em] transition-colors">
        {video.title}
      </span>
      <span className="text-kf-mut2 mt-1.25 font-mono text-[11px] leading-[1.3]">
        {video.chapterCount > 0 ? `${video.chapterCount} poglavlja` : "bez poglavlja"}
      </span>
    </Link>
  );
}
