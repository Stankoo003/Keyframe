import { expect, test, type Page } from "@playwright/test";

/**
 * Modal za podesavanja izgleda titlova — prvi modal u app-u, pa i prvo mesto
 * gde se testira fokus-zamka.
 */

async function waitForMetadata(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video != null && video.duration > 0;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/videos/solar-eclipse");
  await waitForMetadata(page);
  // Titl se preuzima i konvertuje u browseru — dugme je onemoguceno dok staza
  // ne postoji.
  await expect(page.getByRole("button", { name: "Podešavanja titlova" })).toBeEnabled();
});

test("otvara se sa Enter/Space i fokus ulazi u modal", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Podešavanja titlova" });
  await trigger.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Podešavanja titlova" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).toHaveCount(1);
});

test("Tab kruzi unutar modala, Esc zatvara i vraca fokus na dugme", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Podešavanja titlova" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Podešavanja titlova" });
  await expect(dialog).toBeVisible();

  // Shift+Tab sa prvog fokusiranog elementa mora da odskoci na POSLEDNJI
  // fokusabilni u modalu, ne van njega.
  await page.keyboard.press("Shift+Tab");
  const afterShiftTab = await dialog.evaluate(
    (el) => document.activeElement != null && el.contains(document.activeElement),
  );
  expect(afterShiftTab).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("klik na pozadinu zatvara modal", async ({ page }) => {
  await page.getByRole("button", { name: "Podešavanja titlova" }).click();
  const dialog = page.getByRole("dialog", { name: "Podešavanja titlova" });
  await expect(dialog).toBeVisible();

  // Klik u ugao SAMOG omotaca (backdrop), ne apsolutna koordinata viewport-a:
  // omotac je `absolute inset-0` u odnosu na kontejner plejera, koji ne pocinje
  // nuzno na (0,0) stranice — apsolutna koordinata bi lako promasila i sletela
  // van plejera. Pozicija (4,4) unutar omotaca je van centriranog panela.
  const backdrop = dialog.locator("xpath=..");
  await backdrop.click({ position: { x: 4, y: 4 } });
  await expect(dialog).not.toBeVisible();
});

test("kontrole se ne sakrivaju dok je modal otvoren", async ({ page }) => {
  await page.getByRole("button", { name: "Pusti" }).click();
  await page.getByRole("button", { name: "Podešavanja titlova" }).click();

  const controlsWrapper = page.locator("[data-visible]");
  // Malo duze od CONTROLS_HIDE_MS (3s) — bez suzbijanja bi se do sada sakrile.
  await page.waitForTimeout(3500);
  await expect(controlsWrapper).toHaveAttribute("data-visible", "true");
});

test("„Podrazumevano“ vraca sve na default vrednosti", async ({ page }) => {
  await page.getByRole("button", { name: "Podešavanja titlova" }).click();

  const sizeSlider = page.getByRole("slider", { name: "Veličina fonta titlova" });
  await sizeSlider.focus();
  await sizeSlider.press("End");
  await expect(sizeSlider).toHaveValue("200");

  await page.getByRole("button", { name: "Podrazumevano" }).click();
  await expect(sizeSlider).toHaveValue("100");
});

test("providnost pozadine se pamti posle osvezavanja", async ({ page }) => {
  await page.getByRole("button", { name: "Podešavanja titlova" }).click();

  const bgOpacity = page.getByRole("slider", { name: "Boja pozadine — providnost" });
  await bgOpacity.focus();
  await bgOpacity.press("Home"); // 0 = potpuno providno
  await expect(bgOpacity).toHaveValue("0");

  await page.reload();
  await waitForMetadata(page);
  await page.getByRole("button", { name: "Podešavanja titlova" }).click();
  await expect(page.getByRole("slider", { name: "Boja pozadine — providnost" })).toHaveValue("0");
});
