import { expect, test, type Page } from "@playwright/test";

/**
 * Kriterijum: hover po seek traci pokazuje sličicu tog trenutka.
 *
 * Klip `clip-02-motion` je izabran jer ga `npm run media:build` uvek proizvede
 * sa `thumbs.jpg`/`thumbs.vtt` (vidi `scripts/encode.sh`), pa test ne zavisi od
 * rucno pripremljenih fajlova.
 */

/** Sacekaj metapodatke — pre toga je `duration` 0 i traka nema sirinu u vremenu. */
async function waitForMetadata(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video != null && video.duration > 0;
  });
}

const seekBar = (page: Page) => page.getByRole("slider", { name: "Traka za premotavanje" });

/** Kartica je `aria-hidden`, pa se do nje ne moze preko role — otuda CSS. */
const preview = (page: Page) => page.locator("[data-testid='thumbnail-preview']");

test.beforeEach(async ({ page }) => {
  // Cekanje se postavlja PRE `goto`: fetch mape sličica krece cim se plejer
  // montira, pa bi registracija posle navigacije lako promasila odgovor.
  const thumbs = page.waitForResponse((response) => response.url().endsWith("thumbs.vtt"));

  await page.goto("/videos/clip-02-motion");
  const response = await thumbs;
  await waitForMetadata(page);

  /*
   * Sličice nastaju u `npm run media:build` i, kad je NEXT_PUBLIC_MEDIA_BASE_URL
   * postavljen, moraju jos i da odu na CDN (`npm run media:sync`). Dok ih nema,
   * plejer namerno radi bez preview-a — pa ovaj test nema sta da tvrdi.
   * Izricit skip sa razlogom je posteniji od crvenog testa koji ne govori sta
   * treba pokrenuti.
   */
  test.skip(
    !response.ok(),
    `${response.url()} → ${response.status()}. Pokreni: npm run media:build (+ npm run media:sync ako se koristi CDN).`,
  );
});

test("hover po traci pokazuje slicicu i vreme", async ({ page }) => {
  const box = await seekBar(page).boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);

  await expect(preview(page)).toBeVisible();
  // Klip traje 28s, pa je sredina ~14s. Tolerancija zbog zaokruzivanja pozicije.
  await expect(preview(page)).toContainText(/0:1[2-6]/);
});

test("isecak sprite-a se pomera duz trake", async ({ page }) => {
  const box = await seekBar(page).boundingBox();
  const sprite = preview(page).locator("[data-testid='thumbnail-image']");

  await page.mouse.move(box!.x + box!.width * 0.05, box!.y + box!.height / 2);
  const atStart = await sprite.evaluate((el) => getComputedStyle(el).backgroundPosition);

  await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height / 2);
  const atEnd = await sprite.evaluate((el) => getComputedStyle(el).backgroundPosition);

  // Razlicit isecak = zaista se cita drugi cue, a ne uvek prvi.
  expect(atEnd).not.toBe(atStart);
  expect(atStart).toBe("0px 0px");
});

test("kartica nestaje kad mis napusti traku", async ({ page }) => {
  const box = await seekBar(page).boundingBox();

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(preview(page)).toBeVisible();

  await page.mouse.move(box!.x + box!.width / 2, box!.y - 120);
  await expect(preview(page)).toHaveCount(0);
});

test("preview ne prekida prevlacenje po traci", async ({ page }) => {
  const box = await seekBar(page).boundingBox();
  const video = page.locator("video");

  await page.mouse.move(box!.x + 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height / 2, { steps: 10 });
  await page.mouse.up();

  // Kartica je pointer-events-none; da nije, drag bi pukao na njenoj pojavi i
  // vreme bi ostalo na pocetku.
  await expect
    .poll(async () => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(10);
});

test("kartice poglavlja pokazuju kadar sa svog pocetka", async ({ page }) => {
  const thumbs = page.locator("[data-testid='chapter-thumbnail']");
  await expect(thumbs.first()).toBeVisible();

  const styles = await thumbs.evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return { image: style.backgroundImage, position: style.backgroundPosition };
    }),
  );

  expect(styles.length).toBeGreaterThan(1);
  // Sve kartice dele isti sprite...
  expect(new Set(styles.map((s) => s.image)).size).toBe(1);
  expect(styles[0]!.image).toContain("thumbs.jpg");
  // ...ali svaka gadja svoj isecak, inace bi sve prikazivale isti kadar.
  expect(new Set(styles.map((s) => s.position)).size).toBe(styles.length);
});
