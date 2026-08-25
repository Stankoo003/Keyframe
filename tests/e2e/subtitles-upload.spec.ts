import { expect, test, type Page } from "@playwright/test";

/**
 * Kriterijum: gledalac moze da ucita SVOJ titl u plejer, bez servera.
 *
 * Fixture je clip-01-bars — snimak koji NEMA titlove (vidi no-captions.spec.ts).
 * To je i poenta: kontrola za ucitavanje mora da radi bas tamo gde su ostale
 * kontrole za titlove onemogucene.
 *
 * Fajl koji se ucitava je commit-ovan `clip-03-fractal.sr.srt`; njegov poslednji
 * cue je na 19.8s, a clip-01-bars traje 24s, pa `srtToVtt` nema sta da odseca.
 */
const SRT = "public/media/captions/clip-03-fractal.sr.srt";
const CUE = { atSeconds: 13, contains: "Dubinski zum" };

const uploadInput = (page: Page) => page.getByLabel("Titl fajl sa računara");
const ccButton = (page: Page) => page.getByRole("button", { name: /^Titlovi/ });

async function waitForMetadata(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video != null && video.duration > 0;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/videos/clip-01-bars");
  await waitForMetadata(page);
});

test("dugme za učitavanje radi i kad snimak nema titlove", async ({ page }) => {
  // Ostale kontrole za titlove su onemogucene — to je postojece ponasanje.
  await expect(ccButton(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Podešavanja titlova" })).toBeDisabled();

  // Ova NIJE: bez nje se korisnikov titl ne bi imao odakle ucitati.
  await expect(page.getByRole("button", { name: "Učitaj svoj titl" })).toBeEnabled();
});

test("učitan SRT se konvertuje u blob i odmah se pali", async ({ page }) => {
  await uploadInput(page).setInputFiles(SRT);

  // `blob:` je dokaz da je fajl prosao kroz konverziju u browseru — isti put
  // kojim idu i titlovi sa mreze (vidi subtitles-srt.spec.ts).
  await expect
    .poll(async () =>
      page.evaluate(() => document.querySelector("video track")?.getAttribute("src") ?? ""),
    )
    .toMatch(/^blob:/);

  // Ucitavanje fajla je nedvosmislena namera da se titl gleda — pa se pali sam.
  await expect(ccButton(page)).toBeEnabled();
  await expect(ccButton(page)).toHaveAttribute("aria-pressed", "true");

  await page.evaluate((at) => {
    const video = document.querySelector("video");
    if (video) video.currentTime = at;
  }, CUE.atSeconds);

  await expect(page.locator("[data-captions]")).toContainText(CUE.contains);
});

test("uklanjanje vraća plejer u stanje bez titlova", async ({ page }) => {
  await uploadInput(page).setInputFiles(SRT);
  await expect(ccButton(page)).toBeEnabled();

  await page.getByRole("button", { name: "Ukloni moj titl" }).click();

  await expect(ccButton(page)).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.querySelector("video")?.querySelectorAll("track").length ?? -1,
    ),
  ).toBe(0);
});

test("neispravan fajl daje poruku, a plejer nastavlja da radi", async ({ page }) => {
  await uploadInput(page).setInputFiles({
    name: "smece.srt",
    mimeType: "text/plain",
    // Ni WEBVTT potpis ni SRT timing linija — `detectSubtitleFormat` baca.
    buffer: Buffer.from("ovo nije titl, samo obican tekst\n"),
  });

  await expect(page.getByRole("status").filter({ hasText: "Fajl nije prepoznat" })).toBeVisible();

  // Neuspeh je NEFATALAN: nema staze, ali plejer nije zamenjen porukom o gresci.
  await expect(ccButton(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Pusti" })).toBeVisible();
});

test("kad postoje dva titla, lista nudi izbor i vraćanje na zvanični", async ({ page }) => {
  await page.goto("/videos/clip-03-fractal");
  await waitForMetadata(page);

  // Sa jednom stazom lista ne postoji — CC dugme je tad dovoljno.
  await expect(page.getByRole("combobox", { name: "Izbor titla" })).toHaveCount(0);

  await uploadInput(page).setInputFiles(SRT);

  const select = page.getByRole("combobox", { name: "Izbor titla" });
  await expect(select).toBeVisible();
  // Ucitan titl je poslednji u listi i vec je izabran.
  await expect(select).toHaveValue("1");

  await select.selectOption("0");
  await expect(select).toHaveValue("0");
  await expect(page.locator("[data-captions]")).toBeVisible();
});
