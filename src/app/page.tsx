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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Keyframe</h1>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-gray-500">Baza</dt>
        <dd className={dbStatus === "up" ? "text-green-600" : "text-red-600"}>
          {dbStatus === "up" ? "povezana" : "nedostupna"}
        </dd>

        <dt className="text-gray-500">Korisnika</dt>
        <dd>{userCount}</dd>
      </dl>

      <p className="text-sm text-gray-500">
        Health endpoint:{" "}
        <a className="underline" href="/api/health">
          /api/health
        </a>
      </p>
    </main>
  );
}
