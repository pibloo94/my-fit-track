# ADR-006 — Repository layout and build tooling

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-007](./ADR-007-shared-contracts.md), [ADR-013](./ADR-013-hosting-and-deployment.md)

## Context

Two deployable applications — an Angular SPA and a NestJS API — both in TypeScript, both maintained
by the same single developer, sharing the definition of the HTTP contract. A change to an endpoint
typically touches the API, the contract and the client in one logical unit of work. Later, a
Capacitor wrapper is added around the same web application.

The repository currently contains only a licence, a README and a `.gitignore` written for a single
Angular project at its root.

## Decision

**One repository, npm workspaces, no Nx and no Turborepo initially.** Layout: `apps/web`,
`apps/api`, `packages/contracts`, `packages/config`. Module boundaries enforced by ESLint rather
than by a build tool.

## Alternatives considered

**Separate repositories for frontend and backend.** The traditional split, with independent
histories and permissions. It loses on the thing that happens most often here: an endpoint change
that must land atomically across three places. In separate repositories that becomes a published
package, a version bump and coordinated merges — process overhead invented for a coordination
problem that does not exist with one developer. It also makes the shared contract awkward: either
duplicated, or published to a registry for an audience of one.

**Nx.** The strongest alternative, and genuinely well suited on paper: first-class Angular and Nest
generators, a dependency graph, `affected` commands, computed caching, and — most relevant here —
`enforce-module-boundaries`, which does exactly what we want for feature isolation. It loses on
cost. Nx is a build system with its own semi-annual major versions, plugin versions coupled to
Angular versions, and migration steps of its own; adopting it means adding a second framework to
keep current. Its headline benefits scale with repository size — `affected` matters when a full run
is expensive, distributed caching matters with a team — and with two apps and two packages, a full
run is cheap. We can get the boundary enforcement, which is the part we actually want, from an
ESLint plugin.

**Turborepo.** Much lighter than Nx: task orchestration and caching, one configuration file, no
generators, no boundary rules. Almost free, and the obvious answer once task running gets slow. Not
adopted on day one because with two apps `npm run --workspaces` is sufficient, and every dependency
that is not yet needed is a dependency to justify.

**pnpm or Yarn workspaces instead of npm.** pnpm is faster and stricter about phantom dependencies,
which is a real correctness benefit. npm is chosen because it is already installed, requires no
additional tooling on the developer's machine or in CI, and handles the one advanced case we need:
different versions of a dependency per workspace — which matters given the possible TypeScript 6
divergence between Angular 22 and NestJS. Switching to pnpm later is a lockfile change, not an
architecture change.

## Reason

A monorepo is justified by the shared contract and by atomic cross-cutting changes — that part is
clear. The interesting decision is _how little tooling_ to put on top of it, and the answer is:
as little as delivers the benefit we can name. The benefit we can name is enforced module
boundaries, and that comes from ESLint. Everything else Nx offers is a solution to a scale problem
we do not have, purchased with a permanent maintenance obligation.

## Trade-offs

Without `affected`, CI runs every check on every pull request. Wasteful in principle; with two apps,
a few minutes in practice.

Without generators, new features and modules are created by hand from a documented convention,
which is more manual and easier to do inconsistently.

npm workspaces is less strict than pnpm about undeclared transitive imports, so a package can
accidentally rely on something it does not declare.

Task orchestration is npm scripts, which handles cross-workspace dependency ordering less elegantly
than a real task graph.

## Consequences

- Root `package.json` declares workspaces and the top-level scripts: `lint`, `test`, `typecheck`,
  `build`, `dev`, `db:*`.
- **`package-lock.json` is committed.** The existing `.gitignore` excludes it, which is corrected as
  part of this work: without a committed lockfile, builds are not reproducible and CI caching is
  meaningless. `.gitignore` patterns are also made relative (`dist/` rather than `/dist/`) so they
  apply inside `apps/*` and `packages/*`.
- `packages/contracts` and `packages/config` are consumed through workspace protocol references and
  are never published to a registry.
- Nothing in `apps/` may import from another entry in `apps/`. Code needed by both moves to
  `packages/`.
- Module boundaries are enforced by ESLint (`eslint-plugin-boundaries` or
  `import/no-restricted-paths`) with the rules listed in
  [ARCHITECTURE.md](../ARCHITECTURE.md#enforced-import-rules). Unenforced boundaries erode; this is
  the mechanism that replaces Nx's boundary tooling.
- TypeScript project references are used so `apps/*` consume `packages/contracts` as a typed
  project rather than through path aliases into source, which keeps incremental builds honest.
- CI installs with `npm ci` from the committed lockfile.

## Reversal trigger

Adopt **Turborepo** when the pull request pipeline exceeds roughly 8 minutes, or when the repository
grows past about four workspaces. It is a low-cost, additive change.

Reconsider **Nx** only if a second developer joins _and_ the number of shared libraries grows past
roughly five, at which point generators and `affected` start paying for their maintenance cost.
Adopting it before that would be paying for capability we cannot use.
