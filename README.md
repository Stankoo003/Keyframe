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

| Skripta               | Šta radi                                                   |
| --------------------- | ---------------------------------------------------------- |
| `npm run dev`         | Dev server (hot reload)                                    |
| `npm run build`       | Produkcijski build                                         |
| `npm start`           | Pokreće produkcijski build                                 |
| `npm run lint`        | ESLint                                                     |
| `npm run typecheck`   | `tsc --noEmit`                                             |
| `npm run format`      | Prettier — formatira sve                                   |
| `npm run db:up`       | Diže Postgres kontejner i čeka da bude healthy             |
| `npm run db:down`     | Gasi kontejner (podaci ostaju u volume-u)                  |
| `npm run db:reset`    | **Briše podatke**, diže bazu iznova i primenjuje migracije |
| `npm run db:migrate`  | Kreira i primenjuje migraciju iz izmena u `schema.prisma`  |
| `npm run db:deploy`   | Primenjuje postojeće migracije (za CI/produkciju)          |
| `npm run db:generate` | Regeneriše Prisma klijent                                  |
| `npm run db:studio`   | Prisma Studio — GUI nad bazom                              |

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
```

**Pravilo:** `app/` i `components/` nikad ne importuju Prismu direktno — pristup bazi ide isključivo kroz `src/server/`. `src/server/db.ts` je označen sa `server-only` pa build pukne ako se to prekrši.

## Napomene

- Prisma 7 radi preko **driver adaptera** (`@prisma/adapter-pg`), nema više ugrađenog Rust engine-a.
- Generisani klijent ide u `src/generated/prisma` i gitignore-ovan je; `postinstall` ga pravi na svakom `npm install`.
