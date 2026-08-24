# Keyframe

Next.js (App Router) + TypeScript u strict modu, PostgreSQL preko Docker Compose-a, Prisma kao ORM.

## Preduslovi

- **Node.js 20+** (razvijano na 26)
- **Docker Desktop** (za lokalni PostgreSQL)

## Pokretanje lokalno

```bash
# 1. Instaliraj zavisnosti (postinstall automatski pokrece `prisma generate`)
npm install

# 2. Napravi lokalni env fajl
cp .env.example .env.local

# 3. Digni PostgreSQL (ceka dok kontejner ne bude healthy)
npm run db:up

# 4. Primeni migracije na bazu
npm run db:migrate

# 5. Napuni bazu klipovima
npm run db:seed

# 6. Startuj dev server
npm run dev
```

App radi na <http://localhost:3000>. Provera da lanac app → Prisma → Postgres radi:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","db":"up"}
```

## npm skripte

| Skripta                    | Šta radi                                                    |
| -------------------------- | ----------------------------------------------------------- |
| `npm run dev`              | Dev server (hot reload)                                     |
| `npm run build`            | Produkcijski build                                          |
| `npm start`                | Pokreće produkcijski build                                  |
| `npm run lint`             | ESLint                                                      |
| `npm run typecheck`        | `tsc --noEmit`                                              |
| `npm run format`           | Prettier — formatira sve                                    |
| `npm run db:up`            | Diže Postgres kontejner i čeka da bude healthy              |
| `npm run db:down`          | Gasi kontejner (podaci ostaju u volume-u)                   |
| `npm run db:reset`         | **Briše podatke**, diže bazu iznova i primenjuje migracije  |
| `npm run db:migrate`       | Kreira i primenjuje migraciju iz izmena u `schema.prisma`   |
| `npm run db:seed`          | Puni bazu enkodiranim klipovima (idempotentno)              |
| `npm run db:deploy`        | Primenjuje postojeće migracije (za CI/produkciju)           |
| `npm run db:generate`      | Regeneriše Prisma klijent                                   |
| `npm run db:studio`        | Prisma Studio — GUI nad bazom                               |
| `npm run media:build`      | Generiše izvorne klipove i enkodira sve u HLS               |
| `npm run media:clips`      | Samo izvorni klipovi → `media/source/`                      |
| `npm run media:encode:all` | Enkodira sve iz `media/source/` + verifikuje                |
| `npm run media:encode`     | Enkodira jedan fajl                                         |
| `npm run media:captions`   | Transkribuje zvuk klipa u sirov WebVTT (whisper)            |
| `npm run media:verify`     | Proverava HLS izlaz i keyframe alignment                    |
| `npm run media:sync`       | Šalje `public/media/hls` na Cloudflare R2                   |
| `npm run media:verify:cdn` | HEAD provera content-type-ova i CORS-a na CDN-u             |
| `npm run test:e2e`         | Playwright — titlovi, tastatura, axe provera pristupačnosti |
| `npm run test:e2e:ui`      | Isto, u Playwright UI režimu                                |
| `npm run test:a11y`        | Samo axe provera                                            |

## Environment

Konekcioni string živi u `.env.local`, koji **nije** u gitu. U repo ide samo `.env.example` sa placeholder vrednostima.

- Next.js sam učitava `.env.local`.
- Prisma CLI ga učitava kroz `prisma.config.ts` (`dotenv` sa eksplicitnom putanjom), pa je konekcija definisana na jednom mestu.

Default vrednosti odgovaraju servisu `db` iz [docker-compose.yml](docker-compose.yml): korisnik/lozinka/baza su svuda `keyframe`, port `5432`.

## Struktura

```
src/
├─ app/             # rute, layout-i, page-ovi (App Router)
│  ├─ page.tsx      # browse — mreža snimaka
│  ├─ videos/[slug]/ # detalj + loading / error / not-found
│  ├─ api/health/   # Route Handler koji proverava konekciju na bazu
│  └─ api/videos/   # katalog: lista + detalj
├─ components/      # prezentacione React komponente
│  ├─ site-header.tsx, video-card.tsx
│  ├─ chapter-list.tsx
│  └─ player/         # HLS plejer: engine, kontrole, sloj sa titlovima
│  └─ ui/           # generički, reusable elementi
├─ server/          # kod koji sme da radi samo na serveru
│  ├─ db.ts         # Prisma klijent (singleton)
│  ├─ videos.ts     # čitanje videa → DTO (jedino mesto sa `published: true`)
│  └─ actions/      # Server Actions
├─ domain/          # čisti tipovi i domenska logika, bez I/O
│  └─ video.ts      # DTO oblici koje API vraća
├─ lib/             # deljeni helperi
│  ├─ env.ts        # jedino mesto koje čita process.env
│  ├─ media.ts      # gradnja media URL-ova
│  ├─ format.ts     # formatiranje vremena
│  └─ api/          # zod šeme + oblik HTTP odgovora
└─ generated/       # Prisma klijent — generisan, nije u gitu

prisma/
├─ schema.prisma    # modeli
├─ seed.ts          # početni podaci
└─ migrations/      # istorija migracija (u gitu)

