# My Fit Tracker — Delivery Roadmap

Companion to [ARCHITECTURE.md](./ARCHITECTURE.md). This document defines the order of work, what
each phase deliberately excludes, and where the risk in each phase lies.

Phases are ordered by dependency, not by importance. No time estimates are given: with one
developer and no fixed deadline, estimates would be invented numbers that later get treated as
commitments.

Two rules govern the sequence:

**Each phase must leave the application in a deployable state.** A phase that ends with a
half-migrated schema or a broken build has no value and cannot be validated.

**The "do not build yet" list matters as much as the deliverables.** Scope creep in a solo project
does not announce itself; it arrives as a reasonable-sounding addition to the phase in progress.

---

## Phase 1 — Foundation

**Goal:** an empty but complete, deployable, verified pipeline. No product features.

**Progress as of 2026-08-24.** Resume with the Testcontainers proof (needs Docker Desktop), then
Playwright smoke, GitHub Actions, and a staging deploy. Do not start phase 2.

Done:

- npm workspaces: `apps/web`, `apps/api`, `packages/contracts`, `packages/config`.
- `.gitignore` no longer ignores `package-lock.json`; patterns are relative.
- Shared ESLint (including import boundaries, covered by `tools/boundaries.test.mjs`), Prettier,
  TypeScript 6.0.x hoisted. TypeScript 6 + Nest decorator metadata verified.
- `packages/contracts`: cursor pagination, RFC 9457 problem details, health schema. Dual CJS/ESM
  build; `npm run --workspaces` does **not** order dependencies, so root scripts run
  `contracts:build` first.
- NestJS API: `/api/v1/health`, typed config, `traceId`, RFC 9457 filter, Zod pipe, Helmet, CORS
  (including Capacitor origins), throttling. Same `createApp()` used by tests and `main`.
- Angular 22 app: standalone, zoneless, `application` builder, Tailwind, CDK. Health feature
  consumes the shared contract via `httpResource`. `ui/` does not fetch. Problem+json interceptor.
  Frontend boundary rules are live.
- Angular CLI refuses Node 24.11 (wants 24.15+). `apps/web/scripts/ng.cjs` skips that gate. Remove
  it after upgrading Node.
- PostgreSQL 17 via `docker-compose.yml` (database only). Prisma 6 with a throwaway
  `MigrationProbe` model and a committed migration. `/health` pings the database (`ok` /
  `degraded`). Prisma 6 is used because the API is CommonJS; Prisma 7's client is ESM-first and
  needs a driver adapter — a separate upgrade.

Not done yet:

- Testcontainers integration test **proven on this machine** (the test is written and skips when
  Docker is missing). Playwright smoke test.
- GitHub Actions PR pipeline and branch protection.
- Deploy empty apps to staging.

**Build:**

- npm workspaces monorepo: `apps/web`, `apps/api`, `packages/contracts`, `packages/config`.
- Fix `.gitignore`: stop ignoring `package-lock.json`, make patterns relative.
- Angular 22 application: standalone, zoneless, `application` build system, Tailwind and CDK, an
  empty shell with a route.
- NestJS 11 application on Fastify: health endpoint, typed and validated configuration, structured
  logging with request correlation, RFC 9457 exception filter, global Zod validation pipe, Helmet,
  throttling, CORS allow-list including the Capacitor origins.
- PostgreSQL via Docker Compose. Prisma initialised with one trivial model to prove the migration
  workflow end to end.
- `packages/contracts` with the shared primitives: pagination, problem details, common value objects.
- ESLint with import-boundary rules, Prettier, TypeScript strict mode across all workspaces.
- Vitest configured in all three workspaces, with one real test each. Testcontainers proven with one
  integration test. Playwright installed with one smoke test.
- GitHub Actions pull request pipeline: typecheck, lint, unit tests, build, integration tests.
  Branch protection requiring these checks.
- Deploy the empty applications to staging. A pipeline that has never deployed is not a pipeline.

**Dependencies:** none.

**Do not build yet:** authentication, any domain model beyond the throwaway Prisma model, UI
components beyond what proves the build, Capacitor, the service worker, production environment.

**Risks:**

