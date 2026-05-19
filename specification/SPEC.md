# Axiomate Format Specification

**Version**: 0.1.0  
**File extension**: `.axm`

---

## Overview

Axiomate (`.axm`) is a plain-text format for building decision knowledge bases. A knowledge base is a collection of `.axm` files. Each file contains **statements** — typed, named entries with a string value. All statements across all files in a knowledge base are globally indexed and can be referenced by any file without explicit imports.

---

## 1. File Structure

A file is a sequence of lines. There are three kinds of lines:

| Kind | Syntax | Purpose |
|---|---|---|
| Comment | `// ...` | Ignored by parsers |
| Type declaration | `type <name> "<description>"` | Define a custom statement type |
| Statement | `stmt[:<type>] <id> "<value>"` | Declare a named, typed statement |

Lines are processed top-to-bottom. Blank lines are ignored.

---

## 2. Comments

A comment begins with `//` and extends to the end of the line. Comments may appear on their own line or inline after a declaration.

```
// This is a comment
stmt:decision a1 "we will use PostgreSQL" // inline comment
```

---

## 3. Type Declarations

Types classify statements. A type declaration names a category and gives it a human-readable description.

```
type <name> "<description>"
```

- `name` must match `[a-zA-Z][a-zA-Z0-9\-]*` (letters, digits, hyphens)
- `description` is a double-quoted string
- Types must be declared before they are used as a `stmt` type within the same file, or in a file that is processed before this one in the knowledge base
- Re-declaring the same type name is an error

**Example** (`types.axm`)

```
type domain-term "a term that is part of the domain vocabulary"
type decision    "a recorded decision"
type unknown     "an open question or unresolved matter"
```

---

## 4. Statements

A statement is a typed, named entry with a string value.

```
stmt[:<type>] <id> "<value>"
```

- `stmt` without a `:` suffix creates a statement with no type (generic)
- `<type>` must refer to a type declared somewhere in the knowledge base
- `<id>` is the statement's unique name within the knowledge base; must match `[a-zA-Z][a-zA-Z0-9\-]*`
- `<value>` is a double-quoted string; may contain inline references (see §6); escape a literal `"` as `\"`
- All statement IDs are global — two statements with the same ID anywhere in the knowledge base is an error

**Example** (`domain-language.axm`)

```
stmt:domain-term fast-restaurant "a restaurant which has no dine-in"
```

**Example** (`simple-use-case.axm`)

```
stmt:decision a1 "@fast-restaurant"
stmt:decision a2 "because of #a1 the website"
stmt:unknown  u2 "should @fast-restaurant website"
```

---

## 5. LSP-Assisted Statement Creation

When authoring with an LSP-enabled editor, statements can also be written in **value-first order**:

```
"<value>" <id> stmt[:<type>]
```

This form exists to support a rapid-entry workflow: as soon as the user opens a `"`, the LSP inserts a generated unique ID and the `stmt` keyword, letting the author type the value first. The author can then append `:<type>` to assign a type.

Both orderings are semantically identical. The canonical form for storage and display is `stmt[:<type>] <id> "<value>"`.

**Workflow example**

```
// user types: "
// LSP expands to:
"" df131 stmt

// user fills in value and optionally types : for type completion:
"a restaurant which has no dine-in" df131 stmt:domain-term
```

---

## 6. Inline References

Inside a statement's value string, any other statement can be referenced by prefixing its ID with `@`:

```
@<id>
```

`@` resolves to the statement with that ID, regardless of its type. It works the same for domain terms, decisions, unknowns, or any custom type.

```
stmt:decision a1 "@fast-restaurant"
stmt:decision a2 "because of @a1 the website"
stmt:unknown  u2 "should @fast-restaurant website"
```

Referencing an ID that does not exist anywhere in the knowledge base is an error.

A literal `"` inside a value string is escaped as `\"`.

---

## 7. Global Index

All statements declared across all `.axm` files in a knowledge base share a single flat namespace. There are no explicit imports. A tool (CLI, LSP, build step) is responsible for indexing the collection.

Processing is two-pass:
1. **Index pass** — scan every file, collect all type declarations and statement IDs
2. **Resolution pass** — resolve all `@<id>` references against the completed index

This means a file can reference a statement declared in any other file regardless of file order, and forward references within a file are valid.

**Consequences**:
- Statement IDs must be unique across the entire knowledge base
- Any file can reference any statement from any other file with `@id`
- Type declarations are also globally visible after the index pass

---

## 8. Error Cases

| Condition | Error |
|---|---|
| Duplicate statement ID anywhere in the knowledge base | `DuplicateId` |
| Duplicate type name | `DuplicateType` |
| `stmt:<type>` where `<type>` is not declared | `UnknownType` |
| `@id` or `#id` referencing a non-existent statement | `UnresolvedReference` |
| Malformed ID (invalid characters) | `InvalidId` |

---

## 9. Example Knowledge Base

```
types.axm
  type domain-term "a term that is part of the domain vocabulary"
  type decision    "a recorded decision"
  type unknown     "an open question or unresolved matter"

domain-language.axm
  stmt:domain-term fast-restaurant "a restaurant which has no dine-in"

simple-use-case.axm
  stmt:decision a1 "@fast-restaurant"
  stmt:decision a2 "because of @a1 the website"
  stmt:unknown  u2 "should @fast-restaurant website"
```

---

## 10. Conventions

- Keep type declarations in a shared `types.axm` file at the root of the knowledge base.
- Keep domain vocabulary in `domain-language.axm` or a `domain/` directory.
- Use short generated IDs (e.g. `df131`) for quick-entry statements; use descriptive slug IDs (e.g. `fast-restaurant`) for domain terms meant to be referenced by name.
- Use `@id` for all references regardless of the target's type.
