# ADR-010 — Mobile packaging and offline capability

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-001](./ADR-001-frontend-framework-and-ui.md), [ADR-003](./ADR-003-api-style.md), [ADR-008](./ADR-008-authentication.md)

## Context

The product must eventually be available as a mobile application, and the project owner has chosen
to reach that from the same Angular codebase rather than building a separate native application.

The connectivity requirement is specific rather than general. Most of the application — browsing
history, editing routines, reviewing statistics — is used somewhere with a usable connection.
**One flow is different**: logging sets during a workout, in a gym, often in a basement, with sets
recorded every 60 to 180 seconds over an hour. Losing that data is not a degraded experience, it is
losing the session the user came to record. Meanwhile, a full offline-first architecture —
bidirectional synchronisation, conflict resolution, possibly CRDTs — is one of the most expensive
things a small team can take on.

## Decision

**Capacitor** wrapping the same Angular application for iOS and Android. **PWA with a service
worker** for the web. Offline support is **scoped**, not global: the in-progress workout session is
persisted locally and its writes go through an outbox queue with idempotency keys. Everything else
requires connectivity. Full offline-first is explicitly deferred.

## Alternatives considered

**Ionic + Angular with Capacitor.** Would give a native-feeling component library designed for
mobile, which is a real benefit. Rejected because it means adopting Ionic's component system
alongside the Tailwind and CDK decision in
[ADR-001](./ADR-001-frontend-framework-and-ui.md) — two UI systems, or a rewrite of the web UI to
match. Capacitor without Ionic gives us native packaging and plugin access, which is what we
actually need.

**A separate native application** (Swift and Kotlin, or React Native, or Flutter). Better platform
integration and performance. Rejected on cost: it is a second and third codebase for one developer,
and the API contract would be the only shared asset. The application is form-driven, which is
precisely where a WebView is least noticeable.

**PWA only, no app stores.** Cheaper, no store review, instant updates. Rejected because it forfeits
store distribution, which is where fitness app users look, and because iOS PWA capability —
background execution, notifications, storage durability — remains materially weaker than native.

**Full offline-first from the start.** Local database as the source of truth, background
synchronisation, conflict resolution. Genuinely the best user experience. Rejected for the MVP
because the cost is enormous and largely invisible: last-write-wins is wrong for a shared food
catalogue, per-field merging needs a rule for every field, and offline deletes versus remote edits
need a policy. That work must be paid before the product has validated that anyone wants it.

**No offline support at all.** Rejected because it fails the one flow that matters. A user who loses
a logged workout to a dropped connection does not try again.

## Reason

The asymmetry in the requirement is the whole argument. One flow has an unacceptable failure mode;
the rest degrade acceptably. So we buy durability exactly where it is needed — local persistence of
the active session plus a retrying outbox — and skip the general solution.

Concretely: the in-progress session lives in IndexedDB and is the source of truth for the *active
session screen only*. Each set entry is queued with an `Idempotency-Key` and retried with backoff
until acknowledged. Because the server deduplicates on that key
([ADR-003](./ADR-003-api-style.md)), a retry after an ambiguous timeout cannot duplicate a set. This
is a small, well-understood amount of machinery: an append-only local queue, a retry loop and a
server-side key store. It is not a synchronisation engine — there is no bidirectional merge and no
conflict resolution, because a set entry is an immutable fact created on one device.

Capacitor is chosen because the application is forms and lists, where a WebView is nearly
indistinguishable from native, and because it gives us the two native capabilities that matter for
this design: OS secure storage for the refresh token
([ADR-008](./ADR-008-authentication.md)) and, later, more reliable background execution than a
browser allows.

## Trade-offs

WebView performance is below native for animation-heavy interfaces. Acceptable for this application;
it would not be for a game.

App store review adds a release step and the possibility of rejection, and Apple's rules on
subscriptions sold inside an application will matter when billing arrives — that is a commercial
constraint to plan for, not a technical one.

Scoped offline support means the rest of the application shows an offline state rather than working.
Users will notice and some will ask for more. That is the accepted limit of the MVP.

The outbox introduces a genuinely tricky class of bug: a queued write whose parent session was
deleted, a stale queue after a token expires, a queue that survives a logout. Each needs an explicit
rule.

Two client platforms mean two authentication code paths and platform-specific bugs
([ADR-008](./ADR-008-authentication.md)).

## Consequences

- The Angular application must be built to be packageable from day one: no server-side rendering
  (already decided), no dependency on same-origin cookies for anything except the web refresh flow,
  all API calls to an absolute configured base URL, and safe-area-aware layout.
- The CORS allow-list must include `capacitor://localhost` and `https://localhost`.
- A `TokenStorage` port with browser and native adapters, selected at bootstrap
  ([ADR-008](./ADR-008-authentication.md)).
- Angular's service worker is enabled for app-shell caching, so the application opens instantly and
  survives a flaky connection. Cached API responses are limited to genuinely static reference data,
  such as the exercise catalogue.
- The workout logging feature owns its local persistence and outbox. This is deliberately *not* a
  generic offline layer available to other features — generalising it prematurely is how the
  expensive version gets built by accident.
- Every mutating endpoint used by the outbox accepts `Idempotency-Key`, and the server persists key,
  request fingerprint and response for 24 hours.
- Outbox rules must be explicit and tested: a queue entry is dropped if its parent session no longer
  exists; the queue is cleared on logout; a failed authentication pauses rather than discards the
  queue; and the user is shown pending state rather than a false success.
- Touch targets, thumb reach and one-handed use are design constraints for the logging screens, not
  polish.

## Reversal trigger

Build genuine offline-first — a local database as the source of truth with bidirectional
synchronisation — only when there is evidence users need it: measured request failure rates during
workouts, or support requests about lost data outside the logging flow. At that point the natural
sequence is to extend the local-first model feature by feature rather than convert the whole
application at once.

Reconsider a native application only if a required capability is unavailable through a Capacitor
plugin, or if WebView performance becomes a recurring complaint.
