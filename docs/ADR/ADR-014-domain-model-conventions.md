# ADR-014 — Domain model conventions

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-004](./ADR-004-database-and-orm.md), [ADR-007](./ADR-007-shared-contracts.md), [ADR-011](./ADR-011-nutrition-data-source.md)

## Context

This ADR records modelling conventions rather than a technology choice, because in this domain the
modelling decisions are more consequential than most tool selections. Each convention below exists
because violating it produces a specific bug that is cheap to prevent now and very expensive to fix
after real user data exists — in several cases, unfixable, because the information needed to repair
the data was never recorded.

No tables are created at this stage. These are the rules the schema must satisfy when it is written
in phases 4 to 7.

## Decision

Seven conventions, binding on the schema, the domain layer and the contract package.

### 1. Prescription is separate from execution

`Routine`, `RoutineDay` and `RoutineExercise` describe a **plan**. `WorkoutSession`,
`SessionExercise` and `SetEntry` describe **what happened**. A session may record which routine it
came from, but never depends on it for its content.

_Alternative considered:_ one `Workout` entity with a `isTemplate` flag, reused for both. Simpler,
and the most common shortcut.

_Why it loses:_ the two things have different lifecycles. Plans get edited — an exercise swapped, a
target changed, a day reordered. If history points at the plan for its content, editing next month's
routine silently rewrites last month's training log. The user's progression data, which is the entire
value of the product, becomes unreliable. There is no recovery from this without a full audit trail
that a flag-based model does not have.

### 2. History stores snapshots, not just references

A `DiaryEntry` records the computed calories and macronutrients at the moment of logging, alongside
the food reference. A `SetEntry` records the exercise identity it was performed against.

_Alternative considered:_ store only foreign keys and compute totals on read, which normalises
properly and avoids duplicated data.

_Why it loses:_ the referenced data is not stable. External catalogue foods get corrected and
re-imported ([ADR-011](./ADR-011-nutrition-data-source.md)); user-authored foods get edited. With
references alone, correcting a food's protein value retroactively changes what the user ate three
months ago. For someone tracking a deficit, a diary that rewrites the past is worse than no diary.
Normalisation is the right default and this is a deliberate, bounded exception for immutable
historical facts.

### 3. Units are canonical in storage, localised in presentation

Storage uses SI: grams, kilograms, metres, seconds. The user's kilogram or pound preference lives on
`UserPreferences` and is applied only in the presentation layer.

_Alternative considered:_ store values in the unit the user entered, with a unit column per row.

_Why it loses:_ every aggregate then has to convert before summing, and one forgotten conversion
produces a total that is wrong by a factor of 2.2 — plausible enough to go unnoticed and corrupting
every statistic downstream. Mixed-unit rows also make indexing and comparison meaningless. Column
names carry the unit (`weight_kg`, `duration_seconds`) so a wrong assumption is visible at the call
site.

### 4. A workout or diary date is a local calendar date, not a timestamp

The date a session or diary entry belongs to is stored as `DATE`, with the user's timezone on their
profile. Precise instants, where needed, are stored separately as `timestamptz`.

_Alternative considered:_ a single UTC timestamp, converted for display.

_Why it loses:_ a meal logged at 23:30 local time is stored as the following day in UTC for much of
Europe. Every daily total, every streak calculation and every "today's macros" view is then wrong for
late-evening entries — a bug that appears intermittently, only for some users, only at some times of
day, which makes it very hard to diagnose from a report. "What day did this belong to" is a question
about the user's calendar, not about an instant in time, so it is stored as a calendar date.

### 5. Deletion has two distinct meanings

Soft delete for user-visible history, so an accidental tap is recoverable. Hard, irreversible delete
for GDPR erasure requests.

_Alternative considered:_ soft delete everywhere.

_Why it loses:_ soft delete does not satisfy a right-to-erasure request. Conflating them means either
users cannot undo a mistake, or the product cannot honour a legal obligation. They are different
operations with different guarantees and need separate implementations, with the hard delete
cascading to tokens, audit rows and cached data.

### 6. Derived data is computed on read until measured otherwise

Personal records, weekly volume and estimated one-rep-max progression start as indexed queries.
Materialised views or summary tables are introduced when a query is measurably slow.

_Alternative considered:_ maintain denormalised aggregate tables from the start.

_Why it loses:_ every maintained aggregate is a consistency obligation — a write path that can drift
from its source, and a repair job when it does. Postgres handles years of one user's training data
without difficulty. Introducing caches before measuring is paying maintenance cost for a performance
problem that does not exist. Note the asymmetry with convention 2: a _historical snapshot_ is a
deliberately immutable fact, not a cache of a live calculation.

### 7. Every user-owned row carries `user_id`, and every query filters on it

Tenant isolation is enforced in the query predicate at the repository layer. Repository methods take
the user identifier as a required parameter.

_Alternative considered:_ rely on ownership checks in the service layer after loading, or on
PostgreSQL row-level security.

_Why it loses:_ a check performed after loading is a check that can be forgotten on the next
endpoint, and the failure mode is a data leak rather than an error. Filtering in the predicate makes
the failure mode "no rows returned", which is safe. Row-level security is a legitimate stronger
option and worth revisiting, but it splits authorization logic between the application and the
database, which is harder to reason about and to test at this size.

## Consequences

- These conventions are binding on the Prisma schema, the domain layer and the contract package, and
  are encoded in [.cursor/rules/architecture.mdc](../../.cursor/rules/architecture.mdc) so they are
  applied during development rather than discovered in review.
- Column naming carries units and semantics: `weight_kg`, `duration_seconds`, `performed_on` (date)
  versus `created_at` (timestamp).
- Unit conversion happens in exactly two places: the frontend mapper on the way out to the user and
  on the way back in. Nowhere else converts.
- Domain entities are not Prisma models. Mappers translate, which is what allows both to change
  independently.
- Every user-scoped table has a composite index leading with `user_id`.
- Snapshot fields on historical rows are immutable after creation; the domain layer enforces this
  rather than relying on nobody writing an update.
- Timezone handling needs explicit test coverage, including a user who changes timezone and entries
  made near midnight. This is the convention most likely to be violated by accident.

## Reversal trigger

Introduce materialised views or summary tables when a statistics query exceeds roughly 200 ms on a
realistic data volume — measured, not estimated.

Reconsider PostgreSQL row-level security if the product ever gains multi-user data sharing (the coach
feature open decision), since defence in depth becomes more valuable when more than one user can
legitimately reach a row.
