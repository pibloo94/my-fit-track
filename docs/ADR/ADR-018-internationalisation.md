# ADR-018 — Internationalisation: Spanish and English from the start

- Status: Accepted
- Date: 2026-09-28
- Related: [ADR-001](./ADR-001-frontend-framework-and-ui.md), [ADR-003](./ADR-003-api-style.md), [ADR-014](./ADR-014-domain-model-conventions.md)
- Closes: the internationalisation and UI-language open decisions in
  [ARCHITECTURE.md](../ARCHITECTURE.md#open-decisions)

## Context

The product launches in **Spanish and English**. ARCHITECTURE.md recorded this as an open decision
that had to be closed before the exercise catalogue is built. The reason: translatable catalogue
names are a data-model concern, and retrofitting them into a seeded catalogue that users already
reference is painful.

Three surfaces need translation, and each has a different right answer:

1. **The UI** — labels, messages, validation errors.
2. **Reference data we own** — the global exercise catalogue, muscle groups, equipment.
3. **Data users author** — their own exercises, foods, routine names. This is never translated. It
   is shown exactly as it was written.

## Decision

**UI: Angular's built-in `@angular/localize`, with one build per locale.**

- Templates use `i18n` attributes, and code uses `$localize`. Messages carry explicit, stable IDs
  (`@@auth.login.submit`), so rewording the English text does not invalidate a translation.
- Source locale `en`, translation `es`. The build fails on a missing translation
  (`i18nMissingTranslation: "error"`). An untranslated string is caught in CI, not by a user.
- Each locale is built to its own folder and served under `/en/` and `/es/`. The root `/` goes to
  the locale saved on the user's profile, or the browser's language, and otherwise to `es`.
  Switching language navigates to the other prefix.
- Dates, numbers and units are formatted with Angular's locale data for `es` and `en`. They are
  never formatted by hand.

**Reference data: translation rows, keyed by a stable code.**

- A global exercise has a stable `key` (for example `barbell-back-squat`) and one
  `exercise_translations(exercise_id, locale, name, instructions)` row per locale. The seed ships
  `es` and `en` for every entry.
- A user-authored exercise has a single `name` in whatever language its author wrote it, and it is
  shown in every locale unchanged.
- Closed vocabularies — muscle groups, equipment, modality, meal type — are **enum codes** in the
  database and the contract. The UI translates them, like any other label.
- The API resolves the locale from the user's saved preference, and otherwise from
  `Accept-Language`. It returns the resolved name only; clients never receive every translation.
  A missing translation falls back to `en`.

**Server-generated text.**

- Errors keep a stable machine `code` (RFC 9457, [ADR-003](./ADR-003-api-style.md)). The UI shows a
  translated message chosen by `code`. The `title` and `detail` fields remain English, for logs and
  developers.
- Zod validation messages are produced on the client through a locale-aware error map keyed by the
  Zod issue code. They are not the default English strings.
- Transactional emails have a template per locale and use the recipient's saved locale.

## Alternatives considered

**Transloco, or another runtime translation library.** It switches language without a reload and
serves one bundle for all locales. It loses because it is a third-party dependency on a core path,
and it adds translation lookups at runtime and a key-string API that is not type-checked against
the templates. A reload when switching language is acceptable for a setting that changes perhaps
once per user.

**A single language now, i18n later.** Cheapest today. Rejected because both languages are a launch
requirement, and retrofitting `i18n` markers onto every existing screen is the expensive
direction.

**Translated columns on the exercise row** (`name_es`, `name_en`). Simpler queries, but adding a
language becomes a schema migration and every query has to choose a column. A translation table is
additive.

**JSONB with every translation on the row** (`{"es": …, "en": …}`). Viable and compact. It loses on
indexing and search per locale, which the catalogue needs for name search.

## Reason

Both languages are required at launch, so the only real question is where translation lives. The
split above keeps each concern where it is cheapest. UI strings are handled at build time by the
framework, with no runtime cost and missing strings caught in CI. Catalogue names are rows that can
be searched and indexed per locale. User data is left alone. A stable `code` on errors and enums is
the same rule the architecture already uses for problem details, applied consistently.

## Trade-offs

- **Two builds and two deploy folders.** CI builds take longer, and the bundle budget applies per
  locale.
- **Changing language reloads the app.**
- **Every screen costs translation effort**, including the Spanish copy for each new feature. A
  feature is not done until both locales are.
- Catalogue search per locale needs one index per locale. With two locales, that is trivial.

## Consequences

- Phase 2 sets up `@angular/localize`, the two locale builds, the root locale redirect and the
  `es`/`en` locale data. It does this before the first real screen exists, so no screen is ever
  built without translation markers.
- `UserPreferences` gains `locale` (`es` or `en`), defaulting to the browser language at
  registration.
- The Cloudflare Pages SPA fallback is per locale: `/es/*` falls back to `/es/index.html`, and
  `/en/*` to `/en/index.html`.
- The phase 4 seed provides both languages for every global exercise. A catalogue entry without both
  is not merged.
- Code review rejects user-facing strings written directly in templates or code without an `i18n`
  marker or `$localize`.

## Reversal trigger

Adopt a runtime translation library if switching language without a reload becomes a product
requirement, or if more than three or four locales make per-locale builds too slow in CI.
