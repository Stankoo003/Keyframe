import { config as loadEnv } from "dotenv";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Kriterijum: "an automated a11y check passes". */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Vidi isto ucitavanje i obrazlozenje u admin-keyboard.spec.ts.
loadEnv({ path: ".env.local", quiet: true });

const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"];
if (!ADMIN_PASSWORD) throw new Error(".env.local nema ADMIN_PASSWORD — vidi .env.example");

async function waitForMetadata(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video != null && video.duration > 0;
  });
}

test("browse strana nema axe prekršaje", async ({ page }) => {
  await page.goto("/");
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations).toEqual([]);
});

test("detalj sa titlovima nema axe prekršaje", async ({ page }) => {
  await page.goto("/videos/solar-eclipse");
  await waitForMetadata(page);

  // Ugaseni titlovi.
  let result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(result.violations).toEqual([]);

  // Upaljeni — cue-ovi menjaju DOM i kontrastnu povrsinu, pa se proverava opet.
  await page.getByRole("button", { name: "Titlovi", exact: true }).click();
  result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(result.violations).toEqual([]);
});

test("detalj bez titlova nema axe prekršaje", async ({ page }) => {
  await page.goto("/videos/clip-01-bars");

  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG)
    // `video-caption` trazi <track kind="captions"> na svakom <video>. Ovde puca
    // PO DIZAJNU: clip-01-bars je ffmpeg test-sara sa sinusnim tonom, u njoj
    // nema govora koji bi se titlovao. Pravilo se gasi samo ovde i samo zato —
    // na strani sa pravim snimkom ostaje ukljuceno.
    .disableRules(["video-caption"])
    .analyze();

  expect(violations).toEqual([]);
});

test("admin login nema axe prekršaje", async ({ page }) => {
  await page.goto("/admin/login");
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations).toEqual([]);
});

test("admin panel (prijavljen) nema axe prekršaje", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Lozinka").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await page.waitForURL("/admin");

  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations).toEqual([]);
});
