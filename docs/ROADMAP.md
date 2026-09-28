# My Fit Tracker — Delivery Roadmap

Companion to [ARCHITECTURE.md](./ARCHITECTURE.md). This document defines the order of work, what
each phase deliberately excludes, and where the risk in each phase lies.

Phases are ordered by dependency, not by importance. No time estimates are given: with one
developer and no fixed deadline, estimates would be invented numbers that later get treated as
commitments.

Three rules govern the sequence:

**Each phase must leave the application in a deployable state.** A phase that ends with a
half-migrated schema or a broken build has no value and cannot be validated.

**The "do not build yet" list matters as much as the deliverables.** Scope creep in a solo project
does not announce itself; it arrives as a reasonable-sounding addition to the phase in progress.

**Phases 1 to 6 plus the MVP milestone are the MVP; everything after is a backlog.** Phases 7 to 10
are ordered by what the architecture needs, but their contents get reprioritised by what beta
testers actually ask for.

### Scope review, 2026-09-28

The plan was reviewed against what a closed-beta MVP actually needs. The changes, and the decision
behind each one:

| Change                                                                        | Where                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Zero-cost hosting (Koyeb, Neon, Cloudflare Pages) with a same-origin proxy    | [ADR-015](./ADR/ADR-015-zero-cost-mvp-hosting.md)                   |
| Opaque server-side sessions instead of JWT plus rotating refresh tokens       | [ADR-016](./ADR/ADR-016-opaque-server-sessions.md)                  |
| Client-generated ids instead of a generic `Idempotency-Key` store             | [ADR-017](./ADR/ADR-017-client-generated-identifiers.md)            |
| Spanish and English from phase 2                                              | [ADR-018](./ADR/ADR-018-internationalisation.md)                    |
| Closed beta by invitation; email verification deferred                        | Phase 2                                                             |
| Profile reduced to preferences and account deletion; goals deferred           | Phase 3                                                             |
| Routines without a `RoutineDay` level; "repeat last session" promoted to MUST | Phase 5                                                             |
| User-authored foods and quick-add only; external catalogue and recipes later  | Phase 6, phase 7                                                    |
| Entitlement and subscription skeleton moved from phase 2 to phase 9           | Phase 9, [ADR-009](./ADR/ADR-009-authorization-and-entitlements.md) |
| Sentry moved from phase 10 to the MVP milestone                               | MVP milestone                                                       |
| Coach and client sharing closed as out of scope: one owner per resource       | [ARCHITECTURE.md](./ARCHITECTURE.md#open-decisions)                 |

---

## Phase 1 — Foundation

**Goal:** an empty but complete, deployable, verified pipeline. No product features.

**Progress as of 2026-09-28.** The code is complete. The Railway trial expired before the first
deploy, so hosting moved to a zero-cost setup ([ADR-015](./ADR/ADR-015-zero-cost-mvp-hosting.md)).
Resume by implementing that change in CI and running the first real deploy. Do not start phase 2
before the deploy has succeeded.

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
- Playwright smoke: the health page renders a payload from the API. In CI it runs against the
  two apps plus a Postgres service.
- GitHub Actions pull request pipeline: typecheck, lint, format, unit tests, production build,
  Testcontainers integration, Playwright smoke. Dependabot grouped monthly updates.
- API multi-stage Dockerfile. Web runtime `app-config.json` for the API origin.

Not done yet:

- **Move the deploy to ADR-015:**
  - Pages Function proxy in `apps/web/functions/` for `/api/*`, with `app-config.json` pointing at
    the web app's own origin.
  - Migrations run from CI against Neon instead of the container entrypoint.
  - A Koyeb redeploy from CI replaces the Railway step; `railway.json` is removed.
  - A liveness path that does not touch the database, for the Koyeb health check.
  - README and secrets list updated.
- The first live deploy, checked end to end through the Pages origin.
- Branch protection requiring the CI checks.
- A green CI run confirmed on GitHub. The Testcontainers test runs there; it skips on a machine
  without Docker.

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
- Deploy the empty applications. A pipeline that has never deployed is not a pipeline.

**Dependencies:** none.

**Do not build yet:** authentication, any domain model beyond the throwaway Prisma model, UI
components beyond what proves the build, Capacitor, the service worker, a production environment
separate from the single MVP deployment.

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
- Free-tier quotas: a health check that pings the database every few minutes keeps Neon awake and
  exhausts its compute hours by mid-month ([ADR-015](./ADR/ADR-015-zero-cost-mvp-hosting.md)).

---

## Phase 2 — Accounts

**Goal:** an invited tester can register, log in, stay logged in, reset a forgotten password and log
out — in Spanish or English.

**Build:**

- **Internationalisation foundation** ([ADR-018](./ADR/ADR-018-internationalisation.md)):
  `@angular/localize`, `es` and `en` builds with the build failing on missing translations, the root
  locale redirect, per-locale SPA fallback on Pages, locale data for dates and numbers, error
  messages chosen by problem `code`, and a locale-aware Zod error map. It is built first so that no
  screen ever exists without translation markers.
- `users` and `auth` modules with **opaque server-side sessions**
  ([ADR-016](./ADR/ADR-016-opaque-server-sessions.md)): register, login, logout, logout-all,
  `GET /auth/session`, password reset. Argon2id. Aggressive rate limiting and per-account lockout on
  auth endpoints. Enumeration-resistant responses. `Origin` check on cookie-authenticated writes.
- **Registration by invitation.** An `invitations` table holds single-use, expiring random codes,
  each bound to one email address. Registering requires a code matching the email. Codes are created
  with a CLI script (`npm run invite -- someone@example.com`); there is no admin UI. Binding the
  invite to an email is what allows email verification to wait.
- **Consent at registration.** An explicit checkbox for processing health-related data, stored with
  a timestamp and the version of the privacy notice. A short privacy notice page in both languages.
- `MailSender` port with one adapter on a free transactional-email tier, and a console adapter for
  development and tests. The password-reset email is templated in both locales.
- Frontend: `core/auth` exposing the current user as a read-only signal, a `401` handler that
  routes to login, functional route guards, and login, registration and password-reset pages.
- The first `shared/ui` primitives (button, text field, form field with error), used by at least two
  of those pages.
- Integration tests covering every auth flow, including revoked and expired sessions, a
  disallowed `Origin`, a reused reset token, and an invite used twice or with a different email.

**Dependencies:** phase 1.

**Do not build yet:** email verification, social sign-in, MFA, a device-list UI, roles beyond a
`role` column, entitlements, subscriptions or plans (phase 9), an admin interface, open
registration.

**Risks:**

- This is still the highest-risk phase. Sessions remove the rotation logic, not the rest: password
  reset tokens must be single-use, short-lived, stored hashed, and every session must be revoked when
  a reset succeeds.
- Argon2id on a 0.1 vCPU instance is slow. Measure login latency; do not weaken the parameters to
  hide it.
- CSRF is in scope because authentication uses a cookie. The `Origin` check needs a test that fails
  without it.
- i18n adds cost to every screen from now on. Resist shipping "English for now" strings.

---

## Phase 3 — Settings

**Goal:** the application knows the preferences every later feature depends on, and a user can leave.

**Build:**

- `UserPreferences`: timezone (detected from the browser at registration and editable), unit system
  (kg or lb), locale (`es` or `en`).
- Hard account deletion: domain data, sessions and invitations, irreversibly. A confirmation step
  in the UI.
- A settings page using the form pattern that later phases copy.

**Dependencies:** phase 2.

**Do not build yet:** body goals (target weight, date, objective), data export (phase 7), avatars
and file uploads, notification preferences, onboarding flow, integrations. The daily nutrition
target lives in phase 6, next to the diary that uses it.

**Risks:**

- Timezone and unit preference are consumed by every later feature. Getting the conventions in
  [ADR-014](./ADR/ADR-014-domain-model-conventions.md) wrong now propagates everywhere. Test the
  midnight boundary and the unit round trip explicitly.
- Premature abstraction of `shared/ui`: build the second use before extracting the component.

---

## Phase 4 — Exercises

**Goal:** a usable exercise catalogue in both languages, global plus user-authored.

**Build:**

- `Exercise` model: stable `key`, primary and secondary muscle groups, equipment and modality as
  enum codes. Global names and instructions live in `exercise_translations` per locale; a
  user-authored exercise has a single `name` ([ADR-018](./ADR/ADR-018-internationalisation.md)).
- Global catalogue seeded with a curated set, in both `es` and `en`. User-authored exercises with
  `owner_user_id`.
- Search by name in the user's locale, filter by muscle group and equipment, with cursor pagination.
- Exercise list and detail UI, plus a quick "create exercise" from the logging flow.

**Dependencies:** phase 3.

**Do not build yet:** exercise images or videos, community sharing of exercises, alternative and
substitution suggestions, locales beyond `es` and `en`.

**Risks:**

- Seed data quality determines whether the product feels credible. A thin or wrong catalogue
  undermines everything built on top of it, and every entry now needs two correct names.
- Modelling exercise variants (barbell versus dumbbell, incline versus flat) as separate exercises
  or as attributes of one is a decision that affects progression tracking. Decide deliberately.

---

## Phase 5 — Workouts

**Goal:** the core loop. A user can plan a routine, perform it, and log every set without losing
any of it.

**Build:**

- `Routine` and `RoutineExercise` (target sets, rep range, rest, notes) — the prescription side. A
  training "day" is simply another routine ("Push A", "Legs"). Grouping routines into a program is
  deferred.
- `WorkoutSession` (local `performed_on` date, `started_at`, `finished_at`, optional source routine),
  `SessionExercise`, `SetEntry` (reps, `weight_kg`, RIR or RPE, `rest_seconds`, order) — the
  execution side, strictly separate.
- Start a session from a routine, from scratch, or by **repeating the last session**. The last one
  is the most valuable convenience in the product, and cheap once sessions exist.
- Live logging screen: designed for one-handed use, large touch targets, rest timer, previous
  performance visible while logging.
- Session history with cursor pagination.
- Domain logic: volume calculation and estimated one-rep-max.
- **Client-generated UUIDv7 ids** on sessions, session exercises and set entries
  ([ADR-017](./ADR/ADR-017-client-generated-identifiers.md)).
- Local persistence of the in-progress session plus the outbox queue, with tests for its failure
  modes.
- Thorough unit tests on the calculations and integration tests on the ownership filters.

**Dependencies:** phase 4.

**Do not build yet:** supersets and circuits, programs grouping routines, personal-record detection
(phase 7), progression algorithms and auto-regulation, plan templates from other users, social
sharing, full offline for anything other than the active session.

**Risks:**

- **The largest and most important phase.** Everything the product is for happens here.
- The prescription/execution separation must hold under pressure. It will feel like duplication
  while building it; collapsing it is unrecoverable once users have history
  ([ADR-014](./ADR/ADR-014-domain-model-conventions.md)).
- The outbox is where silent data-loss bugs live. Test the ugly paths: retry after timeout,
  duplicate suppression by id, logout with a pending queue, deleted parent session.
- The logging UI is the product's usability test. If it is slower than a notes app, nothing else
  matters.

---

## Phase 6 — Nutrition

**Goal:** a user can log what they eat and see it against a daily target.

**Build:**

- User-authored `Food` with nutrients normalised per 100 g, and `FoodPortion` serving sizes
  ("1 slice = 30 g").
- **Quick add:** a diary entry with calories and macros typed directly and an optional label, with no
  food behind it.
- `DiaryEntry` with **snapshotted macros**, grouped by meal type and local calendar date, with
  client-generated ids.
- Recent and frequent foods, so that logging a food for the second time is two taps.
- `NutritionTarget` (daily calories and macros) with effective date ranges, and a daily progress
  view.

**Dependencies:** phase 3. Independent of phases 4 and 5, so it could be resequenced.

**Do not build yet:** the external food catalogue and recipes (phase 7), barcode scanning (needs
Capacitor, phase 10), meal plans, photo recognition, water tracking, micronutrients beyond the main
macros.

**Risks:**

- **Manual food entry is friction.** Recents and quick-add are the mitigation. Whether testers ask
  for a catalogue first is the main question the beta answers about nutrition.
- Snapshotting macros will feel redundant while building. It is not
  ([ADR-014](./ADR/ADR-014-domain-model-conventions.md)).
- Portion and unit maths is a quiet source of wrong numbers. Normalise on entry and test the
  conversions.

---

## MVP milestone — closed beta

**Goal:** put the MVP in front of invited testers, with a way to know whether it worked.

**Build:**

- Body weight logging: a `BodyMeasurement` restricted to weight, with a list of recent entries.
- A **Today** screen: macros against today's target, start a session (from a routine, or repeat the
  last one), log today's weight.
