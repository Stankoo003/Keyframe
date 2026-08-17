import Link from "next/link";

import type { VideoListItem } from "@/domain/video";
import { formatTime } from "@/lib/format";

/**
 * Kartica u browse mrezi, po mockupu:
 * poster 16:9, slug mono gore levo, badge trajanja dole desno, naslov, meta red.
 *
 * Serverska komponenta — samo podaci i markup.
 */
export function VideoCard({ video }: { video: VideoListItem }) {
  return (
    <Link href={`/videos/${video.slug}`} className="group flex flex-col gap-2.5">
      <div className="kf-stripes border-kf-line group-hover:border-kf-blue-line relative aspect-video overflow-hidden rounded-[10px] border shadow-[var(--kf-shade)] transition-[border-color]">
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

        <span className="text-kf-mut absolute top-2.5 left-2.5 font-mono text-[9.5px] leading-none tracking-[0.04em] mix-blend-difference">
          {video.slug}
        </span>

        <span className="absolute right-2 bottom-2 rounded-[5px] bg-[rgba(14,17,22,.72)] px-1.5 py-[3px] font-mono text-[10px] leading-none font-medium text-white">
          {formatTime(video.durationSeconds)}
        </span>
      </div>

      <div className="flex flex-col gap-[3px]">
        <span className="group-hover:text-kf-blue text-[13.5px] leading-[1.3] font-medium tracking-[-0.01em]">
          {video.title}
        </span>
        <span className="text-kf-mut font-mono text-[11.5px] leading-[1.3]">
          {video.chapterCount > 0 ? `${video.chapterCount} poglavlja` : "bez poglavlja"}
        </span>
      </div>
    </Link>
  );
}
