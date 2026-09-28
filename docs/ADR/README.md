# Architecture Decision Records

An ADR records a single architecturally significant decision: what was decided, what else was
considered, why this option won, and what we accept as a result.

## Why we keep them

A decision without a recorded reason becomes folklore. Six months from now the question will not be
"what did we choose" — that is visible in the code — but "can we change it". That question is only
answerable if the original constraints and trade-offs were written down. ADRs exist to make future
reversals safe, not to justify the past.

## Rules

- **Append-only.** A decision that no longer holds is marked `Superseded by ADR-NNN`; its text is
  not rewritten. Editing history destroys the reason the ADR exists.
- **One decision per record.** If a record contains two independent choices, it should be two ADRs.
- **Record rejected options honestly**, including the cases where the rejected option is genuinely
  good. An ADR that makes the choice look obvious is usually hiding something.
- **State a reversal trigger** where one exists: the observable condition under which this decision
  should be revisited. This is what turns a decision into something reviewable rather than
  permanent by default.

## Statuses

| Status       | Meaning                                       |
| ------------ | --------------------------------------------- |
| `Proposed`   | Written, not yet acted on                     |
| `Accepted`   | Decided; implementation follows this          |
| `Superseded` | Replaced by a later ADR, which is linked      |
| `Deprecated` | No longer applies, with no direct replacement |

Every ADR in this index is `Accepted` as a design decision, some with a later ADR amending part of
it. An amended ADR says so in its header and links to the amendment. "Accepted" here means "this
is the plan of record", not "this is running in production". The ADRs were written before any code
existed, and each is implemented in the roadmap phase that needs it. Phase 1 has put the foundation
decisions into practice: ADR-001 to ADR-004, ADR-006, ADR-007, ADR-012 and ADR-013. What has been
built is tracked in [ROADMAP.md](../ROADMAP.md), not here. The ADRs themselves are not edited to
reflect progress.

## Index

| ADR                                                    | Decision                                | Status                               |
| ------------------------------------------------------ | --------------------------------------- | ------------------------------------ |
| [ADR-001](./ADR-001-frontend-framework-and-ui.md)      | Frontend framework, UI layer and forms  | Accepted                             |
| [ADR-002](./ADR-002-backend-framework.md)              | Backend framework                       | Accepted                             |
| [ADR-003](./ADR-003-api-style.md)                      | API style, versioning and error format  | Accepted                             |
| [ADR-004](./ADR-004-database-and-orm.md)               | Database engine and data access         | Accepted                             |
| [ADR-005](./ADR-005-state-management.md)               | Frontend state management               | Accepted                             |
| [ADR-006](./ADR-006-monorepo-and-tooling.md)           | Repository layout and build tooling     | Accepted                             |
| [ADR-007](./ADR-007-shared-contracts.md)               | Shared API contract package             | Accepted                             |
| [ADR-008](./ADR-008-authentication.md)                 | Authentication and token strategy       | Token design superseded by ADR-016   |
| [ADR-009](./ADR-009-authorization-and-entitlements.md) | Authorization, roles and entitlements   | Accepted                             |
| [ADR-010](./ADR-010-mobile-and-offline-strategy.md)    | Mobile packaging and offline capability | Accepted                             |
| [ADR-011](./ADR-011-nutrition-data-source.md)          | Nutrition data source                   | Accepted (with open legal question)  |
| [ADR-012](./ADR-012-testing-strategy.md)               | Testing strategy and tooling            | Accepted                             |
| [ADR-013](./ADR-013-hosting-and-deployment.md)         | Hosting, deployment and CI/CD           | Accepted                             |
| [ADR-014](./ADR-014-domain-model-conventions.md)       | Domain model conventions                | Accepted                             |
| [ADR-015](./ADR-015-zero-cost-mvp-hosting.md)          | Zero-cost hosting for the MVP           | Accepted, amends ADR-013             |
| [ADR-016](./ADR-016-opaque-server-sessions.md)         | Opaque server-side sessions             | Accepted, supersedes part of ADR-008 |
| [ADR-017](./ADR-017-client-generated-identifiers.md)   | Idempotency via client-generated ids    | Accepted, amends ADR-003 and ADR-010 |
| [ADR-018](./ADR-018-internationalisation.md)           | Internationalisation (es, en)           | Accepted                             |

## Template

```markdown
# ADR-NNN — Title

- Status: Proposed | Accepted | Superseded | Deprecated
- Date: YYYY-MM-DD
- Related: ADR-NNN, ADR-NNN

## Context

What situation forces a decision. Constraints, requirements, and what we do not know.

## Decision

The decision, stated in one or two sentences.

## Alternatives considered

Each option with its genuine strengths and why it lost.

## Reason

Why the chosen option wins given the constraints above. Not a feature list.

## Trade-offs

What we give up. If this section is empty, the analysis is incomplete.

## Consequences

What must now be true: work implied, rules to follow, things that become harder.

## Reversal trigger

The observable condition under which this decision should be revisited.
```
