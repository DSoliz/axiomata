# LSP

Language server for `.axm` files.

Depends on `parser` and `core`. Implements the Language Server Protocol to provide editor features:

- Diagnostics (parse and index errors in real time)
- Completions (statement IDs after `@`, type names after `stmt:`)
- Go to definition (jump to the declaration of a referenced statement)
- Hover (show the value and type of a referenced statement)
- Auto-insert on `"` (generate a unique ID and `stmt` scaffold)
