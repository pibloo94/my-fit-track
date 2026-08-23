# ADR-008 — Authentication and token strategy

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-009](./ADR-009-authorization-and-entitlements.md), [ADR-010](./ADR-010-mobile-and-offline-strategy.md)

## Context

The application needs authenticated users from phase 2. Requirements: email and password at launch;
Google and Apple sign-in later; a web client and, later, a Capacitor mobile client built from the
same codebase; and a product that will be sold, which makes ownership of the user relationship a
business concern rather than only a technical one.

The data being protected is sensitive: body weight, measurements and dietary records, which
plausibly qualify as health data under GDPR Article 9.

Two constraints are easy to overlook and drive most of this decision. Mobile clients cannot be
force-upgraded or force-logged-out, so token lifetimes and revocation must be designed rather than
assumed. And **a Capacitor WebView does not behave like a browser with respect to cookies**, which
invalidates the otherwise-correct textbook answer.

## Decision

**Self-hosted authentication in the API**: short-lived access JWTs plus rotating, server-stored,
hashed refresh tokens with reuse detection. Refresh token transport is **platform-dependent** — an
`HttpOnly` cookie on the web, OS secure storage in the Capacitor build — behind a `TokenStorage`
port. Social sign-in is added later through OAuth 2.0 Authorization Code with PKCE, behind an
`IdentityProvider` port.

## Alternatives considered

**A managed identity provider — Auth0, Clerk, Firebase Auth, Supabase Auth, or similar.** This is
the strongest alternative and the recommendation most security engineers would give a solo
developer, for good reason: password reset, email verification, MFA, breach detection, social
provider plumbing and rate limiting all arrive working, and the highest-risk code in the product is
maintained by specialists. It is rejected here on three grounds, and the rejection is a genuine
trade-off rather than a clear win. First, user identity is inseparable from domain data in this
product — every table is user-scoped — so the user record lives in our database regardless, meaning
we carry the integration complexity *and* the data model. Second, per-monthly-active-user pricing
compounds exactly as the product succeeds, and for a product intended to be sold, that is a margin
decision made early and hard to unwind. Third, vendor coupling on authentication is one of the
harder things to migrate away from later. The risk this creates is stated in the trade-offs and
mitigated by keeping the provider behind a port.

**Better Auth or a similar self-hostable auth library.** A genuinely good middle ground: batteries
included, no vendor, no per-user cost. Worth revisiting during phase 2 implementation. Not chosen
as the plan of record because its integration with NestJS DI and our existing user model needs
evaluation, and because the flows we need at launch are few.

**Session cookies with server-side sessions**, no JWT. Simpler, revocation for free, and a perfectly
respectable choice for a pure web application. It loses on the mobile client: session cookies in a
Capacitor WebView hit the same cross-site cookie problem described below, and there is no clean
equivalent of "send the session cookie" from a native context.

**Long-lived access tokens with no refresh.** Simple, and wrong. A stolen token is valid until
expiry with no revocation path, which is unacceptable for health data.

**Access and refresh tokens both in `localStorage`.** The most common implementation on the web, and
the reason token theft via XSS is so common. Anything readable by JavaScript is readable by injected
JavaScript. Rejected outright.

**Refresh token in an `HttpOnly` cookie on all platforms.** The correct answer for a browser-only
application, and the one that would have been chosen without the mobile requirement. It fails on
Capacitor — see below — which is why the storage decision is platform-dependent rather than uniform.

## Reason

The token design is standard for a reason: a short-lived access token limits the damage window of a
leak, and a rotating server-stored refresh token provides what a stateless JWT cannot — actual
revocation, "sign out everywhere", a device list, and detection of token theft. Rotation is only
worth implementing *with* reuse detection: when a token that has already been consumed is presented,
either the client is broken or the token was stolen and replayed, and revoking the whole family is
the correct response in both cases.

The platform-dependent storage decision is the substantive part. In a Capacitor build the page
origin is `capacitor://localhost` on iOS and `https://localhost` on Android, while the API is on a
real domain. That makes every cookie a **cross-site** cookie in an embedded WebView, where platform
privacy policies make delivery unreliable — depending on OS version and configuration, cookies may
simply be dropped. The observable result would be an intermittently broken login on mobile only:
expensive to diagnose, embarrassing to ship, and structural rather than fixable with a flag.
Designing the seam now costs one interface and two adapters. Discovering it after the mobile app
ships costs an authentication rewrite in the most security-sensitive part of the system.

## Trade-offs

**We own the risk.** Hand-rolled authentication is the most common source of serious security
defects in solo-developer products. Password reset token expiry, email verification, enumeration
resistance, timing-safe comparison, lockout policy — each is a chance to get it wrong. This is
accepted deliberately, not overlooked, and mitigated by using vetted libraries rather than custom
cryptography, by keeping the surface small, and by the `IdentityProvider` port that makes migration
to a managed provider possible without touching the domain.

Server-stored refresh tokens mean a database read on every refresh and a cleanup job for expired
rows: statefulness in an otherwise stateless API. That is the price of revocation.

Two storage adapters mean two code paths to test, and a class of bug that only reproduces on one
platform.

Access tokens held only in memory mean a full-page refresh triggers a token refresh round trip
before the first data request. Slightly slower cold start, in exchange for not writing tokens to
disk.

## Consequences

- **Access token**: JWT, 15-minute lifetime, claims `sub`, `role`, entitlements, `jti`. Sent as
  `Authorization: Bearer`. Held in memory in an Angular service. Never in `localStorage`,
  `sessionStorage` or IndexedDB.
- **Refresh token**: opaque random value, 30-day lifetime, stored server-side as a hash with a
  family identifier, rotated on every use, single-use. Presenting a consumed token revokes the
  entire family.
- **Storage by platform:**

  | Platform | Refresh token | Access token |
  | --- | --- | --- |
  | Browser | `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` cookie | In memory |
  | Capacitor | OS secure storage: iOS Keychain, Android Keystore | In memory |

- `@capacitor/preferences` is **not** acceptable for tokens — it is unencrypted `UserDefaults` and
  `SharedPreferences`. A dedicated secure-storage plugin is required.
- The refresh endpoint accepts the token from either the cookie or an explicit body field; transport
  is a client concern.
- The Angular HTTP interceptor retries a `401` exactly once after refreshing, queueing concurrent
  requests behind the single refresh call. A second failure clears the session and routes to login.
- Passwords are hashed with **Argon2id** at parameters reviewed against current guidance, never
  bcrypt-by-default and never a bare hash.
- Authentication endpoints are rate limited far more aggressively than the rest of the API, with
  per-account lockout and exponential backoff, because credential stuffing targets accounts rather
  than addresses.
- Login, registration and password reset must be resistant to account enumeration: identical
  responses and comparable timing whether or not the account exists.
- Social sign-in, when added, uses Authorization Code with PKCE and links to an existing account by
  verified email, behind the `IdentityProvider` port. Implicit flow is not used.
- The entire token strategy depends on the frontend being XSS-free: a strict CSP, no `innerHTML`
  binding, and `bypassSecurityTrust*` requiring explicit justification. That is a load-bearing
  security control, not hygiene.
- A GDPR-compliant hard delete must remove tokens, sessions and audit rows alongside domain data.

## Reversal trigger

Migrate to a managed identity provider or a self-hostable auth library if any of the following
happens: a security incident traced to our own authentication code; MFA becomes a product
requirement; more than two social providers are needed; or authentication maintenance starts
displacing feature work. The `IdentityProvider` port exists so that this migration touches the auth
module and not the domain.
