# ADR-004 — Database engine and data access

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-002](./ADR-002-backend-framework.md), [ADR-013](./ADR-013-hosting-and-deployment.md), [ADR-014](./ADR-014-domain-model-conventions.md)

## Context

The data to persist falls into four groups: user identity and preferences; training (routines,
sessions, exercises, sets, with a long append-only history); nutrition (foods, recipes, diary
entries, targets); and progress (weight, measurements, personal records).

Two characteristics dominate. The data is **strongly hierarchical with hard integrity
requirements** — a set belongs to a session exercise, which belongs to a session, which belongs to
a user, and an orphaned or misattributed row corrupts a training history that cannot be
reconstructed from anywhere. And the interesting product features are **analytical**: estimated
one-rep-max progression over time, weekly training volume per muscle group, adherence rates,
personal-record detection, macro totals per day against targets.

The schema is well understood in advance. This is a domain that has been modelled many times; there
is no exploratory phase where the shape of an entity is unknown.

## Decision

**PostgreSQL** as the only datastore, accessed through **Prisma** for transactional work, with
`$queryRaw` for analytical queries, confined to repository classes.

## Alternatives considered

**MongoDB.** Its advantages are schema flexibility and a document shape that maps neatly onto a
nested "session with exercises with sets" aggregate — which is genuinely a good fit for the write
path of a workout. It loses on the rest. Schema flexibility solves a problem we do not have. Joins
across users, exercises, foods and recipes move into application code, which is slower and easier
to get wrong. Referential integrity becomes our responsibility, in a domain where losing it is
unrecoverable. And the analytical features need either an aggregation pipeline that is harder to
write and reason about than SQL, or a second system to run analytics in. Choosing MongoDB "because
it is more flexible" would be choosing flexibility we cannot spend against costs we would pay every
day.

**SQLite (with Turso or LiteFS).** Genuinely appealing for a single-tenant-per-user product, cheap
and simple, with excellent local development. Rejected because the multi-user model with a shared
food and exercise catalogue is not single-tenant, and because managed PostgreSQL is cheap enough
that the savings do not justify the operational unknowns.

**PostgreSQL with TypeORM.** Mature and Nest-idiomatic, with decorator-based entities that fit
NestJS naturally. Rejected for its migration story, which has historically produced surprising
generated migrations, and for the active-record/data-mapper ambiguity that tends to leak persistence
concerns into entities — exactly what we want to avoid in the domain layer.

**Drizzle.** A serious contender: closer to SQL, lighter, excellent TypeScript inference, no query
engine binary, and much better at complex analytical queries than Prisma. It loses narrowly on
migration ergonomics and on schema readability as documentation. It is the designated replacement
if the raw-SQL surface grows.

**Kysely (query builder only).** Excellent type-safe SQL. Rejected because it provides no migration
workflow, which would have to be assembled separately.

**Prisma.** Best-in-class developer experience, generated types that make the data layer hard to
misuse, a migration workflow that is predictable and reviewable, and a schema file that doubles as
readable documentation of the model. Its weakness is complex aggregation — which is why the raw-SQL
escape hatch is part of the decision rather than an afterthought.

## Reason

The domain is relational and the product features are analytical. That combination points at
PostgreSQL without much room for debate: window functions, CTEs, partial and composite indexes,
generated columns, and transactional guarantees on the write path. `JSONB` then covers the
genuinely semi-structured parts — cached external food payloads, user preferences, feature flags —
so document-style flexibility is available where it is useful without giving up integrity where it
is not.

Prisma is chosen for the 90% of data access that is straightforward, because typed queries and a
trustworthy migration workflow reduce the ongoing cost of change more than raw SQL performance
would help. The 10% that Prisma is bad at is exactly the part we are willing to write by hand.

## Trade-offs

Prisma's query builder cannot express the statistics queries we need, so the codebase will contain
two styles of data access. That is a real inconsistency, contained by the rule that raw SQL lives
only inside repository classes and returns explicitly typed read models.

Prisma adds a generated client to the build and a query engine to the runtime, and it is another
tool whose major versions must be tracked.

Connection management with Prisma against a pooled managed Postgres needs deliberate configuration;
connection exhaustion is a well-documented failure mode and must be load-checked before launch.

Relational modelling means the nested write path (a session with its exercises and sets) is several
tables and a transaction rather than one document write. Accepted, and the reason
[ADR-014](./ADR-014-domain-model-conventions.md) exists.

## Consequences

- One PostgreSQL database, EU region, managed. No second datastore is introduced without an ADR.
- Prisma migrations are committed, reviewed, applied in CI, and never edited after merge.
- Analytical queries live in repository classes as `$queryRaw` with explicit result types. They are
  covered by integration tests against a real database, because a typo in raw SQL is invisible to
  the type checker.
- Every user-owned table carries `user_id`, every index that supports a user-scoped query leads with
  it, and repository methods take the user identifier as a required parameter. Isolation is enforced
  in the query predicate.
- Indexes are created deliberately for the known access patterns: `(user_id, performed_at)` on
  sessions, `(user_id, date)` on diary entries, `(user_id, exercise_id, performed_at)` for
  progression queries.
- Domain entities are not Prisma models. Repositories map between them, which is what allows domain
  logic to be tested without a database and the schema to change without touching domain code.
- Local development uses PostgreSQL in Docker Compose, matching the production major version.

## Reversal trigger

Move to Drizzle if raw SQL grows beyond roughly a dozen queries, or if Prisma's connection handling
becomes a recurring production problem. The migration is mechanical for simple queries and free for
the raw ones, which is precisely why the raw SQL is isolated in repositories.
