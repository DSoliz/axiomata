Use the `axm` CLI to answer questions about this knowledge base: $ARGUMENTS

## What axm is

`.axm` files are a plain-text knowledge base format. Each file contains:
- **type declarations** — named categories (e.g. `decision`, `unknown`, `domain-term`)
- **statements** — typed entries with an ID and a text value (e.g. `stmt:decision a1 "we chose X"`)
- **`@id` references** — inline links between statements

The CLI is the read interface. Always use `--json` so you can parse results.

## Workflow

**1. Orient yourself — list everything in the KB:**
```
node /path/to/axiomate/cli/dist/index.js index . --json
```
Returns `{ types: [...], statements: [...] }`. Each statement has `id`, `type`, `value`, `file`.

**2. Search by keyword or phrase:**
```
node /path/to/axiomate/cli/dist/index.js search "your query" . --json
```
Matches against both IDs and statement text. Returns ranked results (exact ID match first, then partial ID, then value text). Use multi-word queries to narrow results — all words must match.

**3. Filter by type:**
```
node /path/to/axiomate/cli/dist/index.js index . --json --type decision
node /path/to/axiomate/cli/dist/index.js search "query" . --json --type unknown
```
Useful when you only care about decisions, open questions, domain terms, etc.

**4. Look up a specific statement by ID:**
```
node /path/to/axiomate/cli/dist/index.js query <id> . --json
```
Returns `{ id, type, value, file }` or `null` (exit 1) if not found.

**5. Validate the KB:**
```
node /path/to/axiomate/cli/dist/index.js check . --json
```
Returns `{ files: N, errors: [...] }`. Exit code 1 if there are errors. Each error has a `code`, location, and relevant IDs/names.

## Reading the output

- `value` is the full statement text with `@references` rendered inline (e.g. `"@a1"` becomes the literal string `"@a1"`)
- `type` is `null` for untyped statements (`stmt` with no `:type`)
- `file` is the absolute path to the `.axm` file containing the statement
- Search results are ordered best-match first — prefer results near the top

## Adding new statements

```
node /path/to/axiomate/cli/dist/index.js add "value text" . --type decision --json
```
Auto-generates a unique ID and appends the statement to the `.axm` file. Returns `{ id, type, value, file }` so you know the assigned ID.

Supply your own ID with `--id <id>` — the command rejects it if the ID already exists (exit 1).

When the KB has multiple `.axm` files, specify the target with `--file <path>`.

## Suggested approach

Start with `index --json` to understand what types and IDs exist, then use `search` to find relevant statements, then `query` individual IDs when you need the full detail of a specific entry. Cross-reference `@id` mentions in values by querying the referenced IDs.
