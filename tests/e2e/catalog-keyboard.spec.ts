import { expect, test, type Page } from "@playwright/test";

/**
 * Kriterijum: katalog (naslovna) je dostupan iskljucivo tastaturom, sa
 * vidljivim fokusom — deo audit-a koji ranije nije pokrivan (postojeci
 * `keyboard.spec.ts` je pokrivao samo plejer).
 */

/**
 * Katalog je server komponenta koja strimuje sadrzaj (vidi `loading.tsx`
 * skelet) — `page.goto` se vraca cim stigne prvi bajt, ne cim stignu kartice.
 * Pod paralelnim opterecenjem to zna da potraje, pa se ceka na STVARAN
 * sadrzaj pre nego sto Tab-ovanje uopste pocne.
 */
async function waitForCatalog(page: Page): Promise<void> {
  await expect(page.locator('a[href^="/videos/"]').first()).toBeVisible();
}

test("logo i kartice snimaka su dostupni Tabom sa vidljivim fokusom", async ({ page }) => {
  await page.goto("/");
  await waitForCatalog(page);

  // Logo/pocetna veza je prvi fokusabilan element na strani.
  await page.keyboard.press("Tab");
  const logo = page.getByRole("link", { name: "Keyframe" });
  await expect(logo).toBeFocused();

  const outline = async () =>
    page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });

  const logoOutline = await outline();
  expect(logoOutline?.style).not.toBe("none");
  expect(logoOutline?.width).not.toBe("0px");

  // Bar jedna kartica snimka mora biti dostupna dalje u tab redosledu.
  let reachedCard = false;
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press("Tab");
    const isVideoLink = await page.evaluate(() =>
      Boolean(document.activeElement?.getAttribute("href")?.startsWith("/videos/")),
    );
    if (isVideoLink) {
      reachedCard = true;
      break;
    }
  }
  expect(reachedCard, "nijedna kartica snimka nije dostupna Tabom").toBe(true);

  const cardOutline = await outline();
  expect(cardOutline?.style).not.toBe("none");
  expect(cardOutline?.width).not.toBe("0px");
});

test("Enter na kartici snimka otvara detalj", async ({ page }) => {
  await page.goto("/");
  await waitForCatalog(page);

  await page.keyboard.press("Tab"); // logo
  await page.keyboard.press("Tab"); // prva kartica

  const href = await page.evaluate(() => document.activeElement?.getAttribute("href"));
  expect(href).toMatch(/^\/videos\//);

  await page.keyboard.press("Enter");
  await page.waitForURL(href!);
});
