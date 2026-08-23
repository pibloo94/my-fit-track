# ADR-002 — Backend framework

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-003](./ADR-003-api-style.md), [ADR-004](./ADR-004-database-and-orm.md), [ADR-013](./ADR-013-hosting-and-deployment.md)

## Context

The backend must expose an HTTP API to one Angular client (later also a Capacitor build), own the
domain logic for training and nutrition, enforce authentication and authorization, and persist to
PostgreSQL. It is built and maintained by one developer who is simultaneously working on the Angular
frontend, in a repository that shares TypeScript code between both sides.

The functional requirements are unremarkable for a web API: validated CRUD over owned resources,
plus a handful of genuinely non-trivial calculations (training progression, personal-record
detection, nutritional aggregation against targets). Nothing suggests unusual throughput or latency
requirements. There is no requirement for real-time collaboration, streaming or multi-tenant
isolation beyond per-user ownership.

## Decision

**NestJS 11 on the Fastify adapter**, structured as a modular monolith with selective internal
layering. Deployed as a single long-lived container.

## Alternatives considered

**Express + TypeScript, hand-assembled.** Maximum control and no framework opinions. It loses
because the things we would assemble by hand are exactly the things NestJS provides: a dependency
injection container, a module system, request-boundary validation, guards and interceptors. The
project owner's stated goal is an architecture that does not have to be rebuilt as the product
grows; hand-rolling the structural layer means reinventing it, inconsistently, under time pressure.
Control here is not an advantage — it is unfinished work.

**Fastify alone.** Fast and pleasant, with excellent schema-based validation. Same objection as
Express: it is an HTTP layer, not an application structure. Its plugin encapsulation model is also a
weaker fit than a DI container for organising domain services.

**Hono, or another modern edge-oriented framework.** Excellent for small, edge-deployed APIs.
Rejected because the strengths (tiny bundle, edge runtimes) do not apply — we need persistent
database connections and a Node runtime — while the ecosystem for auth, validation and background
work is thinner.

**NestJS on Express.** The default adapter, with the broadest recipe compatibility. Fastify wins on
throughput and has a cleaner plugin model; the cost is that Express-specific middleware recipes do
not transfer, which is acceptable for a new project with no middleware inventory.

**A meta-framework backend** (Next.js route handlers, Analog, or similar full-stack framework).
Rejected: this API serves a native mobile client as well as the web app, so coupling it to a
frontend framework's deployment model would be a constraint with no compensating benefit.

**A backend-as-a-service** (Supabase, Firebase, Pocketbase). Genuinely attractive for time to
market: authentication, database and generated APIs on day one. Rejected because the domain has
real server-side logic (progression rules, PR detection, macro aggregation, entitlement
enforcement) that would end up either in client code — where it cannot be trusted — or in edge
functions that reproduce a backend without its structure. For a product intended for sale,
vendor-owned data access is also a strategic constraint. Supabase remains a reasonable option for
managed PostgreSQL specifically.

## Reason

Three properties decide it.

First, **dependency injection and modules map directly onto the architecture we want**: one module
per bounded context, with layering applied where domain logic is real and skipped where it is not
(see [ARCHITECTURE.md](../ARCHITECTURE.md#6-backend-architecture)). We get that structure as a
framework property rather than a convention to defend.

Second, **the mental model matches Angular**: decorators, DI, modules, guards, interceptors, pipes.
For a single developer switching between frontend and backend many times a day, one paradigm
instead of two is a measurable reduction in context-switching cost. This is a genuine
productivity argument, not an aesthetic preference.

Third, **request-boundary concerns are first-class**: validation pipes, guards for authentication
and entitlements, an exception filter for the RFC 9457 error format, an interceptor for logging and
correlation identifiers. These are cross-cutting requirements that NestJS lets us implement once,
globally, instead of remembering per route.

## Trade-offs

Decorator and metadata boilerplate: more ceremony per endpoint than Fastify or Hono, and a learning
curve if the mental model is unfamiliar.

Opinionation: NestJS has views on structure, and fighting them is unpleasant. We accept its
conventions rather than layering our own on top.

Startup cost: the module graph and metadata reflection make cold starts meaningful, which
constrains deployment (see consequences).

Bundle and dependency weight is larger than a minimal framework. This is irrelevant for a container
and would matter on a serverless platform.

Fastify v5 specifics: Express middleware recipes do not apply, and only CORS-safelisted methods are
enabled by default — `PATCH`, `PUT` and `DELETE` must be enabled explicitly, which is an easy
oversight to make and a confusing one to debug.

## Consequences

- The API is deployed as a **long-lived container**, not as per-request serverless functions. Cold
  start would be a user-visible cost. This constrains [ADR-013](./ADR-013-hosting-and-deployment.md).
- Global cross-cutting infrastructure must be set up in phase 1: a validation pipe wired to Zod
  contract schemas, an RFC 9457 exception filter, a logging and correlation interceptor, throttling,
  Helmet, and an explicit CORS allow-list including the Capacitor origins.
- Bounded contexts are NestJS modules. Cross-context reactions use the in-process event emitter
  rather than direct service imports, so extraction stays possible.
- The domain layer must not import from `@nestjs/*`. Framework decorators belong in `api/` and
  `infrastructure/`; keeping them out of `domain/` is what allows domain tests to run without a
  Nest test harness.
- TypeScript 6 compatibility with NestJS decorator metadata was verified empirically on 2026-08-23:
  NestJS 11.2.1 on Fastify compiles and runs under TypeScript 6.0.3 with constructor injection
  intact. See [ARCHITECTURE.md](../ARCHITECTURE.md#technical-risks) for the constraints this
  uncovered.

## Reversal trigger

If cold-start-sensitive deployment ever becomes a requirement — for example moving the API to an
edge or serverless platform for cost reasons — the framework choice must be revisited, because
NestJS is the wrong tool for that model. The mitigation that keeps this affordable is keeping domain
and application layers free of framework imports: in that scenario the HTTP layer is replaced and
the domain is not.
