import { expect, test, type Page } from "@playwright/test";

/**
 * Kriterijum: "A video with an SRT subtitle file renders captions correctly
 * through the existing subtitles control".
 *
 * Cue uzet iz commit-ovanog public/media/captions/clip-03-fractal.sr.srt.
 * Test namerno ne dira nista specificno za SRT osim izvora — poenta je da se
 * SRT ponasa IDENTICNO kao VTT, kroz istu kontrolu i isti overlay.
 */
const CUE = { atSeconds: 13, contains: "Dubinski zum" };

async function waitForMetadata(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video != null && video.duration > 0;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/videos/clip-03-fractal");
  await waitForMetadata(page);
});

test("SRT titl je konvertovan i zakacen kao blob", async ({ page }) => {
  // `blob:` je dokaz da je fajl prosao kroz konverziju u browseru — da je
  // ostao originalni URL, browser bi dobio SRT koji ne ume da parsira.
  await expect
    .poll(async () =>
      page.evaluate(() => document.querySelector("video track")?.getAttribute("src") ?? ""),
    )
    .toMatch(/^blob:/);
});

test("cue iz SRT-a se prikazuje na svom vremenu", async ({ page }) => {
  const cc = page.getByRole("button", { name: "Titlovi", exact: true });
  await expect(cc).toBeEnabled();
  await cc.click();

  await page.evaluate((at) => {
    const video = document.querySelector("video");
    if (video) video.currentTime = at;
  }, CUE.atSeconds);

  await expect(page.locator("[data-captions]")).toContainText(CUE.contains);
});
