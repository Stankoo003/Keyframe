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

# 5. Startuj dev server
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
| `npm run db:deploy`        | Primenjuje postojeće migracije (za CI/produkciju)          |
| `npm run db:generate`      | Regeneriše Prisma klijent                                  |
| `npm run db:studio`        | Prisma Studio — GUI nad bazom                              |
| `npm run media:build`      | Generiše izvorne klipove i enkodira sve u HLS              |
| `npm run media:clips`      | Samo izvorni klipovi → `media/source/`                     |
| `npm run media:encode:all` | Enkodira sve iz `media/source/` + verifikuje               |
| `npm run media:encode`     | Enkodira jedan fajl                                        |
| `npm run media:verify`     | Proverava HLS izlaz i keyframe alignment                   |

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
│  └─ actions/      # Server Actions
├─ domain/          # čista domenska logika i tipovi, bez I/O
├─ lib/             # deljeni helperi
│  └─ env.ts        # jedino mesto koje čita process.env
└─ generated/       # Prisma klijent — generisan, nije u gitu

prisma/
├─ schema.prisma    # modeli
└─ migrations/      # istorija migracija (u gitu)

scripts/            # media pipeline (bash)
media/source/       # izvorni klipovi — generisano, nije u gitu
media/hls/   # HLS izlaz — generisano, nije u gitu
```

**Pravilo:** `app/` i `components/` nikad ne importuju Prismu direktno — pristup bazi ide isključivo kroz `src/server/`. `src/server/db.ts` je označen sa `server-only` pa build pukne ako se to prekrši.

## Media pipeline (HLS)

Aplikacija servira video kao **HLS** sa tri renditiona (360p / 540p / 720p), da bi plejer mogao da menja kvalitet u hodu prema propusnom opsegu.

Media se **ne drži u gitu** — regeneriše se skriptama. Segmenti se objavljuju na CDN u kasnijem koraku.

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
npm run media:encode:all                             # 2. HLS ladder → media/hls/
npm run media:encode media/source/clip-01-bars.mp4   # ili jedan po jedan
npm run media:verify media/hls/clip-01-bars   # provera postojećeg izlaza
```

### Izvorni klipovi

[scripts/make-sample-clips.sh](scripts/make-sample-clips.sh) generiše **4 sintetička klipa** (20-28s, 1080p30, sa tonom) iz ffmpeg test patterna. Nema skidanja sa interneta — repo je samodovoljan i pipeline se reprodukuje na svakoj mašini identično.

Ako hoćeš prave snimke umesto test patterna, ubaci svoj `.mp4` u `media/source/` i pokreni `npm run media:encode:all`. Skripta uzima sve fajlove iz tog foldera. Za slobodne klipove pogledaj [Pexels Videos](https://www.pexels.com/videos/) ili [Blender open movies](https://www.blender.org/about/projects/) — oba dozvoljavaju slobodnu upotrebu. Isecanje na 25s:

```bash
ffmpeg -i original.mp4 -ss 00:00:10 -t 25 -c copy media/source/moj-klip.mp4
```

### Šta skripta proizvodi

```
media/hls/clip-01-bars/
├─ master.m3u8          # lista varijanti sa BANDWIDTH + RESOLUTION
├─ 360p/index.m3u8      # + seg_000.ts, seg_001.ts, ...
├─ 540p/index.m3u8
└─ 720p/index.m3u8
```

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
npm run media:verify media/hls/clip-01-bars
```

[scripts/verify-hls.sh](scripts/verify-hls.sh) proverava tri stvari i vraća izlazni kod 0/1 (upotrebljivo u CI-ju):

1. master ima ≥3 varijante, svaka sa `BANDWIDTH` i `RESOLUTION`
2. svaki rendition ima `EXT-X-PLAYLIST-TYPE:VOD` i segmente
3. keyframe timestampovi su **identični** u svim renditionima

Ručna provera istog, bez skripte:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries frame=pts_time,pict_type -of csv=p=0 \
  media/hls/clip-01-bars/720p/seg_000.ts | awk -F, '$2=="I"{print $1}'
```

> Primetićeš da keyframe-ovi počinju na `1.4667` a ne na `0` — to je standardni početni PTS offset MPEG-TS kontejnera, isti za sve renditione. Bitno je da je **razmak tačno 6.000s** i da su vremena **ista u sve tri varijante**.

## Napomene

- Prisma 7 radi preko **driver adaptera** (`@prisma/adapter-pg`), nema više ugrađenog Rust engine-a.
- Generisani klijent ide u `src/generated/prisma` i gitignore-ovan je; `postinstall` ga pravi na svakom `npm install`.
- `media/` je gitignore-ovan. Requirements traže commit medija, acceptance criteria traže gitignore — ovde važi acceptance, jer segmenti se objavljuju na CDN u kasnijem koraku.
