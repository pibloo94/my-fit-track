# ADR-003 — API style, versioning and error format

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-002](./ADR-002-backend-framework.md), [ADR-007](./ADR-007-shared-contracts.md), [ADR-010](./ADR-010-mobile-and-offline-strategy.md)

## Context

One first-party client today (the Angular SPA), a second one later that is the same codebase
packaged with Capacitor. No third-party API consumers are planned. Access patterns are known in
advance and mostly hierarchical: a user's sessions, a session's exercises, an exercise's sets, a
day's diary entries. A few screens — the dashboard, an exercise's progression chart — need composed
data from several aggregates.

Two constraints shape the details. Mobile clients cannot be force-upgraded, so old app versions
will call the API for months after a change. And workout logging must tolerate poor connectivity,
which means retries, which means duplicate delivery is a certainty rather than an edge case.

## Decision

REST over JSON, versioned in the URI as `/api/v1`, with RFC 9457 Problem Details for errors,
cursor pagination on unbounded collections, and an `Idempotency-Key` header on mutations.
GraphQL is rejected.

## Alternatives considered

**GraphQL.** Its real strengths apply when many clients need different shapes of the same data, or
when clients evolve independently of the server. Neither is true here: one client, developed in the
same repository, in the same commit. What it would add is concrete: a schema and resolver layer to
maintain, the N+1 problem to solve with dataloaders, field-level authorization to reason about,
loss of straightforward HTTP caching, and a harder time reading an access log during an incident.
The genuine problem GraphQL would solve — over-fetching on composed screens — is solved instead by
two or three purpose-built read endpoints. Revisit if third-party consumers or a second, materially
different client appear.

**tRPC.** Very attractive on paper for a TypeScript monorepo: end-to-end type safety with no schema
duplication. Rejected for two reasons. It couples the client to the server's TypeScript types
rather than to a stable wire contract, which is a poor fit for a mobile client that ships on its
own schedule and may be months behind. And it is not a documented, versionable HTTP surface, which
matters for a product that may later expose an API. We get most of the type-safety benefit anyway
through the shared Zod contract ([ADR-007](./ADR-007-shared-contracts.md)) without giving up
plain HTTP.

**Header or media-type versioning** (`Accept: application/vnd.myfittracker.v2+json`). Purer, but
invisible in logs and dashboards, harder to reproduce with `curl`, and easy for an intermediary to
strip. URI versioning is cruder and better operationally.

**No versioning, evolve additively.** Works until it does not. With mobile clients in the field, one
unavoidable breaking change without a versioning story means breaking installed apps.

**A uniform response envelope** (`{ data, meta, errors }` on every response). Consistent, but adds
an unwrap to every single call site to carry metadata that most responses do not have. We use an
envelope only for collections, where the pagination metadata is real.

**Offset pagination.** Simpler, and every developer understands it. Rejected on the endpoints that
matter because users insert entries continuously: paging through session history with `offset`
skips and duplicates rows as new sessions are added, and deep offsets get slower as history grows.
This is a correctness problem, not just performance.

## Reason

REST wins because the domain is hierarchical and the client is singular — the conditions under
which GraphQL's flexibility is overhead rather than leverage. HTTP semantics we get for free
(status codes, caching, idempotency, standard tooling, readable logs) are worth more to a solo
developer during an incident than query flexibility that only one known client would use.

The two non-obvious details — cursor pagination and idempotency keys — are chosen because of the
offline requirement, not for elegance. Without idempotency, a retry after a timeout duplicates
logged sets, which silently corrupts training history: the exact failure that offline support is
supposed to prevent.

## Trade-offs

Composed screens need bespoke endpoints, which means the API grows read endpoints that exist to
serve a specific view. That is a mild coupling of API to UI, accepted deliberately and kept small.

Cursor pagination cannot jump to an arbitrary page, and cursors must be opaque and stable, which is
more implementation work than `LIMIT/OFFSET`.

Idempotency requires server-side storage of keys and their responses, with expiry — real
infrastructure for a guarantee that is invisible when it works.

Versioning means that once `v2` exists, `v1` must keep working for as long as old mobile clients
are in use.

## Consequences

- **Resource naming is fixed** around the domain distinction that matters:

  | Resource | Meaning |
  | --- | --- |
  | `/exercises` | Catalogue definition, global or user-authored |
  | `/routines` | A plan: what the user intends to do |
  | `/workout-sessions` | A performed workout: what actually happened |
  | `/set-entries` | An individual logged set |

  `/workouts` is not used, because it reads as "plan" to one person and "performed session" to
  another, and that ambiguity propagates into the data model.

- Nesting stops at two levels. Once a resource has an identifier it is addressed at the top level
  (`PATCH /set-entries/{id}`), not through its full ancestry.
- All errors are `application/problem+json`, emitted by one exception filter and consumed by one
  Angular interceptor. Every problem document carries a stable machine-readable `code` and a
  `traceId`, because clients must branch on codes rather than parse prose.
- `404` is returned instead of `403` for resources owned by another user, so the API does not
  confirm their existence.
- Filtering and sorting use per-endpoint allow-lists. No generic query language is exposed, since
  that would be both an injection surface and an accidental public contract over column names.
- Mutations accept `Idempotency-Key`; the server persists key, request fingerprint and response for
  24 hours and replays the stored response on retry.
- Every request and response shape is defined by a Zod schema in `packages/contracts`
  ([ADR-007](./ADR-007-shared-contracts.md)).

## Reversal trigger

Introduce GraphQL only if a third-party or materially different client appears whose data needs
cannot be met by adding read endpoints. "The dashboard needs three requests" is not that trigger —
that is what a composed endpoint is for.
