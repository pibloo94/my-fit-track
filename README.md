# My Fit Tracker

A training and nutrition tracking application: workouts, exercises, sets, reps, load, RIR/RPE,
progression, diet, foods, recipes, calories and macronutrients, body measurements, habits and
statistics.

> **Status: architecture phase.** No application code exists yet. The technical design is complete
> and documented; implementation starts with phase 1 of the roadmap.

## Documentation

| Document                                     | What it covers                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | The complete technical architecture: structure, frontend, backend, database, auth, state, API, testing, CI/CD, security, observability, scalability |
| [docs/ADR/](docs/ADR/README.md)              | Architecture Decision Records — what was decided, what else was considered, and why                                                                 |
| [docs/ROADMAP.md](docs/ROADMAP.md)           | Ten delivery phases and the MVP scope, classified MUST / SHOULD / COULD / FUTURE                                                                    |

Start with [ARCHITECTURE.md](docs/ARCHITECTURE.md). It links to the ADR for every decision it
summarises.

## Planned stack

**Frontend** — Angular 22 (standalone, signals, zoneless), TypeScript, Tailwind CSS, Angular CDK,
Signal Forms. Packaged for mobile with Capacitor.

**Backend** — NestJS 11 on Fastify, REST API, Prisma, PostgreSQL.

**Shared** — a `contracts` package of Zod schemas that is the single definition of every request and
response shape, used for validation on the server and type inference on the client.

**Quality** — Vitest, Angular Testing Library, Testcontainers, Playwright, ESLint with enforced
import boundaries, Prettier, GitHub Actions.

Each choice, including the ones rejected, is justified in
[docs/ADR/](docs/ADR/README.md).

## Planned repository layout

```
apps/
  web/          Angular SPA (later wrapped by Capacitor)
  api/          NestJS HTTP API
packages/
  contracts/    Zod schemas and inferred types, shared by web and api
  config/       Shared ESLint, Prettier and tsconfig bases
tools/          Tests for the repository's own tooling
docs/           Architecture, ADRs, roadmap
```

Architectural import rules are enforced, not just documented. The policies live in
`eslint.boundaries.mjs` and are themselves covered by tests in `tools/`.

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
