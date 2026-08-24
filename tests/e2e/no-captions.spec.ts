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

  // Veličina titlova prati isto pravilo: bez staze nema šta da se podešava, pa
  // nije ni prazna kontrola ni suvišna stanica pri tabovanju.
  await expect(page.getByRole("combobox", { name: "Veličina titlova" })).toBeDisabled();
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