- Sentry on the web app and the API on the free plan, with release tagging. An unreported frontend
  exception is invisible otherwise.
- One Neon restore, actually performed and documented.
- The privacy notice reviewed, and the first invitations sent.
- A saved SQL query giving, per tester, the number of distinct days with a logged session or diary
  entry. That number answers the MVP question.

**Dependencies:** phases 5 and 6.

**Do not build yet:** anything from phases 7 to 10, until testers have used the product for a couple
of weeks.

---

## Phase 7 — Progress and catalogue

**Goal:** the user can see that something is changing, and logging food takes less typing. This is
the first post-MVP phase; its contents are reordered by beta feedback.

**Build:**

- `PersonalRecord` detection on set entries, emitted as a domain event, and surfaced in the UI.
- Charts: weight trend with a moving average, per-exercise progression, volume over time.
- `BodyMeasurement` beyond weight: body fat estimate, circumferences, configurable types.
- Habits: `HabitDefinition` and `HabitLog`, with streaks.
- Food catalogue: the `FoodCatalogueProvider` port with its first adapter, local caching with
  recorded provenance ([ADR-011](./ADR/ADR-011-nutrition-data-source.md)). Catalogue names need a
  locale answer ([ADR-018](./ADR/ADR-018-internationalisation.md)).
