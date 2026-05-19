# Core

Shared type definitions used across the Axiomate toolchain.

Intended to be imported by `parser`, `lsp`, and `cli` so that AST nodes, index structures, and error types stay in sync across packages.

Typical contents:
- AST node types (statement, type declaration, reference)
- Index schema (the global statement namespace)
- Error types
