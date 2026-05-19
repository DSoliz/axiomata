# Axiomate

A plain-text format for decision knowledge bases. Store architectural decisions, open questions, and domain vocabulary in `.axm` files — queryable by humans and agents alike.

## Format

```axm
// Declare named statement types
type decision "a recorded architectural or product decision"
type unknown  "an open question or unresolved matter"

// Statements: stmt[:type] <id> "<value>"
stmt:decision a1 "we will only serve @fast-restaurant food"
stmt:decision a2 "because of @a1 the website needs an order-ahead feature"
stmt:unknown  u2 "should the @fast-restaurant model apply to catering orders too"
```

`@id` references link statements. The entire knowledge base is a flat namespace across all `.axm` files in a directory — no imports needed.

## Packages

| Package | Purpose |
|---|---|
| `core` | Shared types (AST, errors, index) |
| `parser` | Tokenizer, line parser, file parser, indexer |
| `cli` | `axm` command-line tool |
| `lsp` | Language server (diagnostics, hover, completions) |
| `tree-sitter-axm` | Tree-sitter grammar for syntax highlighting |

## Getting started

```sh
pnpm install
pnpm build
```

## CLI

```sh
node cli/dist/index.js <command> [dir] [options]
```

| Command | Description |
|---|---|
| `check [dir]` | Validate all `.axm` files |
| `index [dir]` | List all types and statements |
| `query <id> [dir]` | Look up a statement by ID |
| `search <query> [dir]` | Search by ID and value text |
| `add <value> [dir]` | Append a new statement (unique ID guaranteed) |

All commands accept `--json` for machine-readable output. `index`, `search`, and `add` accept `--type <name>` to filter or tag by statement type.

```sh
# Examples
node cli/dist/index.js check ./my-kb
node cli/dist/index.js search "authentication" ./my-kb --type decision --json
node cli/dist/index.js add "we use JWT for auth" ./my-kb --type decision --id auth-jwt
```

## Editor setup (Helix)

Copy `examples/helix-languages.toml` into `~/.config/helix/languages.toml` and replace `/path/to/axiomate` with the path to this repo. Then build the grammar:

```sh
hx --grammar build
```

The LSP provides diagnostics on save, hover on `@id` references, and completions after `stmt:` and `@`.

## Claude Code skill

A `/axm` slash command is included at `.claude/commands/axm.md`. In any Claude Code session inside a KB directory, invoke it as:

```
/axm <question or task>
```
