import { expect, test, type Page } from "@playwright/test";

/**
 * Veličina titlova + strukturna invarijanta koja pokriva Safari fullscreen bug.
 */

/** Cue iz commit-ovanog .vtt fajla — vidi captions.spec.ts. */
const CUE_AT_SECONDS = 30;

async function waitForMetadata(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video != null && video.duration > 0;
  });
}

async function showCaptionsAtCue(page: Page): Promise<void> {
  await page.goto("/videos/solar-eclipse");
  await waitForMetadata(page);
  // Titl se preuzima i konvertuje u browseru, pa je CC kontrola onemogucena dok
  // staza ne postoji — vidi src/components/player/use-subtitle-tracks.ts.
  const cc = page.getByRole("button", { name: "Titlovi", exact: true });
  await expect(cc).toBeEnabled();
  await cc.click();
  await page.evaluate((at) => {
    const video = document.querySelector("video");
    if (video) video.currentTime = at;
  }, CUE_AT_SECONDS);
}

test("veličina menja iscrtane titlove i pamti se", async ({ page }) => {
  await showCaptionsAtCue(page);

  const cue = page.locator(".kf-cue").first();
  await expect(cue).toBeVisible();

  const fontSize = () => cue.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const before = await fontSize();

  await page.getByRole("combobox", { name: "Veličina titlova" }).selectOption("1.6");

  // Tvrdi se ODNOS, ne apsolutan broj: apsolutna veličina zavisi od širine
  // viewport-a Playwright profila, pa bi tvrd broj bio krt.
  await expect.poll(fontSize).toBeGreaterThan(before * 1.4);

  // Veličina titlova je podešavanje pristupačnosti — mora preživeti osvežavanje.
  await page.reload();
  await waitForMetadata(page);
  await expect(page.getByRole("combobox", { name: "Veličina titlova" })).toHaveValue("1.6");
});

/**
 * Ovo je ceo popravak Safari fullscreen bug-a, izražen kao tvrdnja.
 *
 * Fullscreen se automatski ne može dokazati: headless Chromium nema pravi ekran,
 * a i da radi — dokazivao bi Chromium, dok je bug u WebKitu. Ono što se MOŽE
 * dokazati jeste invarijanta iz koje popravka sledi: sloj sa titlovima je DOM
 * potomak elementa nad kojim se zove `requestFullscreen`. Dok je to tačno,
 * njegov containing block JESTE fullscreen kutija i titlovi ne mogu da nestanu.
 *
 * Prava provera u Safariju je ručna — vidi "Testovi" u README-u.
 */
test("titlovi su unutar elementa koji ide u fullscreen", async ({ page }) => {
  await showCaptionsAtCue(page);

  const contained = await page.evaluate(() => {
    const region = document.querySelector('[role="region"][aria-label^="Plejer:"]');
    const captions = document.querySelector("[data-captions]");
    return Boolean(region && captions && region.contains(captions));
  });

  expect(contained).toBe(true);
});

/**
 * Sloj sa titlovima prekriva celu sliku. Bez `pointer-events-none` bi progutao
 * klik na video i prevlačenje seek klizača — a to nijedan drugi test ne bi
 * uhvatio, jer svi ostali klikću po dugmadima.
 */
test("titlovi ne presreću klik na sliku", async ({ page }) => {
  await showCaptionsAtCue(page);
  await expect(page.locator(".kf-cue").first()).toBeVisible();

  const paused = () => page.evaluate(() => document.querySelector("video")?.paused ?? null);
  const before = await paused();

  // Sredina slike — tačno preko sloja sa titlovima.
  await page.locator("video").click({ position: { x: 200, y: 100 } });
  await expect.poll(paused).toBe(!before);
});
