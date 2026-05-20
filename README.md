# Axiomata

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

**Requirements:** Node.js 18+, pnpm

```sh
git clone https://github.com/DSoliz/axiomata
cd axiomata
pnpm install
pnpm build
```

Ensure pnpm's global bin directory is on your PATH (only needed once, or after upgrading to pnpm v11+):

```sh
pnpm setup
source ~/.zshrc   # or ~/.bashrc / ~/.config/fish/config.fish
```

Then install the CLI and LSP globally:

```sh
pnpm add -g ./cli
pnpm add -g ./lsp
```

Verify:

```sh
axm --version
axiomata-lsp --help
```

To start a new knowledge base in your project:

```sh
axm init ./docs/kb
```

This creates `types.axm` with six recommended types: `decision`, `unknown`, `constraint`, `assumption`, `principle`, `domain-term`.

## CLI

```sh
axm <command> [dir] [options]
```

| Command | Description |
|---|---|
| `init [dir]` | Create `types.axm` with recommended default types |
| `check [dir]` | Validate all `.axm` files |
| `index [dir]` | List all types and statements |
| `query <id> [dir]` | Look up a statement by ID |
| `search <query> [dir]` | Search by ID and value text |
| `add <value> [dir]` | Append a new statement (unique ID guaranteed) |
| `refs <id> [dir]` | List references to a statement ID, or statements of a type |
| `rename <old> <new> [dir]` | Rename a statement ID or type across all files |

All commands accept `--json` for machine-readable output. `index`, `search`, and `add` accept `--type <name>` to filter or tag by statement type.

```sh
# Examples
axm check ./my-kb
axm search "authentication" ./my-kb --type decision --json
axm add "we use JWT for auth" ./my-kb --type decision --id auth-jwt
axm rename auth-jwt jwt-decision ./my-kb
```

## Editor setup (Helix)

Copy `examples/helix-languages.toml` into `~/.config/helix/languages.toml` and replace `/path/to/axiomata` with the path to this repo. Then build the grammar:

```sh
hx --grammar build
```

The LSP provides diagnostics on save, hover on `@id` references, completions after `stmt:` and `@`, go-to-definition, find references, and rename symbol.

## Agent skill

A `/axm` slash command is included at `.claude/skills/axm/SKILL.md` (which links to the repository's `skills/axm/SKILL.md`). In any Claude Code or Antigravity session inside a KB directory, invoke it as:

```
/axm <question or task>
```
