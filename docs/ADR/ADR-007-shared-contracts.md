# ADR-007 — Shared API contract package

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-001](./ADR-001-frontend-framework-and-ui.md), [ADR-003](./ADR-003-api-style.md), [ADR-006](./ADR-006-monorepo-and-tooling.md)

## Context

The API and the client are written in the same language, in the same repository, by the same person.
Without a deliberate mechanism, the shape of every endpoint gets written three times: as a
server-side validation rule, as a server-side response type, and as a client-side interface. Those
three drift, and the drift is discovered at runtime.

There is a second, related duplication that is specific to this product: it is form-heavy. "A set
must have a positive weight and between 1 and 100 reps" would be written once as an Angular
validator and again as a server-side rule. That is the same fact in two places, in two languages of
expression, with no compiler linking them.

The original brief asked whether the layering `API → DTO → Domain Model → View Model` is needed.
This ADR answers that as well, since the contract package determines where those boundaries fall.

## Decision

A `packages/contracts` workspace exporting **Zod schemas** as the single definition of every
request and response shape, with TypeScript types inferred from them. Both applications depend on
it. **Two layers, not four**: transport DTO (from the contract) and feature domain model, with view
models expressed as `computed()` signals rather than as a formal layer.

## Alternatives considered

**OpenAPI as the source of truth, with generated clients.** The industry-standard approach, and the
right answer when the API has consumers you do not control or clients in other languages. It loses
here on the round trip: a code-generation step in the build, generated code in the repository or in
`node_modules`, and a spec that is either hand-maintained (and therefore drifts) or generated from
decorators (in which case the decorators are the real source of truth and the spec is a by-product).
Note that we can still *emit* OpenAPI from the Zod schemas for documentation — the point is that it
is an output, not the input.

**NestJS DTO classes with `class-validator`, and separate frontend interfaces.** The Nest-idiomatic
default. Rejected because the frontend interfaces are then a manual copy, which is exactly the drift
we are trying to prevent, and because `class-validator` decorators cannot be reused as Angular form
validators.

**tRPC.** Discussed and rejected in [ADR-003](./ADR-003-api-style.md): it couples the client to
server types rather than to a wire contract, which is the wrong trade for a mobile client that ships
on its own schedule.

**Sharing TypeScript `interface`s only, with no runtime schema.** Cheap, and gives compile-time
safety. Rejected because a type is erased at runtime, so the server still needs a validator — which
means writing the shape twice anyway — and because the client would then trust that a response
matches its type, which it cannot verify.

**Valibot instead of Zod.** Smaller bundle, similar ergonomics, and a real consideration for a
mobile client. Zod is chosen for ecosystem maturity and because both NestJS integration and Angular
Signal Forms accept it through the standard-schema interface. Valibot is a reasonable later swap if
bundle size becomes a measured problem.

**The full four-layer mapping chain** (`API response → DTO → domain model → view model`, each with
its own type and mapper). Rejected as artificial at this size. Four types per endpoint and three
mappers, most of which would be identity functions, is ceremony that obscures rather than clarifies.

## Reason

A Zod schema is simultaneously a runtime validator and a static type. That single property removes
the duplication at its root: the server parses with it, the client infers its types from it, and —
because Signal Forms accepts standard-schema validators — the same schema validates the form. One
definition, three uses, no code generation step.

On layering: the two boundaries that earn their keep are the **wire boundary** (where untrusted
input is parsed and where transport concerns like ISO date strings live) and the **domain boundary**
(where the client works with `Date` objects, computed properties and behaviour). A third formal
view-model layer would mostly restate the domain model; where a view genuinely needs a different
shape — a chart series, an aggregated table — that is a `computed()` signal, which is cheaper and
automatically stays in sync.

## Trade-offs

The frontend is coupled to the wire contract's shape. Acceptable because the API is versioned and
both sides are developed together — and note the alternative, a hand-written copy, is coupling
without the compiler noticing when it breaks.

Zod adds runtime weight to the client bundle. Real, and mitigated by importing per-schema rather
than barrel-importing the whole package.

Schema-first modelling can tempt the domain model to become the wire model. The mapper layer exists
specifically to prevent that, and the discipline has to be maintained: transport types use strings
for dates and flat structures; domain models use real types and may have behaviour.

`packages/contracts` becomes a change amplifier: touching it triggers a rebuild of both apps.
Acceptable, and arguably desirable — it makes the blast radius of a contract change visible.

## Consequences

- `packages/contracts` depends only on Zod. No Angular, no NestJS, no Prisma imports, ever — those
  would make it unusable by one side or the other.
- Structure by domain area, with granular exports so tree-shaking works:

  ```
  packages/contracts/src/
  ├── auth/          login, refresh, register schemas
  ├── exercises/
  ├── routines/
  ├── sessions/
  ├── nutrition/
  ├── progress/
  ├── common/        pagination, problem-details, shared value objects
  └── index.ts       re-exports, but consumers import from subpaths
  ```

- The API validates every request body, query and path parameter against the contract schema at the
  controller boundary, rejecting unknown properties rather than stripping them. Nothing downstream
  re-validates.
- Contract schemas are versioned with the API. A breaking change means a `v2` schema alongside `v1`,
  not an edit to `v1`.
- The client maps DTO to domain model in the feature's `data-access/` layer. Mappers are pure
  functions and are unit tested — they are where ISO strings become `Date` objects and where
  canonical SI units become the user's display units
  ([ADR-014](./ADR-014-domain-model-conventions.md)).
- Domain models never leak transport concerns into components: no component should ever parse a date
  string.
- Prisma models are not contract types and are never exposed directly. Coupling the wire format to
  the database schema would make every migration a breaking API change.
- An OpenAPI document may be generated from these schemas for documentation. It is an output.

## Reversal trigger

Move to OpenAPI-first with generated clients if a third-party or non-TypeScript client ever needs to
consume the API, since at that point a language-neutral specification stops being overhead and
becomes the requirement.
