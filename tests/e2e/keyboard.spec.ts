import { expect, test, type Page } from "@playwright/test";

/**
 * Kriterijumi: "Every control is reachable and operable by keyboard alone" i
 * "Focus is visible and never trapped".
 */

/** Pristupacno ime elementa koji trenutno drzi fokus. */
async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return "";
    return el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40) ?? el.tagName;
  });
}

async function waitForMetadata(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video != null && video.duration > 0;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/videos/solar-eclipse");
  await waitForMetadata(page);
  // Dok se titl ne preuzme i konvertuje, CC dugme je onemoguceno — a onemoguceno
  // dugme Tab preskace. Vidi src/components/player/use-subtitle-tracks.ts.
  await expect(page.getByRole("button", { name: "Titlovi", exact: true })).toBeEnabled();
});

test("sve kontrole se dosegnu Tabom", async ({ page }) => {
  await page.getByRole("region", { name: /^Plejer:/ }).focus();

  const seen: string[] = [];
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press("Tab");
    seen.push(await focusedName(page));
  }

  for (const expected of [
    "Traka za premotavanje",
    "Pusti",
    "Nazad 5 sekundi",
    "Napred 5 sekundi",
    "Utišaj zvuk",
    "Jačina zvuka",
    "Titlovi",
    "Podešavanja titlova",
    "Kvalitet",
    "Brzina reprodukcije",
    "Ceo ekran",
  ]) {
    expect(seen, `nedostupno Tabom: ${expected}`).toContain(expected);
  }
});

test("prečice menjaju stanje plejera", async ({ page }) => {
  const player = page.getByRole("region", { name: /^Plejer:/ });
  await player.focus();

  const paused = () => page.evaluate(() => document.querySelector("video")?.paused ?? null);
  const time = () => page.evaluate(() => document.querySelector("video")?.currentTime ?? -1);
  const muted = () => page.evaluate(() => document.querySelector("video")?.muted ?? null);

  await page.keyboard.press("Space");
  await expect.poll(paused).toBe(false);
  await page.keyboard.press("Space");
  await expect.poll(paused).toBe(true);

  const before = await time();
  await page.keyboard.press("ArrowRight");
  await expect.poll(time).toBeGreaterThan(before + 3);

  await page.keyboard.press("m");
  await expect.poll(muted).toBe(true);
});

test("fokus je vidljiv", async ({ page }) => {
  await page.getByRole("region", { name: /^Plejer:/ }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab"); // do play dugmeta

  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });

  expect(outline).not.toBeNull();
  expect(outline?.style).not.toBe("none");
  expect(outline?.width).not.toBe("0px");
});

test("fokus izlazi iz plejera i vraća se — nema zamke", async ({ page }) => {
  await page.getByRole("region", { name: /^Plejer:/ }).focus();

  // Dovoljno Tabova da se prodje ceo plejer i izadje iz njega.
  let escaped = false;
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press("Tab");
    const insidePlayer = await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[role="region"][aria-label^="Plejer:"]')),
    );
    if (!insidePlayer) {
      escaped = true;
      break;
    }
  }
  expect(escaped, "fokus je zarobljen u plejeru").toBe(true);

  // I unazad — Shift+Tab mora da vrati u plejer, pa iz njega napolje.
  let backOut = false;
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press("Shift+Tab");
    const insidePlayer = await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[role="region"][aria-label^="Plejer:"]')),
    );
    if (!insidePlayer) {
      backOut = true;
      break;
    }
  }
  expect(backOut, "Shift+Tab ne izlazi iz plejera").toBe(true);
});

/**
 * Regresija: kontrole su se ranije gasile samo kroz `opacity`, pa su ostajale
 * fokusabilne dok su nevidljive. Sada nose `inert`.
 */
test("sakrivene kontrole nisu dostupne Tabom", async ({ page }) => {
  const player = page.getByRole("region", { name: /^Plejer:/ });
  await player.focus();
  await page.keyboard.press("Space"); // pusti

  // Izmesti fokus iz plejera da auto-skrivanje uopste moze da se okine.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  const wrapper = page.locator("[data-visible]");
  await expect(wrapper).toHaveAttribute("data-visible", "false", { timeout: 10_000 });
  await expect(wrapper).toHaveAttribute("inert", "");
});

/**
 * Regresija: "f"/"m" nisu imali gard za polja, za razliku od svih ostalih
 * precica u istom switch-u. Konkretan slucaj koji je otkriven: <select> za
 * font u modalu za podesavanja titlova ima opciju "Monospejs" — "M" kao
 * type-ahead precica bi umesto toga utisala zvuk.
 */
test("'f' i 'm' se ne okidaju dok je fokus u modalu za podesavanja titlova", async ({ page }) => {
  await page.getByRole("button", { name: "Podešavanja titlova" }).click();

  const fontSelect = page.getByRole("combobox", { name: "Font titlova" });
  await fontSelect.focus();
  await page.keyboard.press("m");
  const muted = () => page.evaluate(() => document.querySelector("video")?.muted ?? null);
  await expect.poll(muted).toBe(false);

  const sizeSlider = page.getByRole("slider", { name: "Veličina fonta titlova" });
  await sizeSlider.focus();
  await page.keyboard.press("f");
  const fullscreen = () => page.evaluate(() => document.fullscreenElement != null);
  await expect.poll(fullscreen).toBe(false);
});

/**
 * Regresija: izlazak iz fullscreen-a nije vracao fokus, pa je korisnik
 * tastature posle Esc-a mogao da ostane na <body> i mora da tabuje od vrha
 * stranice. Headless Chromium podrzava pravi Fullscreen API SAMO iz
 * "trusted" korisnickog gesta — zato se ovde koristi stvaran `keyboard.press`,
 * ne `page.evaluate(() => el.requestFullscreen())`.
 */
test("fokus se vraca na plejer posle izlaska iz fullscreen-a", async ({ page }) => {
  const player = page.getByRole("region", { name: /^Plejer:/ });
  await player.focus();

  await page.keyboard.press("f");
  const isFullscreen = () => page.evaluate(() => document.fullscreenElement != null);
  await expect.poll(isFullscreen, { timeout: 5000 }).toBe(true);

  await page.keyboard.press("f");
  await expect.poll(isFullscreen).toBe(false);

  await expect(player).toBeFocused();
});
