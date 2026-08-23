# ADR-005 — Frontend state management

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-001](./ADR-001-frontend-framework-and-ui.md), [ADR-010](./ADR-010-mobile-and-offline-strategy.md)

## Context

The Angular application holds four different kinds of state, and the failure mode we are trying to
avoid is holding the same fact in more than one of them:

- **Server state** — sessions, foods, measurements. Fetched, cached, invalidated.
- **Client state** — open panels, selected tabs, unsubmitted filters.
- **Session state** — the authenticated user, role, entitlements, access token.
- **Domain state** — derived values with product meaning: remaining macros today, current weekly
  volume, whether a logged set is a new record.

The team is one developer. The project owner's stated preference is to avoid NgRx unless it earns
its place. Angular 22 made `resource`, `rxResource` and `httpResource` stable, which changes the
calculus: the framework now ships the loading/error/cancellation machinery that custom state layers
used to exist to provide.

## Decision

**Angular signals with one small store class per feature. No NgRx.** Server state is fetched through
`httpResource`/`resource`. Derived values are always `computed()`, never stored.

## Alternatives considered

**NgRx Store.** Its genuine strengths are a strictly auditable action log, time-travel debugging,
and a convention strong enough to keep a large team consistent. All three are valuable — on a team.
For one developer, the action/reducer/effect/selector ceremony is paid on every interaction to buy
coordination that is not needed. Rejected.

**NgRx SignalStore.** A much closer call. It provides a well-designed store primitive with signals,
plus entity management and a plugin ecosystem, without the global reducer machinery. It loses
narrowly: what it offers over a hand-written store class is mostly conventions we can adopt
directly, and it is another dependency with its own major-version cadence tracking Angular's. If
hand-written stores start diverging in shape, this is the first thing to adopt.

**TanStack Query for Angular.** The strongest option specifically for server state: mature caching,
invalidation, deduplication, retry, background refetch. Rejected *for now* because Angular 22's
`httpResource` covers the same ground for our access patterns, and adding a caching library before
feeling a caching problem is speculative. It is the designated escalation.

**Elf, Akita, or a similar store library.** No advantage over signals plus a class, and additional
dependency risk.

**Services with `BehaviorSubject`.** The pre-signals Angular default. Rejected: signals do this
better, with less boilerplate and no manual subscription management.

**No state layer — fetch in components.** Rejected. It duplicates requests, spreads mapping logic
across templates, and makes any cross-component consistency impossible.

## Reason

`httpResource` already solves the hard parts of server state — status tracking, dependent
re-fetching when a signal changes, cancellation of superseded requests — so the remaining job of a
store is small: hold the resources, expose derived signals, and coordinate mutations with
invalidation. A plain class does that well, and it is trivially testable: instantiate it, no
`TestBed`, no framework harness, no action dispatch.

The decisive argument against NgRx is that its cost is proportional to the number of interactions,
which in a data-entry application is high, while its benefit is proportional to team size, which is
one.

## Trade-offs

No time-travel debugging and no centralised action log. Debugging is reading a store class, which is
fine at this size and worse at a much larger one.

Consistency depends on discipline rather than a framework: nothing prevents two stores from
diverging in shape. Mitigated by the rules below and by ESLint boundaries, not by a library.

Cache invalidation across features is manual. If feature A's mutation must invalidate feature B's
list, that is an explicit call through a `core` service. This is the weak point of the decision and
the thing being watched.

## Consequences

Rules that make this workable, each addressing a specific way hand-rolled state goes wrong:

- **One owner per fact.** Session state lives only in `core/auth`. No feature copies the current
  user or entitlements into its own store; two sources of truth for "who is logged in" is a
  security bug in waiting.
- **Server state is a cache, treated as one.** After a successful mutation, the store invalidates
  the affected resource rather than hand-patching a local array. Hand-patching is how a list and its
  detail view start disagreeing.
- **Derived values are `computed()`.** Never a stored field, never assigned from an effect. A stored
  total will eventually disagree with the data it was derived from.
- **`effect()` is for leaving the reactive graph only** — persisting a preference, sending analytics,
  driving an imperative chart library, setting the document title. Never to propagate state between
  signals, and never to trigger HTTP.
- **RxJS only for streams over time**: debounced search input, server-sent events or websockets,
  retry with backoff, cancellation semantics beyond what a resource provides. Convert at the
  boundary with `toSignal`/`toObservable`, and never hold the same truth in both a signal and a
  subject.
- **Client state stays in the component** until a second component genuinely needs it. Promoting UI
  state to a store pre-emptively creates coupling for nothing.
- **Stores are plain classes** with signals, injected via DI, no inheritance from a base store. They
  are unit tested directly.

## Reversal trigger

Adopt **TanStack Query for Angular** if cross-feature cache invalidation becomes manual and
error-prone — concretely, if a bug caused by stale cached data reaches a user, or if invalidation
calls start crossing three or more features.

Adopt **NgRx SignalStore** if store implementations diverge enough that a shared convention is
needed, or if a second developer joins.

In neither case is **NgRx Store** the answer: the failure mode being anticipated is cache
coordination, not missing action auditing.
