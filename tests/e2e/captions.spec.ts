import { expect, test, type Page } from "@playwright/test";

/**
 * Kriterijum: "Captions can be toggled and render in sync".
 *
 * Cue uzet iz commit-ovanog public/media/captions/solar-eclipse.en.vtt.
 * Da se titl promeni, ovaj test pada — i to je namera: on je jedini dokaz da su
 * cue-ovi POKLOPLJENI sa zvukom, a ne samo da je staza ukljucena.
 */
const CUE = { atSeconds: 30, contains: "incredible mission" };

/** Sacekaj da metapodaci stignu — pre toga je `duration` 0 i seek ne radi. */
async function waitForMetadata(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video != null && video.duration > 0;
  });
}

/** Stanje nasih <track> staza, bez fantomskih CEA-608 koje hls.js ume da doda. */
async function captionTracks(page: Page) {
  return page.evaluate(() => {
    const video = document.querySelector("video");
    if (!video) return [];
    return Array.from(video.querySelectorAll("track")).map((el) => ({
      mode: el.track?.mode ?? null,
      kind: el.track?.kind ?? null,
      activeCues: Array.from(el.track?.activeCues ?? []).map((cue) =>
        "text" in cue ? String((cue as VTTCue).text) : "",
      ),
    }));
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/videos/solar-eclipse");
  await waitForMetadata(page);
});

test("CC dugme pali i gasi titlove", async ({ page }) => {
  const cc = page.getByRole("button", { name: "Titlovi", exact: true });

  await expect(cc).toBeEnabled();
  await expect(cc).toHaveAttribute("aria-pressed", "false");

  await cc.click();
  await expect(cc).toHaveAttribute("aria-pressed", "true");

  // Staza ostaje "hidden" i kad su titlovi UPALJENI: cue-ovi se parsiraju i
  // `activeCues` se puni, ali UA ne crta ništa — iscrtavanje je naše. Da je
  // "showing", Safari bi crtao i svoje, pa bi se titlovi videli dvaput.
  expect((await captionTracks(page))[0]).toMatchObject({ kind: "captions", mode: "hidden" });
  // Dokaz da su upaljeni je zato VIDLJIV DOM, ne mod staze.
  await expect(page.locator("[data-captions]")).toHaveAttribute("data-captions", "on");

  await cc.click();
  await expect(cc).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-captions]")).toHaveAttribute("data-captions", "off");
  await expect(page.locator(".kf-cue")).toHaveCount(0);
});

/**
 * Titl vise nije spreman odmah: preuzima se i konvertuje u browseru (SRT -> VTT),
 * pa je CC kontrola onemogucena dok staza ne postoji. Cekanje na `enabled` je
 * zato deo ugovora, ne zaobilazenje trke.
 */
async function enabledCaptionButton(page: Page) {
  const cc = page.getByRole("button", { name: "Titlovi", exact: true });
  await expect(cc).toBeEnabled();
  return cc;
}

test("cue se prikazuje na svom vremenu", async ({ page }) => {
  await (await enabledCaptionButton(page)).click();

  await page.evaluate((at) => {
    const video = document.querySelector("video");
    if (video) video.currentTime = at;
  }, CUE.atSeconds);

  // Tvrdnja je nad VIDLJIVIM DOM-om: `activeCues` bi dokazao samo da je staza
  // obrađena, a ne da se išta nacrtalo.
  await expect(page.locator("[data-captions]")).toContainText(CUE.contains);
});

test("prečica C radi isto što i dugme", async ({ page }) => {
  const cc = await enabledCaptionButton(page);

  await page.getByRole("region", { name: /^Plejer:/ }).focus();
  await page.keyboard.press("c");
  await expect(cc).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("c");
  await expect(cc).toHaveAttribute("aria-pressed", "false");
});
