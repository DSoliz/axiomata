# Roadmap

## CLI Features

### axm.json — KB root config and namespace boundaries

Introduce an `axm.json` file that explicitly marks the root of a knowledge base, unlocking monorepo support, LSP root auto-discovery, and per-KB ignore rules. Each `axm.json` defines one independent namespace — in a monorepo, multiple KBs coexist without statement IDs bleeding across package boundaries.

Config shape: `{ "exclude": ["drafts/**", "vendor/**"] }`. The LSP walks up from the open file to find the nearest `axm.json` instead of relying on editor-provided workspace folders. The CLI walks up from `cwd` making `[dir]` optional; `axm init` writes `axm.json` alongside `types.axm`; `load-kb` reads and applies `exclude` patterns. Affects CLI + LSP.

---

## LSP Features

### High priority

### Document Symbols (`textDocument/documentSymbol`)

Powers the file outline and breadcrumbs panel in editors. Returns all statement and type declarations in the current file as a symbol tree, letting users navigate without scrolling.

Walk the existing `sourceFiles` entry for the open document and map each declaration to a `DocumentSymbol` — statements as one kind, type declarations as another. Low effort since the index already has all the data needed.

### Document Highlights (`textDocument/documentHighlight`)

Highlights every occurrence of the symbol under the cursor within the current file, without a full cross-file find-references round-trip.

Use `resolveIdAtPosition` to identify the symbol, then scan only the current file's `sourceFiles` entry for matching reference segments and the declaration range. No cross-file work needed.

### Workspace Symbols (`workspace/symbol`)

Fuzzy-search for any statement or type across all `.axm` files in the workspace, exposed via the editor's "Go to Symbol in Workspace" command palette.

Iterate `currentIndex.statements` and `currentIndex.types`, filter by the query string against IDs and type names, and return `WorkspaceSymbol` locations. Simple substring matching is sufficient to start.

### Medium priority

### Code Actions (`textDocument/codeAction`)

Quick fixes attached to diagnostics — for example, "Create missing statement `@foo`" when a reference can't be resolved, or "Rename to match declaration" for near-miss identifiers.

Map incoming diagnostic codes to fix generators: `UnresolvedReference` → offer to append a bare `stmt <id> ""` to the current file; `DuplicateId`/`DuplicateType` → offer to rename the second occurrence. Write changes via `WorkspaceEdit`.

### Code Lens (`textDocument/codeLens`)

Inline annotations rendered above statement and type declarations showing their reference count (e.g. `3 references`). Useful for spotting orphaned or heavily-used statements.

For each declaration in the open file, count references by scanning `sourceFiles` for matching reference segments — the same logic as `onReferences`. Return one `CodeLens` per declaration with the count as the title. Display-only; no command needed.

### Inlay Hints (`textDocument/inlayHint`)

Show the resolved type of a statement inline next to its declaration so users don't have to hover to see it.

For each statement declaration in the visible range, look up its `statementType` from the `sourceFiles` entry and emit an `InlayHint` of kind `Type` at the end of the ID token. Skip declarations that already have an explicit `stmt:type` — the type is already visible in the text.

### Other

### Formatting (`textDocument/formatting`)

Auto-format `.axm` files on save or on demand, normalizing whitespace, indentation, and statement ordering to a canonical style.

Re-serialize each declaration using canonical form (`stmt[:type] id "value"`), aligning columns across statements in the same block and separating type declarations from statements with a blank line. Since every line is independent, formatting is a full-document rewrite via a single `TextEdit` spanning the entire file.
