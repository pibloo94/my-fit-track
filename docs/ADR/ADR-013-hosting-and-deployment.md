# ADR-013 — Hosting, deployment and CI/CD

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-002](./ADR-002-backend-framework.md), [ADR-004](./ADR-004-database-and-orm.md), [ADR-006](./ADR-006-monorepo-and-tooling.md)

## Context

Three things need hosting: a static Angular bundle, a NestJS container, and PostgreSQL. The
constraints:

- **The API must be a long-lived container.** NestJS cold starts rule out per-request serverless
  ([ADR-002](./ADR-002-backend-framework.md)).
- **No server-side rendering**, so the web application is genuinely static files.
- **EU region**, because the data plausibly includes health data under GDPR.
- **One developer**, so operational simplicity is a first-order requirement, not a nicety.
- Expected scale is unknown; there is no user estimate to size against.

The stated priority is the best ratio of cost, simplicity and scalability — not the cheapest option.

## Decision

**Frontend:** a static host with a global CDN — Cloudflare Pages as the default choice.
**API:** a Docker container on a managed platform — Railway as the default choice.
**Database:** managed PostgreSQL in an EU region, preferring a provider with database branching for
per-pull-request environments.
**CI/CD:** GitHub Actions, with `main` deploying to staging automatically and production releases
triggered by a tag.

## Alternatives considered

**Frontend on Vercel.** Outstanding developer experience and the default choice for many teams. Its
distinguishing features — server-side rendering, incremental static regeneration, edge functions —
are precisely what we decided not to use. Paying (in cost and in vendor coupling) for a platform
whose advantages are unused is not a good trade for serving static files. Cloudflare Pages serves
static assets on a large global network with generous free limits and straightforward custom
domains and headers, which is the entire requirement.

**Frontend on Netlify.** Equivalent for this use case. No decisive differentiator either way.

**Frontend served by the API container.** One deployment, no CORS, simpler auth cookies. Rejected
because it couples the release cycles of two things that change at different rates, and it puts
static asset serving on a container that then cannot be scaled or cached independently.

**API on Fly.io.** Strong option: fine-grained region control, cheap horizontal scale, first-class
Docker. Slightly more configuration to operate (`fly.toml`, volumes, Postgres as a separate concern)
than Railway. This is the designated first step if scaling or region needs change.

**API on Render.** Comparable to Railway. No decisive advantage.

**API on AWS (ECS/Fargate) or Google Cloud (Cloud Run).** The most scalable and the most flexible,
and the right answer at a much larger size. Rejected now because it means owning networking, IAM,
observability wiring and infrastructure-as-code — a meaningful ongoing operational burden for a
solo developer with no users. Cloud Run is the closest fit of these, since it is container-native.

**Serverless functions for the API.** Rejected: incompatible with NestJS cold start characteristics
and with persistent database connections.

**Self-hosted VPS with Docker Compose.** Cheapest at small scale and full control. Rejected because
the developer becomes responsible for patching, backups, certificate renewal, monitoring and
recovery — buying a few euros a month with an unbounded time commitment and a real data-loss risk.

**Kubernetes.** Explicitly out of scope. It solves problems this product does not have and adds a
permanent operational discipline.

**Database bundled with the application platform** versus a dedicated provider. A dedicated provider
with branching gives ephemeral databases per pull request, which makes integration testing against
real data shapes practical, plus scale-to-zero economics. This is a genuine capability difference
rather than a preference, which is why it drives the choice.

## Reason

Every choice here follows from what the application actually is. It is static files, so it goes on a
CDN — the platform features we would pay for elsewhere are unused. It is a stateful container with
persistent database connections, so it goes on a container platform. It is relational data under
GDPR, so it goes on managed Postgres in the EU with backups someone else is responsible for.

The decisive criterion between comparable platforms is how much operational attention each demands.
Railway and Cloudflare Pages both cost close to nothing in attention, which for a solo developer is
the scarce resource. Managed Postgres with branching is chosen for a concrete capability —
per-pull-request databases — rather than for price.

Portability is the hedge that makes all of this reversible: the API is a plain Dockerfile with no
platform-specific code, so moving to Fly.io, Cloud Run or ECS is a deployment configuration change
rather than a rewrite. That is the property that makes it safe to pick the simple option now.

## Trade-offs

Vendor concentration on Railway for the runtime, mitigated by the container being standard.

Platform-managed infrastructure means less control over networking and scaling behaviour, and
provider outages are not something we can route around.

Managed database providers with scale-to-zero introduce cold-start latency on the first query after
idle, which is noticeable in development and staging.

Three providers means three dashboards, three billing relationships and three status pages to check
during an incident.

Prisma against a pooled Postgres needs deliberate connection configuration; getting it wrong
produces connection exhaustion under load
([ADR-004](./ADR-004-database-and-orm.md)).

## Consequences

- The API ships as a multi-stage `Dockerfile` producing a minimal production image with no
  platform-specific code, no platform SDKs and configuration entirely through environment variables.
  This is what keeps the platform choice reversible.
- Environments: **local** (Docker Compose Postgres), **staging** (deployed from `main`), and
  **production** (deployed from a tag). Staging exists to run migrations against realistic data
  before they touch production.
- **Migrations run as a separate step before the new version starts**, and are written to be
  backward compatible with the previous release — otherwise a rollback is impossible exactly when it
  is needed. Expand-then-contract for destructive changes: add, migrate, deploy, then remove in a
  later release.
- **Production deploys are tag-triggered**, so a release is an explicit, attributable action rather
  than a side effect of merging a pull request.
- Pull request pipeline, ordered fastest-failing-first: install from the committed lockfile, type
  check, lint and format check, unit tests, production build of both applications, integration tests
  against a PostgreSQL service container, and a Playwright smoke suite against a preview deployment
  for pull requests targeting `main`. All are required checks under branch protection.
- `concurrency` with `cancel-in-progress` per branch, so superseded runs stop.
- Renovate or Dependabot with grouped updates, so dependency currency does not arrive as a weekly
  flood of individual pull requests.
- A bundle-size budget is enforced in CI, since a size regression is easy to introduce and hard to
  notice later.
- Secrets live in platform secret storage and in GitHub encrypted secrets, never in the repository.
  The API validates its configuration at startup and refuses to boot on a missing or malformed
  value, so misconfiguration fails immediately rather than at the first request that needs it.
- Backups are the provider's automated backups, plus a **restore that has actually been tested**. An
  untested backup is a belief, not a capability.
- All infrastructure is provisioned in an EU region.

## Reversal trigger

Move the API to Fly.io or Cloud Run if regional latency, sustained cost at scale, or a platform
limitation becomes a real problem. Because the API is a standard container, that migration is
configuration.

Revisit the whole hosting model only if traffic reaches a level where managed platform pricing is
materially worse than self-managed infrastructure — a calculation that needs the user estimate we do
not yet have, and which is recorded as an open decision in
[ARCHITECTURE.md](../ARCHITECTURE.md#open-decisions).