- `Recipe` and `RecipeIngredient`, with computed nutritional totals.
- Installable PWA with app-shell caching.
- Data export.

**Dependencies:** the MVP milestone.

**Do not build yet:** progress photos (storage, and sensitive data), body composition scans,
predictive projections, PDF or image export.

**Risks:**

- Charting library choice affects bundle size, accessibility and zoneless compatibility. Evaluate
  before committing.
- Aggregation queries are the first place performance will be felt. Index first, measure, and only
  then consider materialised views ([ADR-014](./ADR/ADR-014-domain-model-conventions.md)).
- Raw daily weight is noisy and demotivating; a moving average is a product requirement, not a
  refinement.
- **The food data licensing open decision is unresolved**
  ([ADR-011](./ADR/ADR-011-nutrition-data-source.md)). USDA is licence-safe but English-only and
  weak on European products. Resolve before choosing the adapter.

---

## Phase 8 — Analytics and insight

**Goal:** derived insight rather than raw records. This is where paid value plausibly lives.

**Build:**

- Richer Today and dashboard: next planned session, recent records, streaks.
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

- The authorization skeleton from [ADR-009](./ADR/ADR-009-authorization-and-entitlements.md): the
  `subscriptions` table, per-user entitlement overrides, entitlement resolution and the
  `@RequiresEntitlement` guard. Deferred from phase 2 because nothing used it; adding it is an
  additive migration.
