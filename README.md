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

| Skripta                    | Šta radi                                                   |
| -------------------------- | ---------------------------------------------------------- |
| `npm run dev`              | Dev server (hot reload)                                    |
| `npm run build`            | Produkcijski build                                         |
| `npm start`                | Pokreće produkcijski build                                 |
| `npm run lint`             | ESLint                                                     |
| `npm run typecheck`        | `tsc --noEmit`                                             |
| `npm run format`           | Prettier — formatira sve                                   |
| `npm run db:up`            | Diže Postgres kontejner i čeka da bude healthy             |
| `npm run db:down`          | Gasi kontejner (podaci ostaju u volume-u)                  |
| `npm run db:reset`         | **Briše podatke**, diže bazu iznova i primenjuje migracije |
| `npm run db:migrate`       | Kreira i primenjuje migraciju iz izmena u `schema.prisma`  |
| `npm run db:seed`          | Puni bazu enkodiranim klipovima (idempotentno)             |
| `npm run db:deploy`        | Primenjuje postojeće migracije (za CI/produkciju)          |
| `npm run db:generate`      | Regeneriše Prisma klijent                                  |
| `npm run db:studio`        | Prisma Studio — GUI nad bazom                              |
| `npm run media:build`      | Generiše izvorne klipove i enkodira sve u HLS              |
| `npm run media:clips`      | Samo izvorni klipovi → `media/source/`                     |
| `npm run media:encode:all` | Enkodira sve iz `media/source/` + verifikuje               |
| `npm run media:encode`     | Enkodira jedan fajl                                        |
| `npm run media:verify`     | Proverava HLS izlaz i keyframe alignment                   |
| `npm run media:sync`       | Šalje `public/media/hls` na Cloudflare R2                  |
| `npm run media:verify:cdn` | HEAD provera content-type-ova i CORS-a na CDN-u            |

## Environment

Konekcioni string živi u `.env.local`, koji **nije** u gitu. U repo ide samo `.env.example` sa placeholder vrednostima.

- Next.js sam učitava `.env.local`.
- Prisma CLI ga učitava kroz `prisma.config.ts` (`dotenv` sa eksplicitnom putanjom), pa je konekcija definisana na jednom mestu.

Default vrednosti odgovaraju servisu `db` iz [docker-compose.yml](docker-compose.yml): korisnik/lozinka/baza su svuda `keyframe`, port `5432`.

## Struktura

```
src/
├─ app/             # rute, layout-i, page-ovi (App Router)
│  └─ api/health/   # Route Handler koji proverava konekciju na bazu
├─ components/      # prezentacione React komponente
│  └─ ui/           # generički, reusable elementi
├─ server/          # kod koji sme da radi samo na serveru
│  ├─ db.ts         # Prisma klijent (singleton)
│  ├─ videos.ts     # čitanje videa + gradnja punih URL-ova
│  └─ actions/      # Server Actions
├─ domain/          # čista domenska logika i tipovi, bez I/O
├─ lib/             # deljeni helperi
│  └─ env.ts        # jedino mesto koje čita process.env
└─ generated/       # Prisma klijent — generisan, nije u gitu

prisma/
├─ schema.prisma    # modeli
├─ seed.ts          # početni podaci
└─ migrations/      # istorija migracija (u gitu)

scripts/            # media pipeline (bash)
media/source/       # izvorni klipovi — generisano, nije u gitu
public/media/hls/   # HLS izlaz — generisano, nije u gitu
```

**Pravilo:** `app/` i `components/` nikad ne importuju Prismu direktno — pristup bazi ide isključivo kroz `src/server/`. `src/server/db.ts` je označen sa `server-only` pa build pukne ako se to prekrši.

## Model podataka

```
Video 1 ──< N Chapter
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

[scripts/sync-r2.sh](scripts/sync-r2.sh) šalje u **dva prolaza**, po jedan za svaki tip:

| Prolaz  | Content-Type                    | Cache-Control                         |
| ------- | ------------------------------- | ------------------------------------- |
| `.m3u8` | `application/vnd.apple.mpegurl` | `public, max-age=60`                  |
| `.ts`   | `video/mp2t`                    | `public, max-age=31536000, immutable` |

Dva prolaza su nužna: object storage svemu stavlja `application/octet-stream`, što plejeri odbijaju, a `--content-type` važi za ceo prolaz.

### Provera

```bash
npm run media:verify:cdn
```

[scripts/verify-cdn.sh](scripts/verify-cdn.sh) šalje HEAD zahteve i proverava status, Content-Type i `Access-Control-Allow-Origin` za master, sve rendition playliste i segmente.

Ručno, na jednom objektu:

```bash
curl -sI -H "Origin: http://localhost:3000" \
  https://pub-xxxxx.r2.dev/hls/clip-01-bars/360p/seg_000.ts
```

> **`curl` nije dovoljan dokaz za CORS** — ne primenjuje same-origin politiku, pa prolazi i kad je bucket pogrešno podešen. Zato početna stranica ima `MediaProbe` komponentu ([src/components/media-probe.tsx](src/components/media-probe.tsx)) koja povlači svaku master playlistu **iz browsera**. Otvori <http://localhost:3000> — četiri zelena reda znače da CORS stvarno radi.

## Napomene

- Prisma 7 radi preko **driver adaptera** (`@prisma/adapter-pg`), nema više ugrađenog Rust engine-a.
- Generisani klijent ide u `src/generated/prisma` i gitignore-ovan je; `postinstall` ga pravi na svakom `npm install`.
- `media/` i `public/media/` su gitignore-ovani. Requirements traže commit medija, acceptance criteria traže gitignore — ovde važi acceptance, jer segmenti se objavljuju na Cloudflare R2 (vidi sekciju CDN).
