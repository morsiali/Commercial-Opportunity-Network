# Requirement extraction (`dist/assets/js/core/parse.js`)

The parser is deterministic. It never invents a value. Every field it returns carries a **status**, and the user reviews the result in a merge preview before anything is applied. Values the user typed are never ticked by default.

| Status | Meaning | Applied when ticked? |
|---|---|---|
| `recognized` | Stated clearly | Yes |
| `derived` | Calculated from stated values (for example an end date from start plus duration) | Yes |
| `review` | Probably right, but an assumption was made (no currency, no year, "in N days") | Yes, with a note |
| `confirm` | Outside the plausible range or limits; the user must check | Shown, **not applied** |
| `ambiguous` / `conflict` | Several readings or several values | Shown with candidates, not applied |
| `invalid` / `past` | Impossible or already passed | Shown, not applied |

## Normalisation

- Arabic-Indic digits (٠–٩) and Eastern Arabic-Indic digits (۰–۹) become 0–9.
- The Arabic thousands separator ٬ becomes `,`, and the Arabic decimal separator ٫ becomes `.`.
- The mapping is 1:1, so character positions still match the original text for highlighting.
- Time zone: "today" is today in **Asia/Dubai**, not the device clock.

## Amounts (stored as integer fils)

- **Currency:** `AED`, `Dhs`, `dirham(s)`, `درهم`, `د.إ`, before or after the number. With no currency the parser assumes AED and sets status `review`.
- **Multipliers:** `k`, `thousand`, `m`/`mn`, `million`, `bn`, `billion`, `ألف`, `مليون`, `مليار`. Each needs a word boundary, so "20,000 men" stays 20,000.
- **Separators:**
  - `20,000` and `1,500.50` are accepted.
  - `1,5` (comma decimal), `1.500` (dot thousands), and mixed or repeated dots are flagged ambiguous and not applied.
  - More than two decimals is invalid.
- **Plausibility:** below AED 1,000 or above AED 10,000,000 gives status `confirm`. These limits are set in `LIMITS`.
- **Conflicts:** several different budget amounts give `conflict` with candidates. The lead target is never read as a budget.

## Targets and objectives

- **Targets:** a number followed by an optional qualifier ("new", "qualified", "unique", "paying" and similar) and a noun. Nouns: customers, clients, buyers, users, leads, sign-ups, registrations, trials, samples, visits, and Arabic equivalents. The noun sets the objective (leads → *leads*, customers → *acquisition*, samples → *trial*).
- **Negation:** "not", "no", "without", "rather than", "instead of", "avoid", "except", and `لا`, `ليس`, `بدون`, `دون`, `غير`, `عدا` within the same clause. A negated objective goes to `excluded` and is never chosen. If the user only says what they do not want, they are asked to choose.

## Audience and places

- **Gender:** men or women, with Arabic equivalents. If both are mentioned, the audience is "everyone", with a note.
- **Age:** a range or number only when the context says it is an age (for example "men 35–55", "aged 25", "عمر").
- **Areas:** Dubai area names in English and Arabic.
- **Strictness:** words such as "only", "must", "strictly", `فقط`, `يجب` and `حصري` turn the audience or area into a **requirement**. A requirement is an eligibility rule in matching, not a preference.

## Dates and durations

- **Absolute dates:**
  - `2026-12-01`
  - `1/12/2026` (read as day/month/year, with a note)
  - `1 December 2026` and `December 1, 2026`
  - Arabic month names, for example `1 ديسمبر 2026`
  - Without a year, the next occurrence is used and the status is `review`.
- **Relative dates:** today, tomorrow, next week, next month, and the Arabic equivalents. "in/after N days or weeks" is read as a start date with status `review`, because it could also mean a duration.
- **Durations:** N days, weeks or months. The Arabic dual forms يومين, أسبوعين and شهرين are supported. A month counts as 30 days (with a note), and durations are capped at 365 days.
- **Checks:** impossible dates such as 31/02 are rejected, past dates are flagged, and an end date before the start date is flagged. If the dates and the stated duration disagree, the result is a conflict.

## What is not supported

These fall back to manual entry and are not guessed:

- Hijri dates
- Currencies other than AED (they are not converted)
- Spelled-out numbers ("twenty thousand")
- Time ranges within a day

## Tests

Unit tests are in `tests/unit/parse.test.mjs`. They cover every specification case, the negation, strictness, date and time-zone rules, and the alignment of normalised text.

Browser tests A01–A04 in `tests/e2e.mjs` check the merge preview.
