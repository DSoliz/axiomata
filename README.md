# Axiomata

A plain-text format for decision knowledge bases. Store architectural decisions, open questions, and domain vocabulary in `.axm` files — queryable by humans and agents alike.

## Format

```axm
// Declare named statement types
type decision    "a recorded architectural or product decision"
type unknown     "an open question or unresolved matter"
type domain-term "a named concept in the shared vocabulary"

// <type> <id> "<value>"
domain-term tenant "an isolated customer account with its own data and settings"
decision    pg-jsonb "we store per-@tenant settings in a single jsonb column rather than separate tables"
decision    app-level-encryption "because of @pg-jsonb we encrypt sensitive @tenant fields at the application layer"
unknown     jsonb-evolution "how do we evolve the @pg-jsonb schema once @tenant data is in production"
```

`@id` references link statements. All `.axm` files in a KB share one flat namespace.

## Packages

| Package | Purpose |
|---|---|
| `core` | Shared types (AST, errors, index) |
| `parser` | Tokenizer, line parser, file parser, indexer |
| `cli` | `axm` command-line tool |
| `lsp` | Language server (diagnostics, hover, completions) |
| `vscode-extension` | VS Code extension (bundles the LSP, TextMate grammar) |
| `tree-sitter-axm` | Tree-sitter grammar for Helix and other tree-sitter editors |

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

This creates `types.axm` with seven recommended types (`goal`, `decision`, `unknown`, `constraint`, `assumption`, `principle`, `domain-term`) and `axmconfig.json` with `{ "include": ["*.axm"] }`.

### Plans

For scoped work (a feature plan, a spike, an RFC) that needs access to global decisions without polluting them, use `axm init-plan`:

```sh
axm init-plan "my feature" docs/plans --import docs/kb/axmconfig.json
```

This creates a timestamped plan directory (e.g. `docs/plans/2026-05-30abc-my-feature/`) containing:

- `axmconfig.json` — imports the global KB as read-only context
- `plan.axm` — your plan statements
- `types.axm` — planning-specific types: `task`, `spike`, `discussion`, `risk`, `milestone`

Plan statements can reference global IDs with `@id` and use global types. Plan IDs stay scoped to the plan — they don't appear in the global namespace. Each plan directory is independent; plans don't share a namespace with each other.

Add an `exclude` to the global KB's `axmconfig.json` so plans don't leak back into it:

```json
{ "include": ["**/*.axm"], "exclude": ["plans/**"] }
```

## CLI

```sh
axm <command> [dir] [options]
```

| Command | Description |
|---|---|
| `init [dir]` | Create `types.axm` with recommended default types |
| `init-plan <name> [dir]` | Scaffold a plan directory with `plan.axm`, `types.axm`, and `axmconfig.json` |
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

The LSP speaks standard Language Server Protocol over stdio, so any LSP-capable editor can use it.

### VS Code

See [`vscode-extension/README.md`](vscode-extension/README.md).

### Helix

See [`tree-sitter-axm/README.md`](tree-sitter-axm/README.md).

## Agent skill

A `/axm` slash command is included at `.claude/skills/axm/SKILL.md` (which links to the repository's `skills/axm/SKILL.md`). In any Claude Code or Antigravity session inside a KB directory, invoke it as:

```
/axm <question or task>
```

## Development

Working on the CLI, LSP, or grammar itself.

**Build and test:**

```sh
pnpm build      # Turbo-cached per-package build
pnpm test       # Vitest, suites live next to source as *.test.ts
```

**Fast iteration on the CLI** — skip the global reinstall by running the local build directly:

```sh
node ./cli/dist/index.js <command> [args]
# Or set a shell alias:
alias axm-dev='node /abs/path/to/axiomata/cli/dist/index.js'
```

`pnpm add -g ./cli` *copies* the package into pnpm's global store — every code change otherwise needs a rebuild plus a reinstall to update the global `axm` binary.

**Helix-specific workflows** (grammar changes, fast LSP iteration) — see [`tree-sitter-axm/README.md`](tree-sitter-axm/README.md).

**Before shipping**, verify the install path still works end-to-end:

```sh
pnpm add -g ./cli ./lsp
```
