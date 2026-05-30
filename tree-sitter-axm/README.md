# tree-sitter-axm

Tree-sitter grammar for the [Axiomata](https://github.com/axiomata/axiomata) `.axm` format. Provides syntax highlighting for Helix and any other tree-sitter-enabled editor.

## Helix setup

### First-time install

1. Add the following to `~/.config/helix/languages.toml`, replacing `/path/to/axiomata` with the absolute path to this repo. Assumes `axiomata-lsp` is on `PATH`:

   ```toml
   [[language]]
   name = "axm"
   scope = "source.axm"
   file-types = ["axm"]
   comment-token = "//"
   indent = { tab-width = 2, unit = "  " }
   roots = []
   language-servers = ["axiomata-lsp"]

   [[grammar]]
   name = "axm"
   source = { path = "/path/to/axiomata/tree-sitter-axm" }

   [language-server.axiomata-lsp]
   command = "axiomata-lsp"
   ```

2. Generate and build the grammar:

   ```sh
   cd tree-sitter-axm && tree-sitter generate && cd ..
   hx --grammar build
   ```

3. Install the highlight queries — Helix does not copy these automatically:

   ```sh
   mkdir -p ~/.config/helix/runtime/queries/axm
   cp tree-sitter-axm/queries/highlights.scm ~/.config/helix/runtime/queries/axm/
   ```

Open any `.axm` file to verify highlighting and LSP features.

### After a grammar change

When `grammar.js` or `queries/highlights.scm` changes, all three steps must be repeated:

```sh
cd tree-sitter-axm && tree-sitter generate && cd ..
hx --grammar build
cp tree-sitter-axm/queries/highlights.scm ~/.config/helix/runtime/queries/axm/
```

`hx --grammar build` recompiles the parser but does **not** update the queries copy in `~/.config/helix/runtime/queries/axm/` — the manual `cp` is always required when `highlights.scm` changes.

## Development

### Fast iteration on the LSP

Point Helix at the local build so only `:lsp-restart` is needed between edits — no reinstall required:

```toml
[language-server.axiomata-lsp]
command = "node"
args = ["/abs/path/to/axiomata/lsp/dist/index.js"]
```

After each `pnpm build` from the repo root, run `:lsp-restart` in Helix to pick up the new server.

## Grammar overview

The grammar recognises three line types:

| Line | Syntax |
|---|---|
| Comment | `// ...` |
| Type declaration | `type <name> "<description>"` |
| Typed statement | `<type> <id> "<value>"` |
| Untyped statement | `<id> "<value>"` |

`type` is the only reserved keyword — it cannot be used as a type name or statement id. All other identifiers match `/[a-zA-Z][a-zA-Z0-9_-]*/`.

Inline `@id` references inside string values are highlighted as labels and are navigable via the LSP.
