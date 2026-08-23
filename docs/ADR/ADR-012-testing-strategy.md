# ADR-012 — Testing strategy and tooling

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-001](./ADR-001-frontend-framework-and-ui.md), [ADR-004](./ADR-004-database-and-orm.md), [ADR-013](./ADR-013-hosting-and-deployment.md)

## Context

One developer maintains both applications. That single fact dominates the strategy: a large, slow,
brittle suite will not be maintained, it will be disabled. The goal is therefore not maximum
coverage but the smallest set of tests that fails only for real reasons and catches the defects this
codebase will actually produce.

The application's risk is concentrated in specific places. There is real calculation logic
(progression, estimated one-rep-max, macro aggregation, target evaluation) where a wrong answer is
silent and damaging. There is a large amount of validated, authorized data access where the likely
bug is a missing ownership filter or a wrong constraint. And there is form-heavy UI where the
interesting behaviour is what the user sees, not how the component stores it.

Relevant tooling context: Karma is deprecated and Vitest is the Angular CLI's default runner for new
projects, which makes the choice of frontend runner effectively a matter of following the supported
path.

## Decision

**Vitest** as the only unit-test runner across the repository. **Angular TestBed with Testing
Library** for components. **Testcontainers with real PostgreSQL** for API integration tests.
**Playwright** for a deliberately small end-to-end suite. No global coverage threshold initially.

## Alternatives considered

**Jest** for the API, Vitest for the web. Jest is the NestJS default and completely adequate.
Rejected because two runners means two configurations, two mocking APIs, two reporters and two
coverage formats in one repository, for no benefit. One runner is worth more than each side's
default.

**Karma and Jasmine.** Deprecated and no longer receiving fixes. Not a viable choice for a new
project.

**Cypress** instead of Playwright. Excellent developer experience and a superb time-travel debugger,
and for many teams the right call. Playwright wins on parallel execution, trace-based debugging
in CI, and multi-engine coverage — the last mattering specifically because a Capacitor WebView on
iOS is WebKit, so testing only Chromium would leave the mobile platform untested.

**Mocking Prisma in API tests.** The fast option, and the common one. Rejected firmly: a test that
asserts `prisma.setEntry.create` was called with particular arguments passes when the query is
wrong, the migration is missing, the constraint is absent and the ownership filter was forgotten. It
verifies that the code calls the code it calls. In an application whose main risk is exactly those
data-layer mistakes, that is negative value — it produces confidence without evidence.

**A shared long-lived test database** instead of Testcontainers. Faster to start, but tests
interfere, ordering matters, and cleanup failures cause phantom failures that erode trust in the
suite.

**Component tests asserting on internals** — reading component fields, calling methods directly.
Rejected: these break on every refactor and pass while the rendered output is wrong. Testing Library
asserts on what the user perceives, which is both more stable and more meaningful.

**A large end-to-end suite as the primary safety net.** Rejected. E2E tests are the slowest to run,
the flakiest, and the most expensive to maintain per assertion. They are a smoke test for critical
journeys, not a substitute for lower tiers.

**A high global coverage gate from day one** (for example 80%). Rejected. On a young codebase a
global percentage produces tests written to move a number — assertions on getters, tests of
generated code — which is measurable activity and no protection.

## Reason

The strategy follows the risk. Domain calculations are pure functions and cheap to test exhaustively,
so they get thorough unit tests. Data access risk lives in the interaction between authorization,
validation, transactions and constraints — none of which exists in a mocked test — so it gets
integration tests against a real database, and that tier carries most of the effort. UI risk is
about what renders, so component tests assert on output. Journey risk is narrow and gets four E2E
tests.

One runner for everything is chosen for maintenance economics rather than technical merit: fewer
tools to configure, upgrade and debug is a durable advantage for a solo developer.

## Trade-offs

Testcontainers requires Docker locally and in CI, and integration tests are seconds rather than
milliseconds. Accepted: this is the tier that finds real bugs, and it is worth the wall-clock time.

Vitest for NestJS is less travelled than Jest, so decorator and metadata edge cases may need
configuration work that Jest would not.

Testing Library discourages testing internals, which occasionally makes a legitimately awkward case
harder to test. That friction is usually a signal about the component's design.

No coverage gate means coverage can quietly decline. Mitigated by expectations on specific paths
rather than a global number, and by collecting coverage in CI so the trend is visible even when it
is not enforced.

## Consequences

- **Unit tests** (Vitest, fast, no I/O): domain entities and calculations, Zod contract schemas,
  DTO-to-domain mappers, signal stores, pure utilities. These are expected to be thorough — they are
  cheap and they cover the logic where a wrong answer is silent.
- **Component tests** (TestBed + Testing Library): rendering, user interaction, form validation
  behaviour, conditional display. `HttpTestingController` for `data-access` services. Assertions are
  on rendered output and emitted events.
- **Integration tests** (Vitest + Testcontainers): NestJS controllers through to a real PostgreSQL
  with migrations applied, exercising authorization, ownership filtering, validation, transactions
  and constraints together. Every endpoint gets at least an authorized-success case and an
  unauthorized-access case, because the missing-ownership-filter bug is the one most likely to be
  written and the most damaging to ship.
- **End-to-end tests** (Playwright), a fixed small set: register and log in; log a workout session
  with sets; log a meal; view progress. Adding to this list requires a reason, since each test is a
  recurring maintenance cost.
- Analytical raw SQL is covered by integration tests specifically, since a typo in `$queryRaw` is
  invisible to the type checker.
- The offline outbox needs explicit tests for its failure modes: retry after timeout, duplicate
  suppression via idempotency key, queue behaviour on logout, orphaned entry after parent deletion.
  This is exactly the code where bugs are silent and destroy user data.
- Coverage is collected on every run and reported, but only `packages/contracts` and the `domain/`
  and `application/` directories carry an expectation of thoroughness, enforced in review. A numeric
  gate on those specific paths may be added once the code has settled.
- Test data uses builder helpers with sensible defaults, so a test states only what it cares about.
  Shared fixtures that many tests depend on become a coupling point and are avoided.

## Reversal trigger

Introduce a numeric coverage gate, scoped to domain and application paths, once the module structure
has stabilised — likely after phase 5. Reconsider the runner choice only if Vitest's NestJS support
causes recurring friction that Jest would not.
