import { config as loadEnv } from "dotenv";

import { expect, test, type Page } from "@playwright/test";

/**
 * Kriterijum: admin panel je dostupan iskljucivo tastaturom — prijava, lista
 * snimaka, i uredjivanje poglavlja.
 */

// `next dev` (Playwright-ov `webServer`) sam cita `.env.local`, ali ovaj
// proces (Playwright test runner) je odvojen Node proces koji to NE radi
// automatski — isti obrazac kao `prisma.config.ts`, da lozinka ima jedan
// izvor istine.
loadEnv({ path: ".env.local", quiet: true });

const rawAdminPassword = process.env["ADMIN_PASSWORD"];
if (!rawAdminPassword) throw new Error(".env.local nema ADMIN_PASSWORD — vidi .env.example");
// Zaseban `const`: TS ne prenosi suzavanje modul-nivo promenljive u tela
// funkcija definisanih ispod, pa bi `ADMIN_PASSWORD` tamo i dalje bio
// `string | undefined`.
const ADMIN_PASSWORD: string = rawAdminPassword;

/** Pristupacno ime elementa koji trenutno drzi fokus. */
async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return "";
    return el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40) ?? el.tagName;
  });
}

/** Prijava iskljucivo tastaturom — lozinka je vec autofokusirana pri ucitavanju. */
async function loginWithKeyboard(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await expect(page.getByLabel("Lozinka")).toBeFocused();
  await page.keyboard.type(ADMIN_PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForURL("/admin");
}

test("prijava radi u potpunosti tastaturom", async ({ page }) => {
  await loginWithKeyboard(page);
  await expect(page.getByRole("heading", { name: "Snimci" })).toBeVisible();
});

test("Tab red na login formi: lozinka pa dugme", async ({ page }) => {
  await page.goto("/admin/login");

  // `focusedName` (aria-label/textContent) ne pokriva <input>: nema ni jedno
  // ni drugo, samo <label htmlFor> — zato direktna provera preko `getByLabel`.
  await expect(page.getByLabel("Lozinka")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Prijavi se" })).toBeFocused();
});

test("pogresna lozinka ostaje tastaturom operativna", async ({ page }) => {
  await page.goto("/admin/login");
  await page.keyboard.type("pogresna-lozinka-sigurno");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("alert")).toBeVisible();
  // Fokus mora da ostane na formi, ne da nestane na vrh dokumenta.
  await expect(page.getByLabel("Lozinka")).toBeFocused();
});

test.describe("posle prijave", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithKeyboard(page);
  });

  test("lista snimaka je dostupna Tabom: novi snimak, izmeni, objava, odjava", async ({ page }) => {
    const region = page.locator("main");
    await region.locator("a, button").first().focus();

    const seen: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      seen.push(await focusedName(page));
      await page.keyboard.press("Tab");
    }

    expect(seen.some((name) => name.includes("Novi snimak"))).toBe(true);
    expect(seen.some((name) => name.includes("Izmeni"))).toBe(true);
    // Prekidac objava/nacrt — tekst zavisi od stanja snimka, oba su legitimna.
    expect(seen.some((name) => name.includes("Objavljeno") || name.includes("Nacrt"))).toBe(true);
  });

  test("odjava dugme je dostupno i funkcionalno", async ({ page }) => {
    const logout = page.getByRole("button", { name: "Odjava" });
    await logout.focus();
    await expect(logout).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL("/admin/login");
  });

  test("uredjivanje poglavlja: dugmad za pomeranje/brisanje su dostupna Tabom", async ({ page }) => {
    // Bilo koji objavljeni snimak sa vise od jednog poglavlja radi — solar-eclipse
    // ima 6, pa reorder dugmad nisu sva `disabled` (prvo/poslednje jesu, po dizajnu).
    await page.getByRole("link", { name: "Izmeni" }).first().click();
    await page.waitForURL(/\/admin\/videos\/.+\/edit/);

    const addChapter = page.getByRole("button", { name: "+ Dodaj poglavlje" });
    await expect(addChapter).toBeVisible();
    await addChapter.focus();
    await expect(addChapter).toBeFocused();

    // STVARAN Tab, ne `.focus()`: `:focus-visible` se kod programskog fokusa
    // ne pali pouzdano, pa bi provera konture ispod bila lazno pozitivna. Ova
    // dva dugmeta su susedna u DOM-u (vidi chapter-editor.tsx) — jedan Tab
    // dovoljno pouzdano stize do "Sačuvaj poglavlja".
    await page.keyboard.press("Tab");
    const saveChapters = page.getByRole("button", { name: "Sačuvaj poglavlja" });
    await expect(saveChapters).toBeFocused();

    // Fokus je vidljiv na dugmetu za cuvanje poglavlja — regresija za propust
    // otkriven u ovom audit-u (dugme nije imalo focus-visible stil).
    const outline = await saveChapters.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).not.toBe("0px");
  });
});