- Plan definitions in typed configuration, mapped to those entitlements.
- Quota enforcement where limits are quantitative.
- Stripe integration: checkout, customer portal, webhook handler updating `subscriptions` only.
- Upgrade and billing UI, plus honest gating on premium features.

**Dependencies:** phase 8, and a closed **monetisation open decision**
([ARCHITECTURE.md](./ARCHITECTURE.md#open-decisions)). Do not start without it — the mechanism is
architecture, but the policies are a product decision.

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

- Paid, always-on hosting and a production environment separate from the beta, as the reversal
  trigger in [ADR-015](./ADR/ADR-015-zero-cost-mvp-hosting.md) requires. A custom domain.
- Capacitor wrapper for iOS and Android; the native `SessionTokenStorage` adapter; barcode scanning;
  store listings and review submission.
- Open registration with email verification, replacing invitations.
- Sentry source maps; uptime monitoring on a health endpoint that checks database connectivity.
- Application metrics and alerting on user-visible symptoms.
- Load and performance validation, including Prisma connection pooling under concurrency.
- Security review: dependency audit, CSP, headers, rate limits, a penetration-test pass over the
  auth flows.
- GDPR completion: consent flows, privacy policy, retention schedule, verified export and erasure.
- Accessibility audit.
- Runbook and an incident checklist.

**Dependencies:** all previous phases.

**Do not build yet:** anything new. This phase is explicitly about finishing.

**Risks:**

- **The native session-token path is only exercised now**, so authentication bugs that only occur on
  mobile appear here ([ADR-016](./ADR/ADR-016-opaque-server-sessions.md)).
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

The MVP is phases 1 to 6 plus the MVP milestone, delivered as a **closed beta**: the developer and
invited testers, in Spanish and English, on zero-cost hosting.

### MUST HAVE — no product without these

- Register with an invitation, log in, stay logged in, reset a password, log out.
- Spanish and English throughout.
- Preferences for units, timezone and language. Account deletion.
- Exercise catalogue with search, plus user-authored exercises.
- Create a routine.
- **Log a workout session: exercises, sets, reps, weight, RIR/RPE, rest.** The core loop.
- Repeat the last session as a starting point.
- Session history.
- User-authored foods, quick-add, and recent foods.
- **Log meals with calories and macros against a daily target.** The other core loop.
- Log body weight.
- A Today screen that answers "what do I do today" and "where am I against today's targets".
- Resilient set logging: local persistence of the active session plus a retrying outbox. Losing a
  logged workout is the one failure the MVP cannot have.
- Error tracking, so that testers' failures are visible without them reporting them.

### SHOULD HAVE — first candidates after the beta

- Personal-record detection and display.
- Weight trend chart with a moving average.
- Per-exercise progression chart.
- Food catalogue search.
- Recipes with computed totals.
- Body measurements beyond weight.
- Installable PWA.
- Data export.

### COULD HAVE — valuable, not validating

- Habit tracking with streaks.
- Barcode scanning (requires the native build).
- Supersets and circuits.
- Programs grouping several routines.
- Rest-timer notifications.
- Training analytics: volume per muscle group, frequency, intensity distribution.
- Dark mode.
- Native mobile applications in the stores.
- Premium tier and billing.

### FUTURE — explicitly out of scope for now

- Full offline-first with bidirectional synchronisation.
- Wearable and health-platform integrations.
- Coach and client sharing (closed as out of scope on 2026-09-28).
- Social features, feeds, following.
- AI-generated training or nutrition recommendations.
- Progression algorithms and auto-regulation.
- Progress photos.
- Locales beyond Spanish and English.
- A public API for third parties.
- An administrative back office beyond the invitation script.

### Deliberately excluded from the MVP, with reasons

These are the ones most likely to creep in, so the reason is recorded:

- **Social features.** They multiply moderation, privacy and abuse surface, and they cannot be
  validated before there are users to be social with.
- **AI recommendations.** Impressive in a demo, and unfalsifiable without a validated core loop.
- **Full offline-first.** The expensive general solution to a problem that the scoped outbox already
  solves where it matters ([ADR-010](./ADR/ADR-010-mobile-and-offline-strategy.md)).
- **Billing and the entitlement skeleton.** Charging before knowing what people value means charging
  for the wrong thing, and a mechanism with no consumer is maintenance without benefit.
- **Wearable integrations.** Each is a separate integration with its own deduplication rules, and
  none of them proves that the manual flow works.
- **An external food catalogue.** It carries an unresolved licence question and a translation
  problem. Whether testers need it before anything else is itself something the beta measures.
- **Open registration.** It brings email verification, abuse handling and a fuller GDPR posture,
  none of which a closed beta needs.
