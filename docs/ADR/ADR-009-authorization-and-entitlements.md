# ADR-009 — Authorization, roles and entitlements

- Status: Accepted
- Date: 2026-08-23
- Related: [ADR-008](./ADR-008-authentication.md), [ADR-003](./ADR-003-api-style.md)

## Context

The product will eventually have free users, paid users and administrators. Paid tiers will gate
some features and raise some limits, and payments will go through a provider such as Stripe. None of
that is being implemented now, but the model must be able to accommodate it without reworking every
endpoint.

What _is_ needed immediately is resource ownership: every piece of training and nutrition data
belongs to exactly one user and must never be readable by another.

The exact commercial packaging is unknown — which features are paid, and whether limits are
feature-based or quota-based, is an open product decision recorded in
[ARCHITECTURE.md](../ARCHITECTURE.md#open-decisions).

## Decision

Separate three concepts that are commonly conflated, and model them independently:

| Concept         | Question it answers                         | Example                             |
| --------------- | ------------------------------------------- | ----------------------------------- |
| **Role**        | Who are you in the system?                  | `user`, `admin`                     |
| **Entitlement** | What capabilities does your plan grant?     | `advanced_analytics`, `data_export` |
| **Quota**       | How much of a metered resource may you use? | 3 routines, 30 days of history      |

Ownership is enforced in the query predicate at the application layer. Entitlements are checked by a
guard. The frontend mirrors entitlements for user experience only; the API is the sole authority.

## Alternatives considered

**A single `role` field carrying the plan** — `free`, `premium`, `admin`. The simplest thing that
could work, and the most common early shortcut. It breaks on the first real product decision: a
grandfathered user on a legacy plan, a lifetime supporter, a beta tester with one premium feature, a
staff account with admin rights but no subscription. Each of those forces either a new role or a
special case in a conditional, and within a year the role check is a tangle. Roles and plans change
for unrelated reasons and belong in different fields.

**Full RBAC with a permissions table** (roles, permissions, role-permission mappings, managed at
runtime). Appropriate for a product with organisations and custom roles. Rejected as heavy
over-engineering for two roles and one axis of paid capability — it would mean a permissions
administration surface that nobody will use.

**Casbin or a policy engine.** Powerful and well-suited to complex policies. Rejected: the policy
set is small and static enough to express in code, where it is type-checked and testable. Reconsider
if user-to-user sharing appears (see below).

**Checking the subscription record directly at each call site.** Rejected: it couples business
logic to billing state and means every feature check reimplements plan interpretation. The
indirection through named entitlements is the point — a feature asks "may this user export data",
not "is this user on the pro plan".

**Frontend-only gating.** Not an alternative, an anti-pattern. Recorded because it is a common
mistake: client-side gating is a UX affordance and is bypassed by editing a signal in the console.

## Reason

The separation is what makes the model survive product changes that have not happened yet. Adding a
new paid feature means defining an entitlement and mapping it to plans — configuration, not schema
change. Granting one user early access means adding an entitlement override, not inventing a role.
Changing what the paid tier includes means editing a plan definition, and no endpoint changes at
all.

The alternative — a plan encoded as a role — makes every one of those a code change in a
conditional, which is precisely the "rebuild it later" outcome the project is trying to avoid.

## Trade-offs

More concepts than a single role field, which is more to understand up front for a product that
today has exactly one kind of user.

Entitlements in the access token can become stale for up to the token lifetime (15 minutes) after an
upgrade. Acceptable, and mitigated by forcing a token refresh after a plan change so an upgrade
feels immediate.

Quota enforcement requires counting, which means either a maintained counter or a count query on
each relevant write. Both have a cost; the choice is deferred until quotas actually exist.

Two places express entitlement logic — the API guard and the frontend gating — which is duplication.
It is accepted because they serve different purposes, and it is made safe by the rule that only one
of them is authoritative.

## Consequences

- Data model skeleton, created when authentication is built and left unused until billing exists:
  `users.role`, a `subscriptions` table (plan, status, current period, provider references left
  nullable), and a mechanism for per-user entitlement overrides. No payment provider integration.
- Plan-to-entitlement mapping lives in code as typed configuration, not in the database. It is
  reviewed, diffed and tested like any other logic; a runtime-editable mapping with no consumer is
  an administration feature nobody asked for.
- A `@RequiresEntitlement('advanced_analytics')` guard on endpoints, resolving from the token claims.
  Missing entitlement returns `403`.
- **Ownership is enforced in the query predicate**, never by loading a row and comparing afterwards.
  Repository methods take the user identifier as a required parameter. Resources belonging to another
  user return `404`, not `403`, so the API does not confirm their existence.
- The frontend exposes an `entitlements` signal from `core/auth` and a guard plus a structural
  directive for conditional UI. Every gated capability is _also_ checked server-side on the endpoint
  that performs the work. Client gating is presentation.
- Administrative capability is a role check, and administrative access to another user's data — if
  ever built — must be audited, since it is access to health data.
- When Stripe is added, it becomes a webhook handler that updates `subscriptions` and nothing else.
  No domain code learns about Stripe. That containment is the reason for building the skeleton now.

## Reversal trigger

Adopt a policy engine, or extend to relationship-based authorization, if the coach and client
sharing feature is confirmed — see the open decision in
[ARCHITECTURE.md](../ARCHITECTURE.md#open-decisions). That change moves the model from "a resource
has exactly one owner" to "a resource has an owner and a set of granted scopes", which touches every
endpoint and must therefore be decided before phase 5 rather than discovered after it.
