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

**Requirements:** Node.js 20.1+ (for `fs.readdir` `recursive` option), pnpm

**Install at a glance:**

1. Clone: `git clone https://github.com/DSoliz/axiomata && cd axiomata`
2. Install dependencies: `pnpm install`
3. Build all packages: `pnpm build`
4. One-time pnpm global bin setup: `pnpm setup` (then start a fresh shell — see note below)
5. Install CLI + LSP globally: `pnpm add -g ./cli ./lsp` → provides the `axm` CLI and `axiomata-lsp` server
6. (Optional) configure your editor for syntax highlighting and LSP — see [Editor setup](#editor-setup) below
7. Scaffold a knowledge base: `axm init ./docs/kb`
8. (Optional) link the `/axm` agent skill so Claude Code / Antigravity sessions can query the KB — see [Agent skill](#agent-skill) below

Detail for each step follows.

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

> **Running this inside an AI coding agent (Claude Code, etc.)?** `pnpm setup` only edits your shell rc file — the agent's subshell was forked before that change and won't pick it up, even after `source`. Exit the agent, open a fresh terminal, run `pnpm setup`, then start the agent again before continuing with `pnpm add -g`.

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

## Editor setup

The LSP (`axiomata-lsp`) speaks standard Language Server Protocol over stdio, so any LSP-capable editor can use it. Point your editor at the `axiomata-lsp` command and associate it with the `axm` file type.

### Helix

1. Merge `examples/helix-languages.toml` into `~/.config/helix/languages.toml`, replacing `/path/to/axiomata` with the absolute path to this repo.
2. Build the tree-sitter grammar:

   ```sh
   hx --grammar build
   ```

3. Install the highlight queries (Helix does not copy these automatically):

   ```sh
   mkdir -p ~/.config/helix/runtime/queries/axm
   cp tree-sitter-axm/queries/highlights.scm ~/.config/helix/runtime/queries/axm/
   ```

Open any `.axm` file to verify highlighting. The LSP provides diagnostics on save, hover on `@id` references, completions after `stmt:` and `@`, go-to-definition, find references, and rename symbol.

## Agent skill

A `/axm` slash command is included at `.claude/skills/axm/SKILL.md` (which links to the repository's `skills/axm/SKILL.md`). In any Claude Code or Antigravity session inside a KB directory, invoke it as:

```
/axm <question or task>
```
