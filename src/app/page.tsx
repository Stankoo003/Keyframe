import { MediaProbe } from "@/components/media-probe";
import { CLIPS } from "@/domain/clips";
import { isUsingCdn, masterPlaylistUrl, MEDIA_BASE_URL } from "@/lib/media";
import { prisma } from "@/server/db";

// Prikazuje zivo stanje baze — ne sme da se prerenderuje u build-u.
export const dynamic = "force-dynamic";

// Server Component: cita bazu direktno, bez API poziva.
export default async function Home() {
  let dbStatus: "up" | "down" = "down";
  let userCount = 0;

  try {
    userCount = await prisma.user.count();
    dbStatus = "up";
  } catch (error) {
    console.error("[home] konekcija ka bazi nije uspela:", error);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 p-8">
      <h1 className="text-3xl font-semibold">Keyframe</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-gray-500">Infrastruktura</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">Baza</dt>
          <dd className={dbStatus === "up" ? "text-green-600" : "text-red-600"}>
            {dbStatus === "up" ? "povezana" : "nedostupna"}
          </dd>

          <dt className="text-gray-500">Korisnika</dt>
          <dd>{userCount}</dd>

          <dt className="text-gray-500">Media</dt>
          <dd className="break-all">{isUsingCdn ? MEDIA_BASE_URL : "lokalno iz public/media"}</dd>
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-gray-500">Klipovi</h2>
        <ul className="flex flex-col gap-3 text-sm">
          {CLIPS.map((clip) => (
            <li key={clip.slug} className="flex flex-col gap-1">
              <span className="font-medium">
                {clip.title}{" "}
                <span className="font-normal text-gray-500">· {clip.durationSeconds}s</span>
              </span>
              <MediaProbe url={masterPlaylistUrl(clip.slug)} />
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-gray-500">
        Health endpoint:{" "}
        <a className="underline" href="/api/health">
          /api/health
        </a>
      </p>
    </main>
  );
}
