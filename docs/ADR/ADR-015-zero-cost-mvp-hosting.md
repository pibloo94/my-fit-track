# ADR-015 — Zero-cost hosting for the MVP

- Status: Accepted
- Date: 2026-09-28
- Related: [ADR-002](./ADR-002-backend-framework.md), [ADR-004](./ADR-004-database-and-orm.md), [ADR-013](./ADR-013-hosting-and-deployment.md)
- Amends: [ADR-013](./ADR-013-hosting-and-deployment.md) for the API and database, until the reversal
  trigger below fires

## Context

[ADR-013](./ADR-013-hosting-and-deployment.md) chose Railway for the API. The Railway trial expired
before the first deploy, and Railway now requires payment. For the MVP the requirement is explicit:
**hosting must cost nothing**. The MVP exists to answer one question — will someone log training and
food more than twice ([ROADMAP.md](../ROADMAP.md#mvp-scope)) — and paying for infrastructure before
that answer exists is not justified.

The constraints from ADR-013 still apply: EU region, managed Postgres with backups we do not own,
minimal operational attention, and a plain Dockerfile with no platform-specific code. What changes
is that a permanent, always-on container is no longer affordable. Every free container tier that
exists in September 2026 puts the instance to sleep when it is idle.

That conflicts with a consequence of [ADR-002](./ADR-002-backend-framework.md): NestJS cold starts
are meaningful, so the API was meant to be long-lived. This ADR accepts that conflict for the MVP
only, and states when it stops being acceptable.

Free tiers as checked on 2026-09-28:

| Provider         | What is free                                                          | Idle behaviour                                  | EU        |
| ---------------- | --------------------------------------------------------------------- | ----------------------------------------------- | --------- |
| Koyeb            | One web service: 512 MB RAM, 0.1 vCPU, Docker                         | Scales to zero after 1 h idle; 1–5 s cold start | Frankfurt |
| Render           | Web service, 750 h/month; Postgres 1 GB                               | Sleeps after 15 min idle; about 1 min to wake   | Frankfurt |
| Render Postgres  | 1 GB                                                                  | **Deleted 30 days after creation**, no backups  | —         |
| Neon             | Postgres, 0.5 GB, 100 CU-hours/month, 10 branches, no card, no expiry | Suspends after 5 min idle; sub-second resume    | Frankfurt |
| Cloudflare Pages | Static hosting and CDN (already in use)                               | None                                            | Global    |

## Decision

- **Web:** Cloudflare Pages, unchanged.
- **One origin:** a Cloudflare Pages Function forwards `/api/*` to the API. The browser only ever
  talks to the Pages origin, so the web app needs no CORS and its session cookie is first-party
  ([ADR-016](./ADR-016-opaque-server-sessions.md)). The Function is a plain pass-through that adds
  no logic. Pages Functions are free up to 100,000 requests a day.
- **API:** the existing Docker image on **Koyeb's free instance**, in Frankfurt.
- **Database:** **Neon's free plan**, in Frankfurt (`aws-eu-central-1`).
- **Migrations:** a CI step runs `prisma migrate deploy` against Neon before the new image is
  deployed. They do not run in the container entrypoint.
- **Environments:** the staging environment is the MVP deployment. Production and the
  tag-triggered release remain in phase 10.

## Alternatives considered

**Render for the API.** It runs Docker in Frankfurt, but it wakes in about a minute after 15 minutes
of idle time. A user who opens the app at the gym would wait a minute for the first screen. That
makes the MVP's question unanswerable, because a slow first impression gets read as a bad product.

**Render Postgres.** Deleted after 30 days and has no backups. Not acceptable for data that users
are asked to trust.

**Supabase Postgres.** 500 MB, and pauses after a week of inactivity. It has no branching on the free
plan, and ships a platform (auth, storage, realtime) that we would not use. Neon is the plainer
Postgres and has the branching capability ADR-013 already preferred.

**Fly.io.** Designated in ADR-013 as the first move. It no longer offers a free allowance to new
organisations, so it is equivalent to Railway for this decision.

**Google Cloud Run.** Its free allowance is generous and it runs containers natively. It requires a
billing account with a card, and it brings IAM and project setup that ADR-013 rejected for a solo
developer. It is also a scale-to-zero platform, so it has the same cold-start problem with more
setup.

**Oracle Cloud Always Free VM.** Plenty of capacity for free, but it is a self-managed VPS: patching,
TLS, backups and monitoring become ours. ADR-013 rejected this model for that reason, and it still
applies.

**Web and API on separate origins, with CORS.** This is how ADR-013 was set up. On free hosting
both live on shared public-suffix domains (`*.pages.dev`, `*.koyeb.app`), so they are different
sites. Any cookie the API sets is then third-party and gets blocked or dropped, which rules out
cookie authentication on web. A custom domain shared by both would also fix this, for about €10 a
year. The proxy fixes it for free. The API origin stays reachable directly, because the native app
will call it in phase 10; the proxy authenticates itself to the API with a shared secret only so
that the forwarded client address can be trusted for rate limiting.

**Rewrite the API for an edge or serverless runtime** (Cloudflare Workers, for example). This removes
the cold-start problem at the root, but it replaces NestJS. That is exactly the reversal ADR-002 warns
about, and it is far too expensive to do in order to save a few euros a month.

## Reason

Koyeb is the only free container host that combines Docker, an EU region and a cold start measured
in seconds rather than a minute. Neon is the only free managed Postgres that neither expires nor
pauses for days, and it keeps the branching capability ADR-013 wanted for per-pull-request databases.

Nothing in the code changes. The image stays platform-agnostic, which is the property ADR-013
designed in so that a hosting change is configuration. This decision is that property being used.

Running migrations from CI rather than from the entrypoint is closer to ADR-013 than the current
setup. ADR-013 asks for migrations "as a separate step before the new version starts". It also stops
a sleeping instance from re-running `migrate deploy` on every wake, which at 0.1 vCPU would add
seconds to each cold start.

## Trade-offs

- **Cold starts are user-visible.** After an hour of idle time, the first request waits for the
  container (1–5 s) and possibly for Neon to resume (under a second). ADR-002 accepted this cost for
  serverless deployments and rejected it. This ADR accepts it temporarily.
- **0.1 vCPU is slow.** NestJS bootstrap and Argon2id hashing (phase 2) will be noticeably slower
  than on a real instance. Argon2id parameters must not be weakened to compensate.
- **Hard quotas.** 0.5 GB of storage and 100 CU-hours per month. When compute hours run out, Neon
  suspends the database, which is an outage rather than a slowdown.
- **One free Koyeb instance per organisation.** There is no room for a second environment; staging
  is also the only deployment.
- **Free tiers change without notice.** Railway just proved it. The mitigation is the same
  portability that made this move cheap.

## Consequences

- **The health check must not keep the database awake.** `/api/v1/health` pings Postgres. If the
  platform health check or an uptime monitor calls it every few minutes, Neon never suspends. At a
  continuous 0.25 CU that is about 180 CU-hours a month, which exhausts the quota by mid-month. The
  platform health check therefore uses a TCP check or a liveness path that does not touch the
  database. The database-aware health endpoint is for manual and CI checks only.
- **Connection strings.** The API uses Neon's direct (unpooled) connection string. A single instance
  with Prisma's default pool is well within Neon's connection limit. The pooled endpoint, and Prisma's
  `directUrl` for migrations, become necessary only when there is more than one instance.
- **CI changes.** The staging job loses `RAILWAY_TOKEN` and gains a Neon connection string and a
  Koyeb token. It runs migrations, then redeploys the Koyeb service, then deploys Pages.
  `railway.json` is removed, and the Dockerfile entrypoint stops running migrations.
- **Backups.** Neon's free plan keeps a short point-in-time restore window. A restore is tested
  before real users arrive, as ADR-013 already requires.
- **The proxy is part of the web deployment.** It lives in `apps/web/functions/`, reads the API
  origin from a Pages environment variable, and forwards method, path, query, headers and body
  unchanged. Local development keeps the Angular dev-server proxy, which does the same job.
  `app-config.json` points the web app at its own origin.
- **The API still enables CORS**, but only for the Capacitor origins it will need in phase 10. The
  web origin does not need it.

## Reversal trigger

Move the API to a paid always-on instance (Koyeb Eco, Railway, Fly.io — whichever is cheapest at
that time) and Neon to a paid plan when any of the following happens:

- The first users outside the developer exist. Cold starts are acceptable for validating the pipeline, not for
  validating the product.
- Neon compute or storage quota is exhausted, or comes within 20% of the limit in a month.
- A cold start is observed to exceed 10 seconds.
- Either provider changes its free tier in a way that breaks one of the constraints above.

The move is configuration: a new platform token in CI and a new connection string.