- **TypeScript 6 versus NestJS decorator metadata — RESOLVED.** Verified: NestJS 11.2.1 compiles and
  runs under TypeScript 6.0.3 with decorator metadata intact, so a single hoisted TypeScript version
  is used. Note the two constraints this uncovered: the repository is pinned to TypeScript 6.0.x
  because Angular declares `typescript >=6.0 <6.1` even though TypeScript 7 is stable, and
  `moduleResolution: "node"` must not be used since it is removed in TypeScript 7. See
  [ARCHITECTURE.md](./ARCHITECTURE.md#technical-risks).
- Angular 22 deprecated the Webpack pipeline; the project must stay on the `application` build
  system, which is also required by the Vitest builder.
- Zoneless change detection can conflict with a dependency added later. Confirm early that the
  intended chart library works.
- Temptation to skip the deploy step. If the pipeline is not proven now, every later phase inherits
  an unknown.

---

## Phase 2 — Authentication

**Goal:** a user can register, verify their email, log in, stay logged in, and log out everywhere.

**Build:**

- `users` and `auth` modules: registration, login, refresh with rotation and reuse detection, logout,
  logout-all, password reset, email verification.
- Argon2id password hashing. Aggressive rate limiting and per-account lockout on auth endpoints.
  Enumeration-resistant responses.
- Refresh token storage: hashed, server-side, with family identifiers.
- Frontend: `core/auth` session service exposing read-only signals, HTTP interceptors for the bearer
  token and single-flight refresh, functional route guards, login and registration pages.
- `TokenStorage` port with the browser adapter. The native adapter is deferred to phase 10, but the
  port exists now so that nothing is written against a concrete storage.
- Transactional email adapter.
- Authorization skeleton: `users.role`, the `subscriptions` table, the entitlement resolution
  mechanism and the `@RequiresEntitlement` guard — all unused, no plans defined.
- Integration tests covering every auth flow, including the replay-detection path.

**Dependencies:** phase 1.

**Do not build yet:** social sign-in, MFA, plan definitions or paid features, admin interface,
account deletion beyond a basic hard delete.

**Risks:**

- This is the highest-risk phase in the project. Self-hosted authentication is where solo projects
  ship security defects ([ADR-008](./ADR/ADR-008-authentication.md)). Slow down here.
- The refresh-rotation path is subtle: concurrent requests hitting an expired token must not
  each trigger a rotation and invalidate each other. Single-flight refresh needs a test, not just
  care.
- Password reset tokens are a common weak point: single-use, short-lived, and invalidated on
  password change.
- Getting the token strategy wrong now is expensive to change once a mobile client exists.

---

## Phase 3 — User profile

**Goal:** the application knows who the user is in domain terms.

**Build:**

- Profile: display name, date of birth, sex, height, activity level.
- Preferences: unit system (kg/lb), timezone, week start day, locale.
- Goals: target weight, target date, objective (cut, maintain, bulk).
- Settings UI, using the shared form patterns that later phases will copy.
- GDPR groundwork: data export endpoint and hard account deletion.
- The first real `shared/ui` components, extracted from actual use rather than designed upfront.

**Dependencies:** phase 2.

**Do not build yet:** avatars and file uploads, notification preferences, onboarding flow,
integrations.

**Risks:**

- Timezone and unit preference are set here and consumed by every later feature. Getting the
  conventions in [ADR-014](./ADR/ADR-014-domain-model-conventions.md) wrong now propagates
  everywhere. Test the midnight boundary and the unit round trip explicitly.
- Premature abstraction of `shared/ui`: build the second use before extracting the component.

---

## Phase 4 — Exercises

**Goal:** a usable exercise catalogue, global plus user-authored.

**Build:**

- `Exercise` model: name, primary and secondary muscle groups, equipment, modality, instructions.
- Global catalogue seeded with a curated set. User-authored exercises with `owner_user_id`.
- Search and filter by muscle group, equipment and name, with cursor pagination.
- Exercise list and detail UI. First use of virtual scrolling if the list justifies it.

**Dependencies:** phase 3.

**Do not build yet:** exercise images or videos, community sharing of exercises, alternative and
substitution suggestions, translations.

**Risks:**

- **Internationalisation is decided implicitly here.** If exercise names need to be translatable,
  that is a data-model concern, and retrofitting translations into a seeded catalogue with user
  references is painful. This is an open decision in
  [ARCHITECTURE.md](./ARCHITECTURE.md#open-decisions) that should be closed before this phase.
- Seed data quality determines whether the product feels credible. A thin or wrong catalogue
  undermines everything built on top of it.
- Modelling exercise variants (barbell versus dumbbell, incline versus flat) as separate exercises
  or as attributes of one is a decision that affects progression tracking. Decide deliberately.

---

## Phase 5 — Workouts

**Goal:** the core loop. A user can plan a routine, perform it, and log every set.

**Build:**

- `Routine`, `RoutineDay`, `RoutineExercise` — the prescription side.
- `WorkoutSession`, `SessionExercise`, `SetEntry` — the execution side, strictly separate.
- Live logging screen: designed for one-handed use, large touch targets, rest timer, previous
  performance visible while logging.
- Session history with cursor pagination.
- Domain logic: volume calculation, estimated one-rep-max, personal-record detection emitted as a
  domain event.
- `Idempotency-Key` support on every mutating endpoint this feature uses.
- Local persistence of the in-progress session plus the outbox queue, with tests for its failure
  modes.
- Thorough unit tests on the calculations and integration tests on the ownership filters.

**Dependencies:** phase 4.

**Do not build yet:** supersets and circuits, progression algorithms and auto-regulation, plan
templates from other users, social sharing, full offline for anything other than the active session.

**Risks:**

- **The largest and most important phase.** Everything the product is for happens here.
- The prescription/execution separation must hold under pressure. It will feel like duplication
  while building it; collapsing it is unrecoverable once users have history
  ([ADR-014](./ADR/ADR-014-domain-model-conventions.md)).
- The outbox is where silent data-loss bugs live. Test the ugly paths: retry after timeout,
  duplicate suppression, logout with a pending queue, deleted parent session.
- The logging UI is the product's usability test. If it is slower than a notes app, nothing else
  matters.
- **The coach and sharing open decision should be closed before this phase**, because
  relationship-based authorization would change the ownership model that every endpoint here
  assumes.

---

## Phase 6 — Nutrition

**Goal:** a user can log what they eat and see it against a target.

**Build:**

- `FoodCatalogueProvider` port with the first adapter. Local caching with recorded provenance.
- User-authored foods, `FoodPortion` serving sizes.
- `Recipe` and `RecipeIngredient`, with computed nutritional totals.
- `DiaryEntry` with **snapshotted macros**, grouped by meal type and local calendar date.
- `NutritionTarget` with effective date ranges, and a daily progress view.
- Food search combining catalogue and user-authored foods.

**Dependencies:** phase 3. Independent of phases 4 and 5, so it could be resequenced.

**Do not build yet:** barcode scanning (needs Capacitor, phase 10), meal plans, recipe import from
URLs, photo recognition, water tracking, micronutrients beyond the main macros.

**Risks:**

- **The food data licensing open decision is unresolved** ([ADR-011](./ADR/ADR-011-nutrition-data-source.md)).
  Develop against the public-domain source so the codebase never contains an unresolved licence
  exposure.
- Snapshotting macros will feel redundant while building. It is not
  ([ADR-014](./ADR/ADR-014-domain-model-conventions.md)).
- External provider data quality, rate limits and downtime all need handling. Cache aggressively.
- Portion and unit maths is a quiet source of wrong numbers: grams versus servings versus millilitres
  versus "one medium banana". Normalise on import and test the conversions.

---

## Phase 7 — Progress

**Goal:** the user can see that something is changing.

**Build:**

- `BodyMeasurement`: weight, body fat estimate, circumferences, with configurable measurement types.
- `PersonalRecord` surfacing, derived from the events emitted in phase 5.
- Charts: weight trend with a moving average, per-exercise progression, volume over time.
- Habits: `HabitDefinition` and `HabitLog`, with streaks.
- Progress overview page.

**Dependencies:** phases 5 and 6 for data to display.

**Do not build yet:** progress photos (storage, and sensitive data), body composition scans,
predictive projections, PDF or image export.

**Risks:**

- Charting library choice affects bundle size, accessibility and zoneless compatibility. Evaluate
  before committing.
- Aggregation queries are the first place performance will be felt. Index first, measure, and only
  then consider materialised views ([ADR-014](./ADR/ADR-014-domain-model-conventions.md)).
- Raw daily weight is noisy and demotivating; a moving average is a product requirement, not a
  refinement.

---

## Phase 8 — Analytics and insight

**Goal:** derived insight rather than raw records. This is where paid value plausibly lives.

**Build:**

- Dashboard summary endpoint: today's targets, next planned session, recent records, streaks.
- Training analytics: volume per muscle group, frequency, intensity distribution, deload detection.
- Nutrition analytics: adherence, macro distribution trends, correlation with weight change.
- Composed read endpoints where the client would otherwise make many calls.
- Caching for expensive derived reads, with explicit invalidation.

**Dependencies:** phase 7.

**Do not build yet:** machine-learning recommendations, coaching advice, comparison against other
users.

**Risks:**

- **Scope is unbounded here.** Analytics can absorb unlimited effort. Pick the few views that change
  a user's behaviour and stop.
- Statistical claims must be defensible. A wrong "insight" is worse than no insight, particularly
  around nutrition and body weight.
- Query cost is real. This is the phase where materialised views may finally be justified — by
  measurement.

---

## Phase 9 — Premium

**Goal:** the product can charge money.

**Build:**

- Plan definitions in typed configuration, mapped to the entitlements built in phase 2.
- Quota enforcement where limits are quantitative.
- Stripe integration: checkout, customer portal, webhook handler updating `subscriptions` only.
- Upgrade and billing UI, plus honest gating on premium features.
- Forced token refresh after a plan change so an upgrade takes effect immediately.

**Dependencies:** phase 8, and a closed **monetisation open decision**
([ARCHITECTURE.md](./ARCHITECTURE.md#open-decisions)). Do not start without it — the mechanism is
built, but the policies are a product decision.

**Do not build yet:** multiple currencies, promotional codes, referral schemes, team or family
plans, annual-versus-monthly complexity beyond two options.

**Risks:**

- Webhook reliability: Stripe events arrive out of order, duplicated and late. The handler must be
  idempotent and tolerate reordering.
- **Apple's App Store rules on digital subscriptions** may require in-app purchase for the mobile
  build, which is a materially different integration and a revenue-share question. Investigate before
  committing to a billing model.
- Entitlement checks must be server-side everywhere. A single client-only gate is a free premium
  account ([ADR-009](./ADR/ADR-009-authorization-and-entitlements.md)).
- Getting a subscription state machine wrong produces billing disputes, which cost trust
  disproportionately.

---

## Phase 10 — Production hardening and mobile

**Goal:** something that can be given to strangers.

**Build:**

- Capacitor wrapper for iOS and Android; native `TokenStorage` adapter; barcode scanning; store
  listings and review submission.
- PWA service worker for the app shell; installability.
- Sentry on both applications with source maps and release tagging; uptime monitoring on a health
  endpoint that checks database connectivity.
- Application metrics and alerting on user-visible symptoms.
- Load and performance validation, including Prisma connection pooling under concurrency.
- Security review: dependency audit, CSP, headers, rate limits, a penetration-test pass over the
  auth flows.
- GDPR completion: consent flows, privacy policy, retention schedule, verified export and erasure.
- Backup restore actually tested.
- Accessibility audit.
- Production environment, runbook, and an incident checklist.

**Dependencies:** all previous phases.

**Do not build yet:** anything new. This phase is explicitly about finishing.

**Risks:**

- **The native token storage path is only exercised now**, so authentication bugs that only occur on
  mobile appear here. This is why the port exists from phase 2
  ([ADR-008](./ADR/ADR-008-authentication.md)).
- App store review can reject on subscription handling, health-data disclosures or privacy labels.
  Budget for iteration.
- Health-data compliance may require more than expected and is not an engineering decision. Resolve
  the open decision before launch, not during review.
- The temptation to add "one more feature" instead of hardening. A product that is 95% built and
  unhardened cannot be given to anyone.

---

## MVP scope

The MVP exists to answer one question: **will someone use this to log their training and food more
than twice?** Everything that does not serve that question is deferred, however cheap it looks.

Roughly, phases 1 through 6 with a thin slice of phase 7.

### MUST HAVE — no product without these

- Register, log in, stay logged in, log out.
- Profile with units, timezone and goal.
- Exercise catalogue with search, plus user-authored exercises.
- Create a routine.
- **Log a workout session: exercises, sets, reps, weight, RIR/RPE, rest.** The core loop.
- Session history.
- Food search against the catalogue, plus user-authored foods.
- **Log meals with calories and macros against a daily target.** The other core loop.
- Log body weight.
- A dashboard that answers "what do I do today" and "where am I against today's targets".
- Resilient set logging: local persistence of the active session plus a retrying outbox. Losing a
  logged workout is the one failure the MVP cannot have.

### SHOULD HAVE — strongly expected, ship soon after

- Personal-record detection and display.
- Weight trend chart with a moving average.
- Per-exercise progression chart.
- Recipes with computed totals.
- Body measurements beyond weight.
- Copy a previous session as a starting point — the highest-value convenience in the whole product.
- Installable PWA.
- Data export.

### COULD HAVE — valuable, not validating

- Habit tracking with streaks.
- Barcode scanning (requires the native build).
- Supersets and circuits.
- Rest-timer notifications.
- Training analytics: volume per muscle group, frequency, intensity distribution.
- Dark mode.
- Native mobile applications in the stores.
- Premium tier and billing.

### FUTURE — explicitly out of scope for now

- Full offline-first with bidirectional synchronisation.
- Wearable and health-platform integrations.
- Coach and client sharing.
- Social features, feeds, following.
- AI-generated training or nutrition recommendations.
- Progression algorithms and auto-regulation.
- Progress photos.
- Multi-language catalogues.
- A public API for third parties.
- An administrative back office beyond the minimum.

### Deliberately excluded from the MVP, with reasons

These are the ones most likely to creep in, so the reason is recorded:

- **Social features.** They multiply moderation, privacy and abuse surface, and they cannot be
  validated before there are users to be social with.
- **AI recommendations.** Impressive in a demo, and unfalsifiable without a validated core loop.
- **Full offline-first.** The expensive general solution to a problem that the scoped outbox already
  solves where it matters ([ADR-010](./ADR/ADR-010-mobile-and-offline-strategy.md)).
- **Billing.** Charging before knowing what people value means charging for the wrong thing.
- **Wearable integrations.** Each is a separate integration with its own deduplication rules, and
  none of them proves that the manual flow works.
