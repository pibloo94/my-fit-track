# ADR-001 — Frontend framework, UI layer and forms

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-005](./ADR-005-state-management.md), [ADR-007](./ADR-007-shared-contracts.md), [ADR-010](./ADR-010-mobile-and-offline-strategy.md)

## Context

My Fit Tracker is a data-entry-heavy application: dense forms filled in quickly, often one-handed,
sometimes on poor connectivity in a gym, plus charts and history views. It must later ship as a
mobile application from the same codebase ([ADR-010](./ADR-010-mobile-and-offline-strategy.md)) and
must be maintainable by one developer over years.

Angular was pre-selected by the project owner and is not being re-litigated here; what this ADR
decides is the shape of the Angular stack — which framework features to build on, what UI layer to
adopt, and which forms API to standardise on. The relevant baseline is Angular 22.1.x
(released June 2026), which made three changes that affect these choices: `OnPush` became the
default change detection strategy, the `resource`/`rxResource`/`httpResource` APIs became stable,
and Signal Forms became stable. Angular 22 also requires TypeScript 6 and deprecated the Webpack
build pipeline.

## Decision

Angular 22 with standalone components, signals-first, zoneless change detection, the `application`
build system, **Tailwind CSS for styling and Angular CDK for behaviour (no Angular Material)**, and
**Signal Forms** validated by the Zod schemas exported from `packages/contracts`.

## Alternatives considered

**Angular Material + CDK.** A complete, accessible, well-maintained component set that would let us
skip building buttons, dialogs, date pickers and inputs entirely — a substantial amount of work for
a solo developer. It loses on two grounds. First, Material Design is instantly recognisable, and
overriding it into a distinct product identity is typically more work than building components from
tokens; a commercial fitness product competes partly on feel. Second, it brings a component library
and its theming system into the bundle for a product whose actual component surface is small and
repetitive. Material remains a reasonable fallback if the cost of hand-built components turns out
to dominate delivery time.

**Tailwind alone, without the CDK.** Cheaper in dependencies, but the CDK covers precisely the
things that are hard to get right and dangerous to get wrong: overlay positioning, focus trapping,
`aria` wiring, virtual scrolling, drag and drop. Reimplementing accessible overlays is not a
reasonable use of a solo developer's time.

**A component library styled with Tailwind** (for example a headless kit). Plausible, but adds a
dependency whose lifecycle we do not control for a component set we can express with the CDK plus
Tailwind directly.

**Reactive Forms instead of Signal Forms.** The mature, universally documented option, with a decade
of community answers. It loses on a specific and concrete point: validation would be written twice —
once as Angular validators and once as the server-side schema — for every field in an application
that is mostly forms. Signal Forms consumes standard-schema validators, which means the Zod schema
in `packages/contracts` becomes the only definition of what a valid workout set is.

**Template-driven forms.** Rejected: no typed model and no schema integration.

**Keeping `zone.js`.** Zoneless is the direction of the framework and removes a bundle cost and a
class of confusing change-detection behaviour. Since there is no legacy promise-based state to
support, there is nothing to lose by starting zoneless.

## Reason

The dominant cost in this application is form logic and validation, not component variety. Signal
Forms plus shared Zod schemas attacks that cost directly: one schema defines validity, the server
enforces it and the client presents it. Tailwind plus the CDK matches the actual need — many
variations of a few dense input patterns, plus a handful of hard interaction primitives — better
than a general-purpose component library whose main value is breadth we will not use.

Taking Angular 22's new defaults rather than opting out of them means the codebase is aligned with
where the framework is going, which for a project measured in years is worth more than familiarity.

## Trade-offs

We build and maintain our own base components: inputs, buttons, dialogs, selects, date and number
pickers, toasts. That is real, front-loaded work, and it includes accessibility work that Material
would have given us.

Signal Forms is the newest API in the stack, stable for roughly two months at the time of writing.
There is less community material, fewer worked examples for unusual cases, and a higher chance of
hitting an unpolished edge. This is knowingly the highest-risk choice in the architecture.

Zoneless can conflict with a third-party library that expects zone patching, which would surface as
missing updates rather than an obvious error.

## Consequences

- A `shared/ui` component set must be built and treated as a real internal library, with its own
  tests and accessibility expectations — not as a folder of ad-hoc components.
- Design tokens live in Tailwind configuration and are the only source of spacing, colour and
  typography values. Arbitrary values in templates defeat the point.
- `packages/contracts` must export schemas usable both as Signal Forms validators and as
  server-side parsers, which constrains it to plain Zod with no framework imports
  ([ADR-007](./ADR-007-shared-contracts.md)).
- The project must remain on the `application` build system; the Webpack pipeline is deprecated and
  is also a prerequisite for the Vitest test builder ([ADR-012](./ADR-012-testing-strategy.md)).
- TypeScript is pinned to 6.0.x for the whole repository, because `@angular/compiler-cli` and
  `@angular/build` declare `typescript >=6.0 <6.1` — a closed range — even though TypeScript 7 is
  already stable. Compatibility with NestJS was verified; see
  [ARCHITECTURE.md](../ARCHITECTURE.md#technical-risks).

## Reversal trigger

**Signal Forms:** if a form hits a Signal Forms limitation that costs more than a day to work
around, that form moves to Reactive Forms via the documented interop. This is per-form and does not
invalidate the architecture.

**Angular Material:** if hand-built components consume more than roughly 20% of feature delivery
time by the end of phase 5, adopt Material for the remaining primitives and restyle rather than
continuing to build.

**Zoneless:** revert to zone-based change detection if a required dependency proves incompatible.
This is a provider-level change.