scripts/            # media pipeline (bash)
media/source/           # izvorni klipovi — generisano, nije u gitu
public/media/hls/       # HLS izlaz — generisano, nije u gitu
public/media/captions/  # .vtt titlovi — RUCNO pregledani, U GITU
tests/e2e/              # Playwright: titlovi, veličina, tastatura, axe
```

**Pravilo:** `app/` i `components/` nikad ne importuju Prismu direktno — pristup bazi ide isključivo kroz `src/server/`. `src/server/db.ts` je označen sa `server-only` pa build pukne ako se to prekrši.

## Stranice

| Ruta             | Sadržaj                                         |
| ---------------- | ----------------------------------------------- |
| `/`              | browse — mreža objavljenih snimaka sa posterima |
| `/videos/[slug]` | detalj — okvir plejera, opis, lista poglavlja   |

Izgled prati mockup **„Keyframe streaming UI mockups"** iz Claude Design-a, povučen kroz `DesignSync`.

### Dizajn tokeni

Sve boje su `--kf-*` promenljive u [src/app/globals.css](src/app/globals.css), preuzete doslovno iz `LIGHT` / `DARK` objekata u mockupu. Izložene su Tailwindu kroz `@theme inline`, pa se koriste kao `bg-kf-bg`, `text-kf-mut`, `border-kf-line`.

Pošto je `inline`, utility klasa pokazuje na promenljivu a ne na vrednost — **tamna tema radi sama**, kroz `prefers-color-scheme`, bez `dark:` prefiksa na svakoj klasi i bez JavaScripta.

### Server / klijent podela

**Tačno dva `use client` fajla**, oba `error.tsx`. To nije stvar ukusa: Next zahteva da error boundary bude klijentska komponenta, jer prima `reset()` i mora da hvata greške pri renderu na klijentu.

Sve ostalo — mreža, kartice, okvir plejera, poglavlja, skeletoni — je statički markup bez stanja, pa ostaje serverski. Podaci se čitaju direktno iz baze u Server Componentu; `/api/videos` postoji za spoljne potrošače i deli isti kod iz [src/server/videos.ts](src/server/videos.ts).

Provera:

```bash
grep -rl "use client" src   # mora vratiti tačno dva error.tsx fajla
```

### Stanja

| Fajl                                  | Kad se vidi                           |
| ------------------------------------- | ------------------------------------- |
| `src/app/loading.tsx`                 | skeleton mreža dok se katalog učitava |
| `src/app/error.tsx`                   | baza ne odgovara — `CATALOG 503`      |
| `src/app/videos/[slug]/loading.tsx`   | spinner u okviru plejera              |
| `src/app/videos/[slug]/error.tsx`     | `PLAYBACK 4102`                       |
| `src/app/videos/[slug]/not-found.tsx` | nepoznat ili neobjavljen slug         |

Stranice **ne hvataju greške u `try/catch`** — puštaju ih da propagiraju do `error.tsx`. Otkaz baze mora da bude vidljiv, ne da se pretvori u praznu stranicu.

Prazna stanja su zasebna: katalog bez snimaka i snimak bez poglavlja imaju svoje isprekidane kartice, ne prazan prostor.

Kako ih izazvati:

```bash
npm run db:down          # → error stanje na /
# DevTools → Network → Slow 3G   → loading stanja
```

### Plejer

Na detaljnoj stranici radi **pravi HLS plejer** ([src/components/player/](src/components/player/)) sa sopstvenim kontrolama.

### Engine

Puštanje je iza `PlaybackEngine` interfejsa, pa UI ne zna koji motor vozi:

| Browser                 | Engine                                         |
| ----------------------- | ---------------------------------------------- |
| Safari / iOS            | nativni HLS — bez biblioteke, hardverski dekod |
| Chrome / Firefox / Edge | `hls.js` preko MSE, učitan dinamički           |

Izbor je na jednom mestu, u [create-engine.ts](src/components/player/engine/create-engine.ts). Ručni izbor kvaliteta radi samo uz `hls.js` — nativni HLS ne izlaže listu nivoa, pa je selektor tada onemogućen.

### Kontrole

Play/pauza · nazad 5s · napred 5s · seek traka sa preuzetim opsezima · vreme · zvuk · titlovi · veličina titlova · kvalitet · brzina · fullscreen.

Prečice rade **samo kad je plejer fokusiran** (kontejner ima `tabIndex`): `Space`/`K` play, `←`/`→` ±5s, `↑`/`↓` zvuk, `F` fullscreen, `M` mute, `C` titlovi. Da slušaju na `document`, otimale bi space i strelice ostatku stranice.

**Interval preskakanja je definisan jednom**, u [constants.ts](src/components/player/constants.ts) — dugmad i strelice uvoze isti `SEEK_STEP_SECONDS`, pa ne mogu da se raziđu.

CC dugme je **onemogućeno kad snimak nema titl**, umesto sakriveno — isto kako se ponaša selektor kvaliteta kad engine ne izlaže ladder. Traka se tako ne prelama pri prelasku sa snimka na snimak, a korisnik nauči da titlova nema na _ovom_ snimku, a ne da ih plejer uopšte nema. Vidi [Titlovi](#titlovi).

### Dve stvari koje nisu očigledne

**Premotavanje staje `0.25s` pre kraja.** Skok na tačno `duration` nema uzorak u baferu, pa `hls.js` digne fatalnu `media error 4` i plejer ostane mrtav. Konstanta je `SEEK_END_EPSILON_SECONDS`.

**Brzo uzastopno preskakanje se sabira.** Osnova je poslednja _tražena_ pozicija, ne `video.currentTime` — dok seek traje, element još prijavljuje staru poziciju, pa bi pet brzih pritisaka sletelo na +5s umesto +25s.

Iz mockupa je izostavljeno ono za šta nemamo podatke: pretraga, filter pilule, godina, „Resume", grupisanje poglavlja po činovima. Lažni UI je gori od izostavljenog.

### Titlovi

Jedan snimak ima titl: `solar-eclipse`. Ostalih pet su sintetičke `ffmpeg` test-šare sa sinusnim tonom — u njima nema govora, pa **namerno** ostaju bez titla. To nije rupa u seed-u nego fixture: bez snimka bez titla ne bi imalo šta da dokaže da je CC kontrola pravilno onemogućena.

**Kako je nastao.** `whisper.cpp`, model `small.en`, zvuk povučen sa CDN-a iz 360p renditiona (audio je isti u svim renditionima, pa nema razloga skidati najveći video):

```bash
npm run media:captions -- solar-eclipse en
```

[scripts/make-captions.sh](scripts/make-captions.sh) piše **sirov** transkript u `$TMPDIR`, nikad direktno u repo. Mašinski transkript se ne isporučuje neproveren: whisper na tišini izmišlja rečenice, lomi vlastita imena i cepa fraze na deliće od 0.2 s koji bljesnu i ne stignu da se pročitaju. Kod ovog snimka je ručno ispravljeno: spojeni delići kraći od 0.4 s i vraćena imena `Léna`, `Turcat`, `Aérospatiale`, `zodiacal light`. Šta je dirano stoji u `NOTE` zaglavlju samog `.vtt` fajla.

**Zašto je `.vtt` u gitu, a ostatak `public/media/` nije.** Razlog za ignorisanje media foldera su stotine MB `.ts` segmenata koje skripte regenerišu determinističi. Titl je par KB teksta koji je čovek pročitao i ispravio — regenerisanje nije ni determinističko (whisper) ni besplatno (model od 460 MB), a svež klon bez njega ne bi mogao ni da pokaže funkcionalnost. Zato `.gitignore` ima izuzetak; negacija traži `/public/media/*` sa zvezdicom, jer git ne silazi u isključen direktorijum pa se u `/public/media/` sa kosom crtom ne može negirati.

**`kind="captions"`, ne `subtitles`.** Ovo je transkripcija govora na istom jeziku, a to je tačno razlika koju ta dva pojma nose. Uz to axe pravilo `video-caption` traži baš `captions`.

**`crossOrigin="anonymous"` na `<video>` je obavezan.** Media stiže sa R2, a WebVTT sa drugog origin-a browser čita **samo u CORS modu** — bez atributa se `.vtt` preuzme, ali cue-ovi ostanu prazni i u konzoli nema nijedne greške. Cena: atribut važi za _sve_ što element učitava, uključujući poster i — na nativnom (Safari) engine-u — sam `.m3u8`. Zato svaki origin sa kog se app servira mora stajati u R2 CORS pravilima, inače Safari prestane da pušta snimak.

**Titlove crtamo sami.** Staze stoje u `mode = "hidden"` — cue-ovi se parsiraju i `activeCues` se puni, ali browser ne iscrtava ništa; [caption-overlay.tsx](src/components/player/caption-overlay.tsx) sluša `cuechange` i renderuje tekst kao običan React DOM unutar okvira plejera.

Razlog nisu estetika nego dva konkretna kvara:

1. **U desktop Safariju titlovi su nestajali u fullscreen-u.** Fullscreen tražimo nad kontejner divom, a cue kutija živi u UA shadow stablu `<video>` elementa. Koji je tačno WebKit quirk kriv **nije utvrđeno** — kandidati su re-parenting pri element-fullscreen-u, dimenzionisanje shadow caption kontejnera, i prekalkulacija `snapToLines` uz negativan `line`. Popravka namerno ne zavisi od dijagnoze: sloj koji je DOM potomak elementa koji ide u fullscreen ne može da promaši fullscreen kutiju, po konstrukciji. Uklonjena je cela klasa kvarova, ne pogođena hipoteza.
2. **`::cue { font-size }` u Safariju nadjačaju sistemska podešavanja titlova**, a u fullscreen-u Safari sam preskalira cue-ove — pa se veličina nativno ne bi mogla ponuditi uopšte.

Cena: WebVTT tagovi (`<i>`, `<v Govornik>`) se skidaju i renderuje se čist tekst. Naš `.vtt` nema nijedan; skidanje je odbrambeno i drži nas dalje od `dangerouslySetInnerHTML`.

**Veličina titlova.** Množilac iz `<select>`-a (85 / 100 / 130 / 160%) se čuva u `localStorage` pod `keyframe:captions:v1` ([caption-prefs.ts](src/lib/caption-prefs.ts)) i ulazi u CSS kao `--kf-cc-scale`. Osnovna veličina je `clamp(15px, 2.6cqi, 56px)` — `cqi` je procenat širine same slike, pa titlovi rastu i sa plejerom i sa fullscreen-om **bez ijedne linije JS-a**; `vw` bi pratio prozor (plejer od 640px u prozoru od 1800px dobio bi pogrešnu veličinu), a `ResizeObserver` bi uveo re-render na svaki piksel. Množilac stoji **izvan** `clamp`-a: gornja granica čuva podrazumevani izgled na 4K, ali ne sme da poništi izbor „160%".

Preferencija se čita kroz `useSyncExternalStore`, ne kroz lazy `useState` initializer. Razlika u odnosu na zapamćenu poziciju gledanja: tamo je prikaz vezan za `state.ready`, koje je pri hidrataciji `false`, pa i server i klijent renderuju `null`. Ovde tog izlaza nema — `<select>` i inline promenljiva postoje već u prvom renderu, a server nema `localStorage`. `getServerSnapshot` postoji tačno zbog toga.

**Poznato ograničenje:** ponuda za nastavak gledanja (`z-20`) stoji preko pojasa sa titlovima (`z-10`). Živi 8 sekundi, preklapanje je kozmetičko i nije vredno dodatne mašinerije.

**Poznato ograničenje:** **iOS nativni fullscreen nema titlove.** Na iPhone-u video ulazi u fullscreen kroz `webkitEnterFullscreen`, gde je slika van našeg DOM-a i naš sloj ne može da je prati; pošto nijedna staza nije `"showing"`, ni browser nema šta da nacrta. Praktično je nedostižno — `<video>` je `playsInline` i bez nativnih kontrola, pa korisnik nema čime da uđe — ali je stanje koje treba znati. Rešenje kad zatreba: privremeno vratiti stazu na `"showing"` na `webkitbeginfullscreen`, pa nazad na `webkitendfullscreen`.

### Pristupačnost

**Živi region.** Sve kontrole su custom, pa čitač ekrana sam po sebi ne kaže ništa kad korisnik pritisne razmak — nativni plejer bi rekao. Zato postoji jedan `role="status" aria-live="polite"` region, koji se objavljuje **samo iz namere korisnika**: play/pauza, kraj premotavanja, zvuk, titlovi, veličina titlova, brzina. Iz `timeupdate` se **ne** objavljuje ništa — to bi pretvorilo čitač u neprekidan monolog. Pozicija se odlaže 600 ms, pa držanje strelice daje jednu završnu objavu umesto dvadeset isprekidanih. Prevlačenje klizača ne učestvuje: njega već pokriva `aria-valuetext`, pa bi objava bila duplikat.

Veličina titlova se objavljuje **iz svog handlera**, a ne praćenjem stanja kao ostale. Ostala stanja stižu iz više izvora (dugme, prečica, događaj sa elementa) pa se moraju pratiti kroz stanje; veličina ima tačno jedan izvor. Uz to bi praćenje stanja objavilo i promenu koju napravi prvo čitanje iz `localStorage` — pa bi plejer pri svakom učitavanju stranice rekao „Veličina titlova 130%", objavu koju korisnik nije izazvao.

**`aria-pressed` ide na prekidače, ali ne na play.** Mute, titlovi i fullscreen su pravi on/off prekidači i nose stalnu labelu uz `aria-pressed`. Play/pauza je dugme koje **menja značenje**, ne prekidač — „Pauza, pritisnuto" se čita dvosmisleno, pa tamo ostaje dinamična labela bez `aria-pressed`. Mešanje oboje tera čitač da stanje izgovori dvaput i protivrečno.

**`aria-valuetext` na klizačima.** Bez njega čitač čita sirov broj — „184" umesto „3:04 od 8:30", i „nula zarez šezdeset pet" umesto „65%".

**Sakrivene kontrole nose `inert`.** Ranije su se gasile samo kroz `opacity`, pa su ostajale u tab redosledu i u accessibility stablu: korisnik tastature je tabovao u nevidljivo, a čitač je čitao ono što se ne vidi. `aria-hidden` nije zamena — ostavio bi ih fokusabilnim a skrivenim od čitača, što WCAG izričito zabranjuje.

Zamka pri tome ne nastaje: kontejner ima `tabIndex={0}`, pa Tab prvo sleti na njega, `onFocus` pozove `revealControls`, `inert` nestane u istom renderu i sledeći Tab stigne do prvog dugmeta. Dok je fokus unutra, kontrole se **nikad** ne gase.

**Kontrastni tokeni.** `--kf-mut` i `--kf-mut2` su podignuti sa `#6d767e`/`#727b83` na `#767f87`/`#7e878f`. Stare vrednosti su davale 4.31 i 4.49 naspram traženih 4.5:1, što axe obara. Nove prolaze na sve tri podloge (`bg`, `surface`, `surface2`).

### Testovi

```bash
npm run test:e2e        # ceo paket
npm run test:e2e:ui     # Playwright UI
npm run test:a11y       # samo axe
```

**Preduslovi:** Postgres dignut, migriran i seed-ovan, i **mreža** — media i `.vtt` se povlače sa R2. `globalSetup` proverava da podaci postoje i kaže šta da se pokrene ako ne postoje; migracije **ne** pokreće sam, jer test paket koji prepravlja dev bazu je neprijatno iznenađenje.

Playwright vozi `next dev` i čeka na `/api/health`, a ne na `/` — health vraća 503 kad Postgres padne, pa test pukne sa jasnom porukom umesto da istekne na renderovanoj error strani.

| Spec                   | Šta pokriva                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `captions.spec.ts`     | paljenje/gašenje, prečica `C`, i **poklapanje iscrtanog cue-a sa vremenom**                    |
| `caption-size.spec.ts` | veličina menja iscrtane titlove, izbor preživi osvežavanje, sloj je unutar fullscreen elementa |
| `no-captions.spec.ts`  | snimak bez titla — dugme onemogućeno, ime kaže zašto, `C` ne radi ništa                        |
| `keyboard.spec.ts`     | sve kontrole dostupne Tabom, prečice menjaju stanje, fokus vidljiv i ne zaključan              |
| `a11y.spec.ts`         | axe (WCAG 2.0/2.1 A i AA) na obe strane, sa titlovima i bez njih                               |

Test poklapanja cue-a čita tačan tekst iz commit-ovanog `.vtt` fajla. Kad se titl promeni, taj test pada — i to je namera: on je jedini dokaz da su cue-ovi **poklopljeni sa zvukom**, a ne samo da je staza uključena.

> **Fullscreen se automatski ne dokazuje.** Headless Chromium nema pravi ekran, a i da radi — dokazivao bi Chromium, dok je bug bio u WebKitu. Umesto toga `caption-size.spec.ts` tvrdi **invarijantu iz koje popravka sledi**: sloj sa titlovima je DOM potomak elementa nad kojim se zove `requestFullscreen`.
>
> Prava provera je ručna, u **desktop Safariju**: pusti `/videos/solar-eclipse`, upali CC, premotaj na ~30s, uđi u ceo ekran (`F`) — titlovi moraju ostati vidljivi i srazmerno uvećani. Zatim u fullscreen-u promeni veličinu na 160%: ako se menja, sistemska podešavanja titlova više ne odlučuju.

> **Jedan izuzetak je namerno dokumentovan.** Axe pravilo `video-caption` traži `<track kind="captions">` na svakom `<video>`. Na `clip-01-bars` puca po dizajnu, jer u sintetičkoj test-šari nema govora — pravilo se gasi **samo tamo** i samo iz tog razloga; na strani sa pravim snimkom ostaje uključeno.

CI još ne postoji. Kad se doda, koristio bi `npm run build && npm start` umesto `next dev`.

## API

Dva javna endpointa. Odgovori su **DTO oblici iz [src/domain/video.ts](src/domain/video.ts), ne Prisma vrste** — `manifestPath`, `published` i `updatedAt` nikad ne izlaze iz servera. Zbog toga šema baze sme da se menja bez lomljenja klijenata.

| Endpoint                             | Opis                       |
| ------------------------------------ | -------------------------- |
| `GET /api/videos?page=1&pageSize=12` | stranica objavljenih videa |
| `GET /api/videos/:idOrSlug`          | jedan video sa poglavljima |

Detalj prima **i `slug` i `cuid`** — jedan upit pokriva oba, bez pogađanja formata.

### Lista

Ne nosi poglavlja, samo `chapterCount` — odgovor ne raste sa katalogom.

```jsonc
{
  "data": [
    {
      "id": "cmssyo5xr0000jyn3y8ynn3w0",
      "slug": "clip-01-bars",
      "title": "Color bars",
      "description": "SMPTE test slika…",
      "durationSeconds": 24,
      "manifestUrl": "https://pub-xxx.r2.dev/hls/clip-01-bars/master.m3u8",
      "posterUrl": "https://pub-xxx.r2.dev/hls/clip-01-bars/poster.jpg",
      "chapterCount": 4,
    },
  ],
  "meta": { "page": 1, "pageSize": 12, "total": 4, "totalPages": 1, "hasMore": false },
}
```

`manifestUrl` i `posterUrl` su **puni URL-ovi**, sastavljeni od relativne putanje iz baze i `NEXT_PUBLIC_MEDIA_BASE_URL` — vidi [Model podataka](#model-podataka).

### Detalj

Isto kao stavka liste, plus `chapters` poređana po `order` i `subtitles` po jeziku:

```jsonc
{
  "id": "cmssyo5xr0000jyn3y8ynn3w0",
  "slug": "solar-eclipse",
  "chapterCount": 6,
  "chapters": [{ "id": "cmsszlovt0001…", "title": "Poletanje", "startSeconds": 0, "order": 0 }],
  "subtitles": [
    {
      "id": "cmsztj6e7000s…",
      "lang": "en",
      "label": "English",
      "url": "https://pub-xxxxx.r2.dev/captions/solar-eclipse.en.vtt",
      "isDefault": false,
    },
  ],
}
```

`subtitles` postoji **samo na detalju**, iz istog razloga kao `chapters` — mreža na browse strani nema plejer, pa bi joj URL-ovi staza bili mrtav teret. Prazan niz je legitiman odgovor i nosi značenje: plejer po njemu onemogućuje CC kontrolu.

### Greške

Isti oblik na svim rutama, iz [src/lib/api/http.ts](src/lib/api/http.ts):

```jsonc
// 400 — GET /api/videos?page=0
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Neispravni parametri zahteva.",
    "details": [{ "path": "page", "message": "page mora biti 1 ili veci" }],
  },
}
```

```jsonc
// 404 — GET /api/videos/nepostojeci
{ "error": { "code": "NOT_FOUND", "message": "Video \"nepostojeci\" ne postoji." } }
```

`details` imenuje **koje polje** ne valja i **zašto** — dovoljno da klijent ispravi zahtev bez čitanja koda.

### Validacija

[src/lib/api/schemas.ts](src/lib/api/schemas.ts), zod. Sve što stigne s mreže je nepoverljivo; ove šeme su granica iza koje kod radi sa proverenim vrednostima.

- `page` ≥ 1, `pageSize` 1–50 (`z.coerce` jer su query parametri uvek stringovi)
- `pageSize` ima gornju granicu — bez nje `?pageSize=100000` povlači ceo katalog
- `idOrSlug` propušta samo `[A-Za-z0-9_-]`, pa očigledno smeće pada na 400 pre nego što stigne do baze

### Nacrti se ne vide

`published: true` stoji u [src/server/videos.ts](src/server/videos.ts), **ne** u route handlerima — da se ne može zaboraviti na novom pozivnom mestu.

Neobjavljen video daje **404, ne 403** — po odgovoru se ne razlikuje od nepostojećeg, pa se postojanje nacrta ne otkriva.

Seed sadrži namerni fixture `clip-01-bars-draft` (`published: false`) da se to može proveriti bez ručnog diranja baze.

### Provera

```bash
npm run db:seed && npm run dev

curl -s localhost:3000/api/videos | jq '.meta'              # total: 4, nacrt izostavljen
curl -s localhost:3000/api/videos/clip-01-bars | jq '.chapters | length'   # 4
curl -sI 'localhost:3000/api/videos?page=0'                 # 400
curl -sI localhost:3000/api/videos/nepostojeci              # 404
curl -sI localhost:3000/api/videos/clip-01-bars-draft       # 404 — nacrt
```

## Model podataka

```
Video 1 ──< N Chapter
      1 ──< N Subtitle
```

| `Video`           |                                                              |
| ----------------- | ------------------------------------------------------------ |
| `slug`            | čitljiv id, `@unique`, poklapa se sa imenom foldera u `hls/` |
| `title`           | naziv                                                        |
| `description`     | opis, opciono                                                |
| `durationSeconds` | trajanje u **celim sekundama**                               |
| `posterPath`      | relativna putanja do postera                                 |
| `manifestPath`    | relativna putanja do master playliste                        |
| `published`       | podrazumevano `false`                                        |

| `Chapter`      |                                                         |
| -------------- | ------------------------------------------------------- |
| `videoId`      | FK ka `Video`, `onDelete: Cascade`                      |
| `title`        | naziv poglavlja                                         |
| `startSeconds` | početak u **celim sekundama** od početka videa          |
| `order`        | redosled prikaza, 0-bazno, `@@unique([videoId, order])` |

| `Subtitle`  |                                                            |
| ----------- | ---------------------------------------------------------- |
| `videoId`   | FK ka `Video`, `onDelete: Cascade`                         |
| `lang`      | BCP-47 oznaka, ide pravo u `<track srclang>`               |
| `label`     | ime na **jeziku titla** („English"), kao u nativnom meniju |
| `path`      | relativna putanja do `.vtt`, `@@unique([videoId, lang])`   |
| `isDefault` | da li se pali sam; za sada uvek `false`                    |

Zaseban model, a ne polje na `Video`-u, jer jedan snimak prirodno ima više jezika. Prazna lista je legitimno stanje i nosi značenje — vidi [Titlovi](#titlovi).

### Jedinica vremena

Sva vremena su **cele sekunde**. Jedinica stoji **u imenu polja** (`durationSeconds`, `startSeconds`) umesto u komentaru — `duration` bi ostavilo nedoumicu da li su sekunde ili milisekunde, a ime polja se ne može pročitati pogrešno.

### Putanje su relativne — i to je bitno

U bazi stoji:

```
hls/clip-01-bars/master.m3u8
```

Ne `/hls/...`, ne `https://pub-xxx.r2.dev/hls/...`.

Base URL se dodaje **pri čitanju**, u [src/server/videos.ts](src/server/videos.ts), kroz `mediaUrl()`. To je jedino mesto gde se relativna putanja pretvara u pun URL.

Zašto: bazu čita i lokalno okruženje i produkcija. Da apsolutni URL stoji unutra, isti podaci ne bi radili na oba mesta, a promena CDN-a bi tražila `UPDATE` nad svim redovima.

Dokaz da radi — bez ijedne izmene u bazi, samo promenom `.env.local`:

| `NEXT_PUBLIC_MEDIA_BASE_URL` | URL na stranici                                      |
| ---------------------------- | ---------------------------------------------------- |
| `""`                         | `/media/hls/clip-01-bars/poster.jpg`                 |
| `https://pub-xxx.r2.dev`     | `https://pub-xxx.r2.dev/hls/clip-01-bars/poster.jpg` |

### Seed

```bash
npm run db:seed
```

[prisma/seed.ts](prisma/seed.ts) upisuje 4 enkodirana klipa. **Idempotentan je** — `upsert` po `slug`-u, pa uzastopna pokretanja daju isto stanje umesto duplikata.

- **Trajanja su stvarna**, izmerena sa `ffprobe -show_entries format=duration` (24, 28, 20, 26 s)
- **Poglavlja padaju na granice HLS segmenata** (0s, 6s, 12s…). Granica segmenta je i keyframe, pa skok na poglavlje ne traži dekodiranje unazad — plejer kreće tačno odatle

Provera da nijedan apsolutni URL nije završio u bazi:

```sql
SELECT COUNT(*) FROM "Video"
WHERE "manifestPath" LIKE '%://%' OR "manifestPath" LIKE '/%';
-- mora vratiti 0
```

## Media pipeline (HLS)

Aplikacija servira video kao **HLS** sa tri renditiona (360p / 540p / 720p), da bi plejer mogao da menja kvalitet u hodu prema propusnom opsegu.

Media se **ne drži u gitu** — regeneriše se skriptama, a objavljuje na Cloudflare R2 (vidi [CDN](#cdn-cloudflare-r2)).

### Preduslov

```bash
brew install ffmpeg      # macOS
# apt install ffmpeg     # Debian/Ubuntu
```

### Regeneracija svih medija od nule

```bash
npm run media:build
```

Ovo uradi dve stvari: napravi izvorne klipove i enkodira ih u HLS. Traje 1-2 minuta.

### Korak po korak

```bash
npm run media:clips                                  # 1. izvorni klipovi → media/source/
npm run media:encode:all                             # 2. HLS ladder → public/media/hls/
npm run media:encode media/source/clip-01-bars.mp4   # ili jedan po jedan
npm run media:verify public/media/hls/clip-01-bars   # provera postojećeg izlaza
```

### Izvorni klipovi

[scripts/make-sample-clips.sh](scripts/make-sample-clips.sh) generiše **4 sintetička klipa** (20-28s, 1080p30, sa tonom) iz ffmpeg test patterna. Nema skidanja sa interneta — repo je samodovoljan i pipeline se reprodukuje na svakoj mašini identično.

Ako hoćeš prave snimke umesto test patterna, ubaci svoj `.mp4` u `media/source/` i pokreni `npm run media:encode:all`. Skripta uzima sve fajlove iz tog foldera. Za slobodne klipove pogledaj [Pexels Videos](https://www.pexels.com/videos/) ili [Blender open movies](https://www.blender.org/about/projects/) — oba dozvoljavaju slobodnu upotrebu. Isecanje na 25s:

```bash
ffmpeg -i original.mp4 -ss 00:00:10 -t 25 -c copy media/source/moj-klip.mp4
```

### Šta skripta proizvodi

```
public/media/hls/clip-01-bars/
├─ master.m3u8          # lista varijanti sa BANDWIDTH + RESOLUTION
├─ 360p/index.m3u8      # + seg_000.ts, seg_001.ts, ...
├─ 540p/index.m3u8
└─ 720p/index.m3u8
```

Izlaz ide u `public/` da bi Next.js servirao fajlove statički, bez route handlera — vidi sekciju [Serviranje](#serviranje-hls-a).

Ladder ([scripts/encode.sh](scripts/encode.sh), promenljiva `LADDER`):

| Rendition | Rezolucija | Video    | Audio | BANDWIDTH u masteru |
| --------- | ---------- | -------- | ----- | ------------------- |
| 360p      | 640×360    | 800 kbps | 96k   | ~1.0 Mbps           |
| 540p      | 960×540    | 1.4 Mbps | 128k  | ~1.7 Mbps           |
| 720p      | 1280×720   | 2.8 Mbps | 128k  | ~3.2 Mbps           |

Segmenti su ~6s, playliste su `EXT-X-PLAYLIST-TYPE:VOD`.

### Keyframe alignment — zašto je obavezan

Da bi plejer mogao da pređe sa 360p na 720p bez trzaja, **oba renditiona moraju imati keyframe na istom vremenu**. Segment mora počinjati keyframe-om da bi se dekodirao samostalno; ako se pozicije razlikuju, prelaz daje zamrznut kadar ili preskakanje.

Postiže se sa tri postavke u [scripts/encode.sh](scripts/encode.sh) koje rade zajedno:

| Postavka             | Uloga                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| `-g` / `-keyint_min` | fiksan GOP = `fps × 6`, isti za sve renditione                           |
| `-sc_threshold 0`    | gasi keyframe-ove koje bi enkoder sam ubacio na promenu scene            |
| `-force_key_frames`  | garantuje keyframe tačno na 0s, 6s, 12s… i kad je fps razlomljen (29.97) |

Bez `-sc_threshold 0` enkoder ubacuje keyframe kad se scena naglo promeni. Pošto svaki rendition vidi drugačije skaliranu sliku, te tačke se **ne poklapaju** — i poravnanje puca iako je GOP fiksan.

### Provera poravnanja

```bash
npm run media:verify public/media/hls/clip-01-bars
```

[scripts/verify-hls.sh](scripts/verify-hls.sh) proverava tri stvari i vraća izlazni kod 0/1 (upotrebljivo u CI-ju):

1. master ima ≥3 varijante, svaka sa `BANDWIDTH` i `RESOLUTION`
2. svaki rendition ima `EXT-X-PLAYLIST-TYPE:VOD` i segmente
3. keyframe timestampovi su **identični** u svim renditionima

Ručna provera istog, bez skripte:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries frame=pts_time,pict_type -of csv=p=0 \
  public/media/hls/clip-01-bars/720p/seg_000.ts | awk -F, '$2=="I"{print $1}'
```

> Primetićeš da keyframe-ovi počinju na `1.4667` a ne na `0` — to je standardni početni PTS offset MPEG-TS kontejnera, isti za sve renditione. Bitno je da je **razmak tačno 6.000s** i da su vremena **ista u sve tri varijante**.

## Serviranje HLS-a

Media se servira **statički** iz `public/`, bez route handlera. Uz `npm run dev` sve je odmah dostupno:

```
http://localhost:3000/media/hls/<klip>/master.m3u8
http://localhost:3000/media/hls/<klip>/360p/index.m3u8
http://localhost:3000/media/hls/<klip>/360p/seg_000.ts
```

### Content-Type

Next.js sam postavlja tačne vrednosti po ekstenziji, ali ih [next.config.ts](next.config.ts) i eksplicitno zakucava — u Task 0.4 iste headere treba preslikati na CDN, a neki static hostovi serviraju `.m3u8` kao `text/plain`.

| Ekstenzija | Content-Type                    | Cache-Control                         |
| ---------- | ------------------------------- | ------------------------------------- |
| `.m3u8`    | `application/vnd.apple.mpegurl` | `public, max-age=60`                  |
| `.ts`      | `video/mp2t`                    | `public, max-age=31536000, immutable` |

Playliste se kratko keširaju jer se menjaju pri re-enkodiranju; segmenti su nepromenljivi.

### CORS

Sve pod `/media/` dobija `Access-Control-Allow-Origin: *` plus `Access-Control-Expose-Headers` za `Content-Range` i `Accept-Ranges` — bez toga plejer ne vidi zaglavlja potrebna za seek.

Preflight (`OPTIONS`) obrađuje [src/proxy.ts](src/proxy.ts). Razlog: Next-ovo statičko serviranje ne zna za `OPTIONS` i vraća **400**, a browser traži 2xx da bi pustio cross-origin zahtev sa `Range` headerom (`Range` nije CORS-safelisted, pa uvek okida preflight).

> U Next.js 16 se ovaj fajl zove `proxy.ts`; stariji naziv `middleware.ts` je deprecated.

### Provera serviranja

```bash
npm run dev

# content types
curl -sI localhost:3000/media/hls/clip-01-bars/master.m3u8      | grep -i content-type
curl -sI localhost:3000/media/hls/clip-01-bars/360p/seg_000.ts  | grep -i content-type

# CORS preflight → 204
curl -sI -X OPTIONS -H "Origin: http://example.com" \
  localhost:3000/media/hls/clip-01-bars/360p/seg_000.ts | head -1

# Range → 206 Partial Content
curl -sI -H "Range: bytes=0-1023" \
  localhost:3000/media/hls/clip-01-bars/360p/seg_000.ts | head -1

# stvarna reprodukcija
ffplay http://localhost:3000/media/hls/clip-01-bars/master.m3u8
# ili bez prozora:
ffmpeg -i http://localhost:3000/media/hls/clip-01-bars/master.m3u8 -f null -
```

> Safari pušta `.m3u8` direktno u `<video>`. Chrome i Firefox nemaju nativni HLS — treba im hls.js, što dolazi sa plejerom u sledećem koraku.

## CDN (Cloudflare R2)

Media se objavljuje na **Cloudflare R2** — izabran jer **ne naplaćuje egress**. Kod videa je odlazni saobraćaj dominantan trošak; isti setup na S3 se naplaćuje po svakom pregledu.

Sync je **jednokratan**, ne pipeline: pokreće se ručno kad se media regeneriše.

### Odakle app povlači media

Kontroliše jedna promenljiva u `.env.local`:

```bash
NEXT_PUBLIC_MEDIA_BASE_URL=""                         # lokalno iz public/media
NEXT_PUBLIC_MEDIA_BASE_URL="https://pub-xxx.r2.dev"   # sa CDN-a
```

Svi URL-ovi se grade kroz `mediaUrl()` iz [src/lib/media.ts](src/lib/media.ts) — **nijedan apsolutni media URL ne stoji u kodu**. Prefiks `NEXT_PUBLIC_` je obavezan jer plejer radi u browseru, pa vrednost mora da stigne do klijenta.

### Prvo podešavanje bucketa

Radi se jednom, kroz Cloudflare dashboard:

1. **R2** → **Create bucket** → ime `keyframe-media`
2. **R2** → **API** → **Manage API tokens** → `Object Read & Write`, ograničen na taj bucket
3. Bucket → **Settings** → **CORS Policy** → politika ispod
4. Bucket → **Settings** → **Public Development URL** → **Allow Access** → daje `https://pub-xxxxx.r2.dev`
5. Dobijene vrednosti u `.env.local` (vidi [.env.example](.env.example))

CORS politika:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Content-Type"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> Kad se app deploy-uje, dodaj i tu adresu u `AllowedOrigins`. Bez toga segmenti pucaju sa CORS greškom — najčešći uzrok "radi lokalno, puca na produkciji" kod HLS-a.

### Upload

```bash
npm run media:sync -- --dry-run   # pokaže šta bi poslao
npm run media:sync                # pošalje
npm run media:verify:cdn          # proveri
```

[scripts/sync-r2.sh](scripts/sync-r2.sh) šalje u **četiri prolaza**, po jedan za svaki tip:

| Prolaz  | Izvor                   | Content-Type                    | Cache-Control                         |
| ------- | ----------------------- | ------------------------------- | ------------------------------------- |
| `.m3u8` | `public/media/hls`      | `application/vnd.apple.mpegurl` | `public, max-age=60`                  |
| `.ts`   | `public/media/hls`      | `video/mp2t`                    | `public, max-age=31536000, immutable` |
| `.jpg`  | `public/media/hls`      | `image/jpeg`                    | `public, max-age=86400`               |
| `.vtt`  | `public/media/captions` | `text/vtt; charset=utf-8`       | `public, max-age=300`                 |

Odvojeni prolazi su nužni: object storage svemu stavlja `application/octet-stream`, što plejeri odbijaju, a `--content-type` važi za ceo prolaz.

Titlovi dolaze iz **drugog direktorijuma** i jedini su koji se drže u gitu. Zato svaki izvor ima svoj gard — skripta radi i na mašini koja nema lokalno enkodiran HLS, što je stanje svežeg klona. Kratak `max-age` je zato što se `.vtt` ispravlja ručno i mora da se osveži bez čekanja.

### Provera

```bash
npm run media:verify:cdn
```

[scripts/verify-cdn.sh](scripts/verify-cdn.sh) šalje HEAD zahteve i proverava status, Content-Type i `Access-Control-Allow-Origin` za master, sve rendition playliste, segmente i `.vtt` titlove. HLS provere se preskaču kad lokalnog izlaza nema; provera titlova radi uvek, jer su oni u gitu.

Provera titlova nije formalnost: `<track>` je CORS fetch, pa pogrešan Content-Type ili odsutan `Access-Control-Allow-Origin` znači da se `.vtt` preuzme a cue-ovi ostanu prazni — bez ijedne greške u konzoli.

Ručno, na jednom objektu:

```bash
curl -sI -H "Origin: http://localhost:3000" \
  https://pub-xxxxx.r2.dev/hls/clip-01-bars/360p/seg_000.ts
```

> **`curl` nije dovoljan dokaz za CORS** — ne primenjuje same-origin politiku, pa prolazi i kad je bucket pogrešno podešen. Pravi dokaz je fetch iz browsera: otvori <http://localhost:3000>, pa DevTools → Network. Posteri se povlače sa CDN-a; kad dođe hls.js plejer, on će povlačiti i manifeste, i to postaje trajna provera.

## Napomene

- Prisma 7 radi preko **driver adaptera** (`@prisma/adapter-pg`), nema više ugrađenog Rust engine-a.
- Generisani klijent ide u `src/generated/prisma` i gitignore-ovan je; `postinstall` ga pravi na svakom `npm install`.
- `media/` i `public/media/` su gitignore-ovani. Requirements traže commit medija, acceptance criteria traže gitignore — ovde važi acceptance, jer segmenti se objavljuju na Cloudflare R2 (vidi sekciju CDN).
- **Izuzetak je `public/media/captions/`.** Razlog za ignorisanje je veličina `.ts` segmenata, a titl je par KB teksta koji je čovek ručno ispravio — regenerisanje nije ni determinističko ni besplatno, a svež klon bez njega ne bi mogao ni da pokaže funkcionalnost. Vidi [Titlovi](#titlovi).
