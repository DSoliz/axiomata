# LSP Feature Roadmap

Features planned for the Axiomate language server, grouped by priority.

---

## High Priority

### Document Symbols (`textDocument/documentSymbol`)
Powers the file outline and breadcrumbs panel in editors. Returns all statement and type declarations in the current file as a symbol tree, letting users navigate the file structure without scrolling.

### Document Highlights (`textDocument/documentHighlight`)
Highlights every occurrence of the symbol under the cursor within the current file. Faster than a full "find references" round-trip — purely local to the open document.

### Workspace Symbols (`workspace/symbol`)
Fuzzy-search for any statement or type across all `.axm` files in the workspace. Exposed via the editor's "Go to Symbol in Workspace" command palette entry.

---

## Medium Priority

### Code Actions (`textDocument/codeAction`)
Quick fixes attached to diagnostics. Examples:
- "Create missing statement `@foo`" when a reference can't be resolved
- "Rename to match declaration" for near-miss identifiers

### Code Lens (`textDocument/codeLens`)
Inline annotations rendered above statement and type declarations showing their reference count (e.g. `3 references`). Useful for spotting orphaned or heavily-used statements without running find-references manually.

### Inlay Hints (`textDocument/inlayHint`)
Show the resolved type of a statement inline next to its declaration, so users don't have to hover to see it.

---

## Other

### Formatting (`textDocument/formatting`)
Auto-format `.axm` files on save or on demand. Normalizes whitespace, indentation, and statement ordering to a canonical style.
