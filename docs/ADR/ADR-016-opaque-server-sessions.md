# ADR-016 — Opaque server-side sessions

- Status: Accepted
- Date: 2026-09-28
- Related: [ADR-008](./ADR-008-authentication.md), [ADR-009](./ADR-009-authorization-and-entitlements.md), [ADR-010](./ADR-010-mobile-and-offline-strategy.md), [ADR-015](./ADR-015-zero-cost-mvp-hosting.md)
- Supersedes: the token design of [ADR-008](./ADR-008-authentication.md) (access JWT plus rotating
  refresh token). ADR-008's other rules — self-hosted, Argon2id, rate limiting, lockout,
  enumeration resistance — still apply and are restated below.

## Context

ADR-008 chose a 15-minute access JWT and a rotating, server-stored refresh token with reuse
detection. It chose it for two reasons: to provide revocation, and to cope with Capacitor, where
cookies to a cross-site API are unreliable.

Reviewing the plan for the MVP changed the inputs:

- **The MVP is a closed beta** for the developer and invited testers
  ([ROADMAP.md](../ROADMAP.md#mvp-scope)). There is no mobile build until phase 10.
- **The web app and the API now share an origin.** Cloudflare Pages proxies `/api/*` to the API
  ([ADR-015](./ADR-015-zero-cost-mvp-hosting.md)), so a cookie is first-party.
- **The server-side refresh token already makes every refresh a database read.** The JWT only saves
  lookups on the requests in between. At beta scale that saving is not measurable.

What the JWT design costs is real. There are two token types, rotation, family revocation,
reuse detection, a single-flight refresh in the HTTP interceptor with concurrent requests queued
behind it, and entitlement claims that go stale for 15 minutes. ADR-008 itself names this as the
code most likely to ship a security defect.

## Decision

Authenticate with **one opaque, random session token** per login. It is stored server-side as a
hash and looked up on every request.

- **Token:** 32 bytes from a CSPRNG, base64url. Only its SHA-256 hash is stored. A fast hash is
  correct here, because the token has 256 bits of entropy and cannot be brute-forced. Argon2id is
  for low-entropy passwords.
- **Table:** `sessions(id, user_id, token_hash UNIQUE, created_at, last_used_at, expires_at,
user_agent)`.
- **Lifetime:** 30 days of inactivity, and 90 days absolute. `last_used_at` and `expires_at` are
  extended at most once per hour, so reads do not turn into writes on every request.
- **Web transport:** a `__Host-session` cookie with `HttpOnly; Secure; SameSite=Strict; Path=/`.
  JavaScript never sees the token.
- **Native transport (phase 10):** the same token, kept in OS secure storage and sent as
  `Authorization: Bearer <token>`. The API accepts either transport. There is only one kind of
  token.
- **CSRF:** the cookie is `SameSite=Strict`, and every non-GET request carrying the cookie must have
  an `Origin` header that is on the allow-list. Otherwise it is rejected with `403`. Bearer requests
  are not subject to CSRF.
- **Revocation:** logout deletes the row. "Log out everywhere", a password change and a password
  reset delete all of the user's rows. Login always issues a new token, which rules out session
  fixation.
- **Authorization context:** the session lookup joins the user and loads `role`. There are no claims
  to go stale.
- **Unchanged from ADR-008:** Argon2id with parameters reviewed against current guidance, even on the
  0.1 vCPU instance. Aggressive rate limits and per-account lockout on authentication endpoints.
  Enumeration-resistant responses and timing. Social sign-in later, behind the `IdentityProvider`
  port.

## Alternatives considered

**Keep ADR-008 (access JWT plus rotating refresh token).** It is correct and it scales without a
per-request lookup. It loses because its advantage — stateless verification — matters with many
services or edge verification, and we have one container. Its complexity is concentrated in exactly
the code that is dangerous to get wrong.

**Better Auth or a similar library.** It would provide password reset, verification and sessions
out of the box. We did not choose it because the part it saves is small once JWTs are gone, while
the integration with NestJS on Fastify and with our own `users` table is unproven. It would also
bring its own schema and conventions into the most sensitive module. It is worth reconsidering if
MFA or several social providers become requirements.

**A managed provider (Auth0, Clerk, Supabase Auth).** The reasons in ADR-008 still hold: identity is
inseparable from domain data, pricing is per user, and it creates vendor coupling.

**A JWT stored in `localStorage`.** Rejected in ADR-008, and still rejected. XSS can read it.

## Reason

A server-side session is the simplest design that satisfies every requirement ADR-008 listed:
instant revocation, "log out everywhere", a device list for free (it is the `sessions` table), and
a Capacitor path that does not depend on cookies. It reaches all of those with one token type and
no client-side refresh logic. The one thing it gives up, stateless verification, is something this
architecture never used. ADR-008 already read the database on every refresh.

## Trade-offs

- **One indexed database read per authenticated request.** That is negligible at this scale. When it
  stops being negligible, a short in-process cache keyed by token hash is a contained change.
- **Neon has to be awake to authenticate.** After the database suspends, the first request pays its
  resume time ([ADR-015](./ADR-015-zero-cost-mvp-hosting.md)). A JWT would have hidden this only
  until the first data query.
- **Cookie auth brings CSRF back into scope** for web. It is handled by `SameSite=Strict` plus an
  `Origin` check. If a cross-origin web client is ever needed, double-submit tokens become mandatory.
- **Expired sessions accumulate** and need a periodic delete. At first this runs as part of login,
  not as a scheduled job.

## Consequences

- ADR-008's `TokenStorage` port becomes `SessionTokenStorage`, and it only matters on native. On
  web, the browser holds the cookie and the Angular app stores nothing.
- The Angular auth interceptor becomes trivial. It attaches nothing on web, and a `401` clears the
  session state and routes to login. The single-flight refresh queue is not built.
- `core/auth` exposes the current user as a signal, loaded from `GET /api/v1/auth/session`.
- CORS is no longer used by the web app. It is kept only for the Capacitor origins in phase 10.
- Integration tests cover: a missing, unknown, expired or revoked token returns `401`; a cookie
  request from a disallowed `Origin` returns `403`; after a password reset, every other session is
  rejected; and one user's session never reads another user's rows.
- A GDPR hard delete removes the user's sessions along with their domain data.

## Reversal trigger

Move to short-lived signed access tokens in front of these sessions if session lookups show up in
latency measurements, or if a second service needs to verify identity without calling the API.
Move to a library or a managed provider under the triggers already in ADR-008: MFA, more than two
social providers, or an incident traced to our own authentication code.
