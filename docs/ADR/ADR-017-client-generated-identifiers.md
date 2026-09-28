# ADR-017 — Idempotency through client-generated identifiers

- Status: Accepted
- Date: 2026-09-28
- Related: [ADR-003](./ADR-003-api-style.md), [ADR-010](./ADR-010-mobile-and-offline-strategy.md), [ADR-014](./ADR-014-domain-model-conventions.md)
- Supersedes: the generic `Idempotency-Key` mechanism in [ADR-003](./ADR-003-api-style.md) and
  [ADR-010](./ADR-010-mobile-and-offline-strategy.md), for resource creation

## Context

The workout outbox ([ADR-010](./ADR-010-mobile-and-offline-strategy.md)) retries writes until they
are acknowledged. A retry after an ambiguous timeout must not create a duplicate set. That is the
one data-loss-grade bug the MVP cannot ship.

ADR-003 and ADR-010 solved this with an `Idempotency-Key` header on every mutating request. The
server stores the key, a fingerprint of the request and the response for 24 hours, and replays the
response on a retry. That is a table, a middleware, a fingerprint rule, an expiry job and a
concurrency rule for two requests with the same key arriving at the same time — all general
machinery for a problem that, in this domain, has a narrower shape.

## Decision

**Creation is made idempotent by letting the client choose the identifier.**

- The client generates a UUIDv7 for every resource it creates. UUIDv7 is time-ordered, so the
  primary-key index keeps good locality. The client sends it as `id` in the request body.
- The server inserts with `ON CONFLICT (id) DO NOTHING`, then reads the row by `(id, user_id)`.
  - If the row is found, it returns `201` with the row. A retry gets the same response as the
    original request.
  - If the row is not found, the id belongs to another user. The server returns `409` and leaks
    nothing about that row.
- Updates are expressed as absolute values (`PATCH` sets `reps: 8`, never "add one"), so repeating
  them is harmless.
- Deletes are idempotent in effect. The outbox treats a `404` on a retried delete as success.
- The contract schemas in `packages/contracts` make `id` a required UUID on create requests for
  resources that the outbox writes: sessions, session exercises and set entries. Other resources
  may use the same pattern. It is also safe for online-only creation.
- `Idempotency-Key` is reserved for an operation that is neither a creation with a natural identity
  nor an absolute update — a payment is the obvious future case. It is built when that operation
  appears.

## Alternatives considered

**`Idempotency-Key` with a stored response (ADR-003).** It is the general solution and works for
any operation. It loses because every write the MVP retries is either a creation or an absolute
update, and both are idempotent without the machinery.

**Server-generated ids plus duplicate detection on content** ("same exercise, weight and reps in the
last minute"). This is wrong: two identical sets in a row are legitimate and common.

**Natural keys** (session id plus set order). They break as soon as sets are reordered or inserted.

## Reason

With a client-chosen id, a resource's identity exists before the network call. The outbox can then
reference a set that the server has not acknowledged yet — for example to edit it — without mapping
temporary ids. A retry becomes a no-op in the database's own uniqueness check, which is the most
reliable deduplicator available. No extra table is needed.

## Trade-offs

- **The server trusts a client-chosen primary key.** This is safe because ownership is always part
  of the read predicate, and a collision with another user's id returns `409`. With UUIDv7, a real
  collision is practically impossible, so a `409` in practice means a buggy or hostile client.
- **The API is not idempotent for arbitrary operations.** A future non-idempotent operation needs
  the key mechanism at that point.
- UUIDs are 16 bytes against 8 for a `bigint`. That does not matter at this scale.

## Consequences

- User-owned tables whose rows can be created offline use `uuid` primary keys without a database
  default for client-created rows. Others may keep a database default.
- The outbox stores the full request including `id`, so a retry is byte-for-byte the same request.
- Integration tests cover: the same create request sent twice gives one row and two identical
  `201` responses; a create reusing another user's id returns `409` without revealing that row; a
  retried delete of a row that is already gone is treated as success.

## Reversal trigger

Build the general `Idempotency-Key` mechanism when the first mutation appears that has neither a
natural identity nor absolute semantics: a payment, a counter increment, or an operation with an
external side effect such as sending an email.
