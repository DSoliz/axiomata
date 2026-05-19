Use the `axm` CLI to answer questions about this knowledge base: $ARGUMENTS

## Format reference

`.axm` files contain type declarations and statements:

```axm
// Declare named types
type decision "a recorded architectural or product decision"
type unknown  "an open question or unresolved matter"
type domain-term "a named concept in the domain vocabulary"

// stmt[:type] <id> "<value>"
stmt:decision a1 "we will only serve @fast-restaurant food"
stmt:decision a2 "because of @a1 the website needs an order-ahead feature"
stmt:unknown  u2 "should the @fast-restaurant model apply to catering orders too"
stmt         plain1 "untyped statement"
```

- `@id` references link statements inline
- All files in a directory share one flat namespace — no imports
- Statements can also be written value-first: `"value" <id> stmt[:type]`

## Workflow

**1. Orient — list everything in the KB:**
```
axm index . --json
```
Returns `{ types: [...], statements: [...] }`. Each statement has `id`, `type`, `value`, `file`.

**2. Search by keyword or phrase:**
```
axm search "your query" . --json
```
Matches against both IDs and statement text. Returns ranked results (exact ID match first, then partial ID, then value text). All words in a multi-word query must match.

**3. Filter by type:**
```
axm index . --json --type decision
axm search "query" . --json --type unknown
```

**4. Look up a specific statement by ID:**
```
axm query <id> . --json
```
Returns `{ id, type, value, file }` or `null` (exit 1) if not found.

**5. Validate the KB:**
```
axm check . --json
```
Returns `{ files: N, errors: [...] }`. Exit code 1 if there are errors.

## Reading the output

- `value` is the full statement text with `@references` rendered inline
- `type` is `null` for untyped statements
- `file` is the absolute path to the `.axm` file containing the statement
- Search results are ordered best-match first

## Adding new statements

```
axm add "value text" . --type decision --json
```
Auto-generates a unique ID. Returns `{ id, type, value, file }`.

Supply your own ID with `--id <id>` — rejected if already exists (exit 1).

When the KB has multiple `.axm` files, specify the target with `--file <path>`.

## Suggested approach

Start with `axm index --json` to understand what types and IDs exist, then `axm search` to find relevant statements, then `axm query <id>` for full detail on a specific entry. Cross-reference `@id` mentions by querying the referenced IDs.
