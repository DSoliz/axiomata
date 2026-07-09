---
name: axm
description: Use the axm CLI to answer questions about this knowledge base.
---

Use the `axm` CLI to answer questions about this knowledge base: $ARGUMENTS

## Format reference

`.axm` files contain type declarations and statements:

```axm
// Declare named types
type decision "a recorded architectural or product decision"
type unknown  "an open question or unresolved matter"
type domain-term "a named concept in the domain vocabulary"

// <type> <id> "<value>"
decision a1 "we will only serve @fast-restaurant food"
decision a2 "because of @a1 the website needs an order-ahead feature"
unknown  u2 "should the @fast-restaurant model apply to catering orders too"
```

- `@id` references link statements inline
- All files in a KB share one flat namespace; an optional `axmconfig.json` can import a second KB as read-only context (see §7 of the spec)
- `type` is the only reserved keyword — it cannot be used as a type name or statement id

## Workflow

**0. If no KB exists yet, initialise one:**
```
axm init .
```
Creates `types.axm` with seven recommended types and `axmconfig.json` with `{ "include": ["*.axm"] }`. Fails if `.axm` files already exist.

**1. Orient — get file list and counts by type:**
```
axm summary . --json
```
Returns `{ total, files: { "rel.axm": { total, <type>: N, ... } } }`. Use this first to size up the KB cheaply before loading full statement values.

**2. Check what types exist:**
```
axm index . --types --json
```
Returns `[{ name, description }, ...]`. Always do this before adding statements — use existing types rather than inventing new ones.

**3. Load everything in the KB:**
```
axm index . --json
```
Returns `{ types: [...], files: { "rel.axm": [{ id, type, value }, ...] } }`. Statements are grouped by relative file path; individual statements have no `file` field.

Add `--json-min` to any command for minified output (no indentation) — useful when token budget is tight.

**4. Search by keyword or phrase:**
```
axm search "your query" . --json
```
Matches against both IDs and statement text. Returns ranked results (exact ID match first, then partial ID, then value text). All words in a multi-word query must match. Output: `{ files: { "rel.axm": [{ id, type, value }, ...] } }`.

**5. Filter by type:**
```
axm index . --json --type decision
axm search "query" . --json --type unknown
```
When `--type` is used, the `types` array is automatically omitted from `index` output. Use `--omit-types` to suppress it explicitly without a type filter.

**6. Look up a specific statement by ID:**
```
axm query <id> . --json
```
Returns `{ id, type, value, file }` or `null` (exit 1) if not found. In a KB with an `import`, also searches the global KB.

**7. Find references to a statement or type:**
```
axm refs <id> . --json
```
- If `<id>` is a **statement ID** → returns all statements whose value contains `@id`
- If `<id>` is a **type name** → returns all statements of that type

Output: `{ files: { "rel.axm": [{ id, type, value }, ...] } }`.

Run this before modifying a statement. If other statements reference it, re-evaluate whether they still hold — a change in one decision can invalidate or require updates to everything that depends on it.

**8. Rename a statement ID or type name across all files:**
```
axm rename <old> <new> . --json
```
Renames every occurrence — declaration and all references — atomically across the whole KB. Works with hyphenated identifiers (e.g. `fast-restaurant`). Returns `{ oldName, newName, kind, files, edits }`. Exits 1 if `<old>` is not found, `<new>` already exists, or `<new>` is not a valid identifier.

**9. Validate the KB:**
```
axm check . --json
```
Returns `{ files: N, errors: [...] }`. Exit code 1 if there are errors.

## Reading the output

- `value` is the full statement text with `@references` rendered inline
- `type` is always a string — every statement must have a type
- `index`, `search`, and `refs` group statements under relative file path keys — individual statements have no `file` field
- `query` still returns a single `{ id, type, value, file }` object with an absolute path
- Search results are ordered best-match first

## Adding new statements

```
axm add "value text" . --type decision --json
```
Auto-generates a unique ID. Returns `{ id, type, value, file }`.

Supply your own ID with `--id <id>` — rejected if already exists (exit 1).

When the KB has multiple `.axm` files, specify the target with `--file <path>`.

## Suggested approach

Start with `axm summary . --json` to orient (cheap — no statement values loaded), then `axm index . --types --json` if you need type descriptions, then `axm index . --json` (or `--json-min`) to load full statement text. Use `axm search` to find relevant statements, then `axm query <id>` for detail on a specific entry. Cross-reference `@id` mentions by querying the referenced IDs.
