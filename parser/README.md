# Parser

Parses `.axm` files into an AST and builds the global index.

Depends on `core` for shared type definitions.

Responsibilities:
- Tokenize `.axm` source text
- Produce an AST per file
- Run the two-pass index build (index pass → resolution pass)
- Surface structured errors for duplicate IDs, unknown types, and unresolved references
