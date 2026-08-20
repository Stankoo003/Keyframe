/**
 * Provera preduslova pre nego sto se ijedan test pokrene.
 *
 * Migracije se NAMERNO ne pokrecu odavde: test skup koji sam prepravlja dev
 * bazu je neprijatno iznenadjenje. Umesto toga se samo proveri da su podaci tu
 * i kaze sta da se pokrene ako nisu.
 */
async function globalSetup(): Promise<void> {
  const base = "http://localhost:3000";

  const response = await fetch(`${base}/api/videos/solar-eclipse`);
  if (!response.ok) {
    throw new Error(
      `Baza nije spremna (GET /api/videos/solar-eclipse → ${response.status}).\n` +
        "Pokreni: npm run db:up && npm run db:deploy && npm run db:seed",
    );
  }

  const video = (await response.json()) as { subtitles?: unknown[] };
  if (!video.subtitles || video.subtitles.length === 0) {
    throw new Error("solar-eclipse nema titlove — seed je star. Pokreni: npm run db:seed");
  }
}

export default globalSetup;
