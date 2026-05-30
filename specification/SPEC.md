# Axiomata Format Specification

**Version**: 0.1.0  
**File extension**: `.axm`

---

## Overview

Axiomata (`.axm`) is a plain-text format for building decision knowledge bases. A knowledge base is a collection of `.axm` files. Each file contains **statements** — typed, named entries with a string value. All statements across all files in a knowledge base are globally indexed and can be referenced by any file without explicit imports.

---

## 1. File Structure

A file is a sequence of lines. There are three kinds of lines:

| Kind | Syntax | Purpose |
|---|---|---|
| Comment | `// ...` | Ignored by parsers |
| Type declaration | `type <name> "<description>"` | Define a custom statement type |
| Statement | `<type> <id> "<value>"` | Declare a named, typed statement |

Lines are processed top-to-bottom. Blank lines are ignored.

---

## 2. Comments

A comment begins with `//` and extends to the end of the line. Comments may appear on their own line or inline after a declaration.

```
// This is a comment
decision a1 "we will use PostgreSQL" // inline comment
```

---

## 3. Type Declarations

Types classify statements. A type declaration names a category and gives it a human-readable description.

```
type <name> "<description>"
```

- `name` must match `[a-zA-Z][a-zA-Z0-9\-]*` (letters, digits, hyphens)
- `description` is a double-quoted string
- `type` is a reserved keyword and cannot be used as a type name
- Re-declaring the same type name is an error

**Example** (`types.axm`)

```
type domain-term "a term that is part of the domain vocabulary"
type decision    "a recorded decision"
type unknown     "an open question or unresolved matter"
```

---

## 4. Statements

A statement is a named, typed entry with a string value.

```
<type> <id> "<value>"
```

- `<type>` must refer to a type declared somewhere in the knowledge base
- `<id>` is the statement's unique name within the knowledge base; must match `[a-zA-Z][a-zA-Z0-9\-]*`
- `<value>` is a double-quoted string; may contain inline references (see §5); escape a literal `"` as `\"`
- All statement IDs are global — two statements with the same ID anywhere in the knowledge base is an error

**Example** (`domain-language.axm`)

```
domain-term fast-restaurant "a restaurant which has no dine-in"
```

**Example** (`simple-use-case.axm`)

```
decision a1 "@fast-restaurant"
decision a2 "because of @a1 the website"
unknown  u2 "should @fast-restaurant website"
```

---

## 5. Inline References

Inside a statement's value string, any other statement can be referenced by prefixing its ID with `@`:

```
@<id>
```

`@` resolves to the statement with that ID, regardless of its type. It works the same for domain terms, decisions, unknowns, or any custom type.

```
decision a1 "@fast-restaurant"
decision a2 "because of @a1 the website"
unknown  u2 "should @fast-restaurant website"
```

Referencing an ID that does not exist anywhere in the knowledge base is an error.

A literal `"` inside a value string is escaped as `\"`.

---

## 6. Global Index

All statements declared across all `.axm` files in a knowledge base share a single flat namespace. A tool (CLI, LSP, build step) is responsible for indexing the collection.

Processing is two-pass:
1. **Index pass** — scan every file, collect all type declarations and statement IDs
2. **Resolution pass** — resolve all `@<id>` references against the completed index

This means a file can reference a statement declared in any other file regardless of file order, and forward references within a file are valid.

**Consequences**:
- Statement IDs must be unique across the entire knowledge base
- Any file can reference any statement from any other file with `@id`
- Type declarations are also globally visible after the index pass

---

## 7. KB Configuration

A knowledge base may include an `axmconfig.json` file at its root to control which files belong to it and whether it imports another KB.

```json
{
  "include": ["*.axm"],
  "import": "../axmconfig.json"
}
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `include` | `string[]` | `["*.axm"]` | Glob patterns selecting which `.axm` files belong to this KB. Relative to the config file. Supports `*.axm` (current directory only) and `**/*.axm` (recursive). |
| `exclude` | `string[]` | `[]` | Glob patterns for files or directories to exclude. Applied after `include`. Useful for omitting plan subdirectories or `node_modules` when the KB root is also a project root. |
| `import` | `string` | — | Path to another `axmconfig.json`. Statements and types from the referenced KB become available for reference resolution, but are not owned by this KB. Only one import per config is supported. |

When no `axmconfig.json` is present, the tool falls back to scanning all `.axm` files recursively from the given directory.

### Import semantics

- Imported statements and types are **readable** — they can be referenced with `@id` without producing an `UnresolvedReference` error.
- Imported statements and types are **read-only** — declaring a statement or type with the same ID as an imported one is a `DuplicateId` / `DuplicateType` error.
- Imports are **transitive** — if the imported KB itself has an import, those statements are also available.
- Circular imports produce a hard error.

### Plan pattern

Plans are scoped KBs that build on a shared global KB. Each plan lives in its own directory with its own `axmconfig.json`. Use `axm init-plan` to scaffold one:

```sh
axm init-plan "my feature" docs/plans --import docs/kb/axmconfig.json
# creates: docs/plans/2026-05-30abc-my-feature/
#            axmconfig.json   ← imports the global KB
#            plan.axm
#            types.axm        ← planning-specific types (task, spike, discussion, risk, milestone)
```

The global KB's `axmconfig.json` should exclude the plans directory so plan statements don't leak into the global namespace:

```json
{
  "include": ["**/*.axm"],
  "exclude": ["plans/**"]
}
```

Plan statements can reference global IDs with `@id` and use global types. Plan IDs do not appear in the global namespace. Plans do not share a namespace with each other — each plan directory is its own independent KB.

---

## 8. Error Cases

| Condition | Error |
|---|---|
| Duplicate statement ID anywhere in the knowledge base | `DuplicateId` |
| Duplicate type name | `DuplicateType` |
| `<type> <id>` where `<type>` is not declared | `UnknownType` |
| `@id` referencing a non-existent statement | `UnresolvedReference` |
| Malformed ID (invalid characters) | `InvalidId` |

---

## 9. Example Knowledge Base

```
types.axm
  type domain-term "a term that is part of the domain vocabulary"
  type decision    "a recorded decision"
  type unknown     "an open question or unresolved matter"

domain-language.axm
  domain-term fast-restaurant "a restaurant which has no dine-in"

simple-use-case.axm
  decision a1 "@fast-restaurant"
  decision a2 "because of @a1 the website"
  unknown  u2 "should @fast-restaurant website"
```

---

## 10. Conventions

- Keep type declarations in a shared `types.axm` file at the root of the knowledge base.
- Keep domain vocabulary in `domain-language.axm` or a `domain/` directory.
- Use short generated IDs (e.g. `df131`) for quick-entry statements; use descriptive slug IDs (e.g. `fast-restaurant`) for domain terms meant to be referenced by name.
- Use `@id` for all references regardless of the target's type.
