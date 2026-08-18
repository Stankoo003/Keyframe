import { MediaProbe } from "@/components/media-probe";
import { isUsingCdn, MEDIA_BASE_URL } from "@/lib/media";
import { prisma } from "@/server/db";
import { getPublishedVideos } from "@/server/videos";

// Prikazuje zivo stanje baze — ne sme da se prerenderuje u build-u.
export const dynamic = "force-dynamic";

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

// Server Component: cita bazu direktno, bez API poziva.
export default async function Home() {
  let dbStatus: "up" | "down" = "down";
  let videos: Awaited<ReturnType<typeof getPublishedVideos>> = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    videos = await getPublishedVideos();
    dbStatus = "up";
  } catch (error) {
    console.error("[home] citanje iz baze nije uspelo:", error);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Keyframe</h1>

        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <dt className="text-gray-500 dark:text-gray-400">Baza</dt>
            <dd
              className={
                dbStatus === "up"
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }
            >
              {dbStatus === "up" ? "povezana" : "nedostupna"}
            </dd>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <dt className="shrink-0 text-gray-500 dark:text-gray-400">Media</dt>
            <dd className="truncate font-mono text-xs">
              {isUsingCdn ? MEDIA_BASE_URL : "lokalno iz public/media"}
            </dd>
          </div>
        </dl>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Videi iz baze ({videos.length})
        </h2>

        {videos.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nema objavljenih videa. Pokreni{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-800">
              npm run db:seed
            </code>
            .
          </p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2">
            {videos.map((video) => (
              <li
                key={video.id}
                className="flex flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
              >
                {video.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.posterUrl}
                    alt=""
                    width={640}
                    height={360}
                    className="aspect-video w-full bg-gray-100 object-cover dark:bg-gray-800"
                  />
                )}

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-medium">{video.title}</h3>
                    <span className="shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {formatDuration(video.durationSeconds)}
                    </span>
                  </div>

                  {video.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{video.description}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {video.chapters.map((chapter) => (
                      <span
                        key={chapter.id}
                        title={chapter.title}
                        className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      >
                        {chapter.startSeconds}s
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-1 text-xs">
                    <MediaProbe url={video.manifestUrl} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="text-sm text-gray-500 dark:text-gray-400">
        Health endpoint:{" "}
        <a className="underline underline-offset-2" href="/api/health">
          /api/health
        </a>
      </footer>
    </main>
  );
}
