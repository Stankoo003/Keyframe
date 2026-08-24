import { config as loadEnv } from "dotenv";

/**
 * Lighthouse accessibility provera — dopuna axe-u (`tests/e2e/a11y.spec.ts`).
 *
 * Zasto oba: axe je pravilo-po-pravilo DOM provera koju vec pokrecemo po
 * stranici u Playwright-u; Lighthouse dodaje SVOJ nezavisan skup a11y audita
 * (drugaciji motor, delimicno preklapajuca ali ne identicna pravila) i jedan
 * brojcani rezultat po stranici — tacno ono sto zahtev trazi imenom.
 *
 * `lighthouse`/`chrome-launcher` su dinamicki uvezeni: `lighthouse` je
 * cisto-ESM paket, a ovaj fajl se pokrece kroz `tsx` bez `"type": "module"`
 * u package.json (isti razlog zasto `prisma/seed.ts` ne koristi top-level
 * await) — dinamicki `import()` radi u oba slucaja, staticki ESM-only import
 * ne bi.
 *
 * Server MORA vec da radi (`npm run dev` u drugom terminalu) — isti rucni
 * obrazac kao Playwright-ov `webServer.reuseExistingServer`, bez novog koda
 * za upravljanje procesom.
 */

loadEnv({ path: ".env.local", quiet: true });

const BASE_URL = "http://localhost:3000";

type Route = { path: string; label: string; authenticated?: boolean };

const ROUTES: Route[] = [
  { path: "/", label: "Katalog" },
  { path: "/videos/solar-eclipse", label: "Detalj + plejer" },
  { path: "/admin/login", label: "Admin prijava" },
  { path: "/admin", label: "Admin panel (prijavljen)", authenticated: true },
];

async function main(): Promise<void> {
  const { default: lighthouse } = await import("lighthouse");
  const chromeLauncher = await import("chrome-launcher");
  // Uvezeno OVDE, ne staticki na vrhu fajla: `env.ts` puca odmah pri uvozu
  // ako obavezna varijabla fali (vidi taj fajl), a staticki import bi se
  // izvrsio PRE `loadEnv()` iznad — redosled bi bio pogresan tacno onda kad
  // je najbitniji.
  const { env } = await import("../src/lib/env");
  const { signSession, ADMIN_SESSION_COOKIE } = await import("../src/server/auth/session");

  const response = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  if (!response?.ok) {
    console.error(`Server ne odgovara na ${BASE_URL} — pokreni "npm run dev" u drugom terminalu.`);
    process.exit(1);
  }

  const sessionCookie = await signSession(env.AUTH_SESSION_SECRET);

  const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new"] });
  let anyFailed = false;

  try {
    for (const route of ROUTES) {
      const url = `${BASE_URL}${route.path}`;

      const result = await lighthouse(url, {
        port: chrome.port,
        onlyCategories: ["accessibility"],
        logLevel: "error",
        ...(route.authenticated
          ? { extraHeaders: { Cookie: `${ADMIN_SESSION_COOKIE}=${sessionCookie}` } }
          : {}),
      });

      if (!result) {
        console.error(`✗ ${route.label} (${url}) — Lighthouse nije vratio rezultat`);
        anyFailed = true;
        continue;
      }

      const category = result.lhr.categories.accessibility;
      if (!category) {
        console.error(`✗ ${route.label} (${url}) — Lighthouse nije vratio accessibility kategoriju`);
        anyFailed = true;
        continue;
      }

      const score = category.score ?? 0;
      const ok = score === 1;
      if (!ok) anyFailed = true;

      console.log(`${ok ? "✓" : "✗"} ${route.label} (${route.path}) — accessibility ${Math.round(score * 100)}`);

      if (!ok) {
        // Svaki neuspeo audit je "mora da se popravi" — Lighthouse-ova a11y
        // kategorija nema informativnih/opcionih audita kao Performance ili
        // Best Practices, sve je WCAG-izvedeno.
        for (const [id, audit] of Object.entries(result.lhr.audits)) {
          if (audit.score !== null && audit.score < 1 && category.auditRefs.some((ref) => ref.id === id)) {
            console.log(`    ✗ ${id}: ${audit.title}`);
          }
        }
      }
    }
  } finally {
    await chrome.kill();
  }

  if (anyFailed) {
    console.error("\nLighthouse accessibility provera nije prošla — vidi audite iznad.");
    process.exit(1);
  }

  console.log("\nSvi rezultati accessibility 100.");
}

void main();
