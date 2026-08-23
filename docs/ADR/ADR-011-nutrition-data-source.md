# ADR-011 — Nutrition data source

- Status: Accepted, with an open legal question
- Date: 2026-08-23
- Related: [ADR-004](./ADR-004-database-and-orm.md), [ADR-014](./ADR-014-domain-model-conventions.md)

## Context

Nutrition tracking is worthless without a food catalogue. Making users type in the macronutrients of
every food they eat guarantees abandonment — the ability to search a food, or scan a barcode, and get
calories and macros immediately is the feature, not a convenience around it.

The project owner has chosen an external catalogue (Open Food Facts or USDA FoodData Central)
combined with user-authored foods.

There is a constraint here that is easy to miss and expensive to discover late: **the licence of the
data matters for a commercial product**. Open Food Facts is distributed under the Open Database
License (ODbL), which imposes share-alike obligations on derived databases. This project is
distributed under a proprietary, non-commercial-use licence with all commercial rights reserved.
Whether ingesting and redistributing ODbL data through a proprietary commercial service creates an
obligation to publish a derived database is a legal question, and it is not one an engineer should
answer.

USDA FoodData Central is US federal public domain data with no such obligation, but its coverage of
European branded and packaged products is much weaker — which matters if the target market is Spain
or Europe more broadly.

## Decision

Model the food catalogue behind a **`FoodCatalogueProvider` port** with pluggable adapters, cache
imported foods locally with provenance recorded, and treat the choice of provider as configuration.
Start development against USDA FoodData Central (public domain, no licence risk) while the Open Food
Facts licensing question is resolved.

The provider decision is therefore **deliberately deferred without blocking the feature**. The
architectural decision — a port with provenance tracking — is what is being accepted here.

## Alternatives considered

**Open Food Facts as the single source.** Best coverage of European branded products and barcodes, a
large community, free. The ODbL share-alike obligation is the problem, and it is a real one for a
proprietary product rather than a theoretical concern.

**USDA FoodData Central as the single source.** Public domain, high-quality data, well documented,
no licence risk. Weak on European branded products and on barcode lookup, which are exactly what a
Spanish or European user needs when scanning a supermarket item.

**A commercial API — Nutritionix, FatSecret, Edamam.** Good coverage, commercial licensing terms
that are explicitly compatible with a paid product, barcode support. Costs money per request or per
month from day one, before any revenue, and creates a hard runtime dependency on a vendor whose
pricing can change. A reasonable choice later, and one the port makes possible.

**User-entered foods only for the MVP.** Zero licence risk and zero integration work. Rejected
because it makes nutrition tracking unusable for a new user, which means the feature cannot be
validated at all.

**Building and curating our own catalogue.** Full ownership and a genuine long-term asset. Rejected
as an enormous ongoing data-entry effort, entirely disproportionate at this stage.

## Reason

The provider choice depends on a legal answer and a market decision that do not exist yet, so the
architecture's job is to keep the decision cheap rather than to make it prematurely. A port with two
or three thin adapters costs very little; being locked into the wrong data source after a nutrition
feature is built on it costs a rewrite of the most data-heavy part of the product.

Developing against USDA specifically — rather than against whichever is convenient — means the
codebase never contains an unresolved licence exposure while the question is open. If Open Food Facts
turns out to be usable, adding it is an adapter. If it does not, nothing has to be removed.

Provenance tracking is the other half of the decision, and it is what makes provider changes
survivable: every cached food records which source it came from, its external identifier and when it
was imported. Without that, a licence problem or a provider migration means an unattributable
catalogue that cannot be selectively purged.

## Trade-offs

An abstraction over something with one implementation today. Usually a smell; justified here because
the second implementation is likely and the first is legally uncertain.

Provider data models differ substantially — nutrient identifiers, serving descriptions, units,
completeness — so the adapter layer does real normalisation work, and normalising is where subtle
data bugs live.

Caching external data means a local copy that goes stale, and a decision about how often to refresh.

The `FoodCatalogueProvider` interface will be shaped by the first adapter and may not fit the second
cleanly. Mitigated by keeping the interface narrow: search, get by identifier, get by barcode.

## Consequences

- `FoodCatalogueProvider` interface: `search(query, locale)`, `getByExternalId(source, id)`,
  `getByBarcode(code)`. Narrow on purpose.
- Imported foods are cached in our database with `source`, `external_id`, `imported_at` and the raw
  provider payload in `JSONB`. This gives offline-independent search, protects against provider
  downtime and rate limits, and makes selective purging possible if licensing requires it.
- User-authored foods are first-class, with an `owner_user_id`, and are always searchable alongside
  catalogue foods. Users need this regardless of provider — home recipes and local products will
  never be fully covered.
- **Diary entries store computed macros as a snapshot**, not only a food reference
  ([ADR-014](./ADR-014-domain-model-conventions.md)). External catalogue data gets corrected and
  re-imported; a historical diary that silently rewrites itself is worse than useless for someone
  tracking a deficit. This is the single most important consequence of using external data.
- Nutrient values are normalised to per-100-g canonical units on import, with serving sizes as
  separate `FoodPortion` rows.
- Attribution requirements of the selected provider must be honoured in the user interface.
- Barcode scanning uses a Capacitor plugin and depends on the provider supporting barcode lookup —
  another input to the provider decision.
- The provider is configuration, so a different provider can be used per environment or per locale.

## Open question

**OPEN DECISION — Open Food Facts ODbL compatibility with a proprietary commercial product.**
*Needed to resolve:* legal advice on whether our use constitutes a derived database triggering
share-alike, and a product decision on how important European branded-product coverage is.
*Blocking:* the final provider choice, not the nutrition feature itself. *Owner:* project owner,
with legal counsel.

## Reversal trigger

Switch to a commercial provider if catalogue coverage becomes a leading cause of user complaints, or
if the licence question resolves against Open Food Facts and USDA coverage proves insufficient for
the target market. The port and the recorded provenance are what make that switch an adapter change
plus a data migration rather than a rewrite.
