# My Fit Tracker

A training and nutrition tracking application: workouts, exercises, sets, reps, load, RIR/RPE,
progression, diet, foods, recipes, calories and macronutrients, body measurements, habits and
statistics.

> **Status: phase 1.** The architecture is documented and the first vertical slice is in place: the
> API serves `/api/v1/health` (including a Postgres ping) and the Angular app consumes it through
> `packages/contracts`. Local Postgres is Docker Compose; the API and web app run natively. The MVP
> is a closed beta in Spanish and English — see the [roadmap](docs/ROADMAP.md#mvp-scope).

## Documentation

| Document                                     | What it covers                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | The complete technical architecture: structure, frontend, backend, database, auth, state, API, testing, CI/CD, security, observability, scalability |
| [docs/ADR/](docs/ADR/README.md)              | Architecture Decision Records — what was decided, what else was considered, and why                                                                 |
| [docs/ROADMAP.md](docs/ROADMAP.md)           | Ten delivery phases and the MVP scope, classified MUST / SHOULD / COULD / FUTURE                                                                    |

Start with [ARCHITECTURE.md](docs/ARCHITECTURE.md). It links to the ADR for every decision it
summarises.

## Stack

**Frontend** — Angular 22 (standalone, signals, zoneless), TypeScript, Tailwind CSS, Angular CDK.
Spanish and English via `@angular/localize` and Signal Forms arrive in phase 2; Capacitor packaging
in phase 10.

**Backend** — NestJS 11 on Fastify, REST API, Prisma, PostgreSQL.

**Shared** — a `contracts` package of Zod schemas that is the single definition of every request and
response shape, used for validation on the server and type inference on the client.

**Quality** — Vitest, Testcontainers, Playwright, ESLint with enforced import boundaries, Prettier,
GitHub Actions. Angular Testing Library is added with the first component that needs it.

Each choice, including the ones rejected, is justified in
[docs/ADR/](docs/ADR/README.md).

## Repository layout

```
apps/
  web/          Angular SPA (later wrapped by Capacitor)
  api/          NestJS HTTP API
packages/
  contracts/    Zod schemas and inferred types, shared by web and api
  config/       Shared ESLint, Prettier and tsconfig bases
tools/          Tests for the repository's own tooling
e2e/            Playwright smoke tests (both apps, together)
docs/           Architecture, ADRs, roadmap
```

Architectural import rules are enforced, not just documented. The policies live in
`eslint.boundaries.mjs` and are themselves covered by tests in `tools/`.

## Local development

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run db:up
npm run db:migrate
npm run build
```

`docker-compose.yml` starts PostgreSQL 17 only. Health is `GET /api/v1/health`: `ok` when the
database answers, `degraded` when it does not. Without Docker, unit tests still run; the
Testcontainers integration test skips.

```bash
npx playwright install chromium
npm run test:e2e
```

The smoke test starts the API from `apps/api/dist` and the Angular dev server. Run `npm run build`
first so the API exists.

## Deployment

The MVP runs as a closed beta on zero-cost tiers, as a single environment deployed from `main` after
CI is green ([ADR-015](docs/ADR/ADR-015-zero-cost-mvp-hosting.md)):

- **Web** — the Angular bundle on Cloudflare Pages, with a Pages Function forwarding `/api/*` to the
  API, so the browser only ever talks to one origin.
- **API** — the Docker image on Koyeb's free instance (Frankfurt).
- **Database** — Neon's free Postgres (Frankfurt). Migrations run from CI before the API redeploys.

The deploy job in `.github/workflows/ci.yml` applies migrations to Neon, redeploys the Koyeb
service, deploys the web bundle and proxy to Pages, then checks `/api/v1/health` through the Pages
origin. Until its secrets exist, it skips.

### One-time setup

1. **Neon** — create a project in **AWS Europe (Frankfurt)** with Postgres 17. Copy the **direct**
   (not pooled) connection string.
2. **Proxy secret** — generate one value, used by both Koyeb and Pages:
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.
3. **Koyeb** — create a Web Service from this GitHub repository:
   - Branch `main`, Dockerfile builder (`Dockerfile` at the repository root), **autodeploy off** —
     CI triggers deploys after migrations.
   - Free instance in Frankfurt. App `my-fit-track`, service `api`.
   - Port `3000` (HTTP), health check **HTTP `/api/v1/health/live`**. Never point it at
     `/api/v1/health`: that pings the database and would keep Neon awake all month.
   - Environment: `NODE_ENV=production`, `PORT=3000`, `DATABASE_URL` (Neon, direct),
     `CORS_ORIGINS=https://my-fit-track-staging.pages.dev`, `API_PROXY_SECRET`.
4. **Cloudflare Pages** — create the project once:
   `npx wrangler pages project create my-fit-track-staging --production-branch main`. Create an
   API token with the _Cloudflare Pages: Edit_ permission.
5. **GitHub** — create an Environment named `staging` with these secrets:

| Secret                  | What it is                                                           |
| ----------------------- | -------------------------------------------------------------------- |
| `NEON_DATABASE_URL`     | Neon direct connection string, used to apply migrations              |
| `KOYEB_TOKEN`           | Koyeb API token                                                      |
| `KOYEB_SERVICE`         | Optional. `<app>/<service>` on Koyeb. Defaults to `my-fit-track/api` |
| `KOYEB_API_ORIGIN`      | Public API origin, no trailing slash (e.g. `https://….koyeb.app`)    |
| `API_PROXY_SECRET`      | The value from step 2, identical to the one set on Koyeb             |
| `CLOUDFLARE_API_TOKEN`  | The token from step 4                                                |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id                                                |

The web app calls the API on its own origin (`app-config.json` keeps `apiBaseUrl` empty), and the
Function reads `API_ORIGIN` and `API_PROXY_SECRET`, which the deploy job sets on the Pages project.

```bash
docker build -t my-fit-track-api --build-arg APP_VERSION=dev .
```

## Architectural principles

The design is guided by three ideas, explained in full in
[ARCHITECTURE.md](docs/ARCHITECTURE.md#1-architecture-summary):

- **Optimise for change, not for scale we do not have.** Microservices, Kubernetes, CQRS,
  event-driven architecture and a message broker are all explicitly out of scope until a measured
  need exists.
- **Layer where the complexity is.** Full layering applies to modules with real domain logic, not
  uniformly to every CRUD endpoint.
- **Make boundaries executable.** Import rules are enforced by ESLint, contracts by Zod at runtime,
  and development conventions by [.cursor/rules/](.cursor/rules/).

## License

This project is distributed under a proprietary **Source Available / Non-Commercial** license (see [`LICENSE`](LICENSE)).

You may view, study, clone, run, modify, and fork the code for **personal, educational, academic, or research** purposes only.

**Commercial use is not allowed.** You may not sell the code, include it in commercial products or services, use it in monetized SaaS/apps, or otherwise generate revenue from it without prior written permission from the copyright holder.

This is **not** an OSI-approved Open Source license. All commercial rights remain reserved.
