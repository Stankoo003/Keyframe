import { expect, test } from "@playwright/test";

/**
 * Kriterijum: "A video with no subtitle track disables or hides the control
 * rather than offering a no-op toggle".
 *
 * clip-01-bars je sinteticka ffmpeg test-sara sa sinusnim tonom — u njoj nema
 * govora, pa namerno nema ni titlove. To je fixture za ovu stranu ponasanja,
 * ne propust u seed-u.
 */
test("bez titla je kontrola onemogućena, a ne prazan prekidač", async ({ page }) => {
  await page.goto("/videos/clip-01-bars");

  const cc = page.getByRole("button", { name: /^Titlovi/ });

  await expect(cc).toBeDisabled();
  // Ime mora da kaze ZASTO, inace korisnik zakljuci da plejer nema titlove uopste.
  await expect(cc).toHaveAccessibleName("Titlovi — nema titlova za ovaj snimak");

  // Onemoguceno dugme nije fokusabilno — prestaje da bude prazna stanica u tabovanju.
  await cc.evaluate((el) => el.focus());
  await expect(cc).not.toBeFocused();

  // Panel titlova NE prati isto pravilo, i to je namerno: u njemu stoji
  // učitavanje sopstvenog fajla, pa je snimak bez staza upravo slučaj u kom
  // mora da se otvori. Onemogućen bi zatvorio jedini put do svog titla.
  await expect(page.getByRole("button", { name: "Podešavanja titlova" })).toBeEnabled();
});

test("prečica C ne radi ništa kad nema titlova", async ({ page }) => {
  await page.goto("/videos/clip-01-bars");
  await page.getByRole("region", { name: /^Plejer:/ }).focus();
  await page.keyboard.press("c");

  await expect(page.getByRole("button", { name: /^Titlovi/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  const trackCount = await page.evaluate(
    () => document.querySelector("video")?.querySelectorAll("track").length ?? -1,
  );
  expect(trackCount).toBe(0);
});
