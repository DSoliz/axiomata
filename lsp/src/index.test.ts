import { mkdtemp, rm, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { FileChangeType } from 'vscode-languageserver/node.js'
import { resolveIdAtPosition, handleDefinition, handlePrepareRename, handleRename, handleWatchedFileChange, sourceFiles, currentIndex, documents } from './index.js'
import type { SourceFile, IndexedType, IndexedStatement } from '@axiomata/core'

describe('LSP Go to Definition', () => {
  const fileUri = 'file:///test/kb/simple.axm'

  beforeEach(() => {
    sourceFiles.clear()
    currentIndex.types.clear()
    currentIndex.statements.clear()
    vi.restoreAllMocks()
  })

  it('resolves statement reference and goes to its definition', () => {
    // 1. Setup mock source files
    const sourceFile: SourceFile = {
      path: '/test/kb/simple.axm',
      declarations: [
        {
          kind: 'statement',
          statementType: 'decision',
          id: 'a1',
          value: [{ kind: 'text', value: 'we will serve JWT' }],
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 34 } }
        },
        {
          kind: 'statement',
          statementType: 'decision',
          id: 'a2',
          value: [
            { kind: 'text', value: 'because of ' },
            { kind: 'reference', id: 'a1', range: { start: { line: 2, character: 28 }, end: { line: 2, character: 31 } } }
          ],
          range: { start: { line: 2, character: 0 }, end: { line: 2, character: 32 } }
        }
      ]
    }
    sourceFiles.set(fileUri, sourceFile)

    // 2. Setup mock indexes
    const stmt1: IndexedStatement = {
      id: 'a1',
      statementType: 'decision',
      value: [{ kind: 'text', value: 'we will serve JWT' }],
      file: '/test/kb/simple.axm',
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 34 } }
    }
    currentIndex.statements.set('a1', stmt1)

    // 3. Mock documents.get
    const mockDoc = {
      getText: () => 'stmt:decision a2 "because of @a1"'
    }
    vi.spyOn(documents, 'get').mockReturnValue(mockDoc as any)

    // Test resolving reference "@a1" at line 2, character 29 (inside range [28, 31])
    const pos = { line: 2, character: 29 }
    const resolved = resolveIdAtPosition(fileUri, pos)
    expect(resolved).toEqual({ kind: 'statement', id: 'a1' })

    // Test Go to Definition
    const definition = handleDefinition({
      textDocument: { uri: fileUri },
      position: pos
    })
    expect(definition).toEqual({
      uri: 'file:///test/kb/simple.axm',
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 34 }
      }
    })
  })

  it('resolves type name in stmt:<type> and goes to its definition', () => {
    // 1. Setup mock source files
    const sourceFile: SourceFile = {
      path: '/test/kb/simple.axm',
      declarations: [
        {
          kind: 'type',
          name: 'decision',
          description: 'a decision',
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 27 } }
        },
        {
          kind: 'statement',
          statementType: 'decision',
          id: 'a1',
          value: [{ kind: 'text', value: 'we will serve JWT' }],
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 34 } }
        }
      ]
    }
    sourceFiles.set(fileUri, sourceFile)

    // 2. Setup mock indexes
    const type1: IndexedType = {
      name: 'decision',
      description: 'a decision',
      file: '/test/kb/simple.axm',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 27 } }
    }
    currentIndex.types.set('decision', type1)

    // 3. Mock documents.get returning the line containing stmt:decision
    const mockDoc = {
      getText: () => 'stmt:decision a1 "we will serve JWT"'
    }
    vi.spyOn(documents, 'get').mockReturnValue(mockDoc as any)

    // Test resolving type name "decision" at line 1, character 7 (inside "stmt:decision")
    const pos = { line: 1, character: 7 }
    const resolved = resolveIdAtPosition(fileUri, pos)
    expect(resolved).toEqual({ kind: 'type', name: 'decision' })

    // Test Go to Definition
    const definition = handleDefinition({
      textDocument: { uri: fileUri },
      position: pos
    })
    expect(definition).toEqual({
      uri: 'file:///test/kb/simple.axm',
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 27 }
      }
    })
  })

  it('returns null when position does not resolve to any token', () => {
    const sourceFile: SourceFile = {
      path: '/test/kb/simple.axm',
      declarations: [
        {
          kind: 'statement',
          statementType: 'decision',
          id: 'a1',
          value: [{ kind: 'text', value: 'we will serve JWT' }],
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 34 } }
        }
      ]
    }
    sourceFiles.set(fileUri, sourceFile)

    const mockDoc = { getText: () => 'stmt:decision a1 "we will serve JWT"' }
    vi.spyOn(documents, 'get').mockReturnValue(mockDoc as any)

    expect(resolveIdAtPosition(fileUri, { line: 99, character: 0 })).toBeNull()
    expect(handleDefinition({ textDocument: { uri: fileUri }, position: { line: 99, character: 0 } })).toBeNull()
  })

  it('returns null when resolved id is not in the index (missing-id edge case)', () => {
    const sourceFile: SourceFile = {
      path: '/test/kb/simple.axm',
      declarations: [
        {
          kind: 'statement',
          statementType: 'decision',
          id: 'a2',
          value: [
            { kind: 'text', value: 'because of ' },
            { kind: 'reference', id: 'missing', range: { start: { line: 1, character: 11 }, end: { line: 1, character: 18 } } }
          ],
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 19 } }
        }
      ]
    }
    sourceFiles.set(fileUri, sourceFile)

    const mockDoc = { getText: () => 'stmt:decision a2 "because of @missing"' }
    vi.spyOn(documents, 'get').mockReturnValue(mockDoc as any)

    // 'missing' resolves positionally but has no entry in the index
    expect(handleDefinition({ textDocument: { uri: fileUri }, position: { line: 1, character: 14 } })).toBeNull()
  })
})

describe('Potential issue cases', () => {
  const fileUri = 'file:///test/kb/simple.axm'

  beforeEach(() => {
    sourceFiles.clear()
    currentIndex.types.clear()
    currentIndex.statements.clear()
    vi.restoreAllMocks()
  })

  it('resolves to the statement body instead of the type when document is not open in editor', () => {
    // When documents.get returns undefined the stmt:<type> regex block at
    // index.ts:212 is skipped. Control falls through to the generic declaration
    // scanner, which matches the statement declaration on the same line.
    // Result: Go to Definition jumps to the *statement body* rather than the
    // type definition — wrong navigation target for the user.
    const sourceFile: SourceFile = {
      path: '/test/kb/simple.axm',
      declarations: [
        {
          kind: 'statement',
          statementType: 'decision',
          id: 'a1',
          value: [{ kind: 'text', value: 'we will serve JWT' }],
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 34 } }
        }
      ]
    }
    sourceFiles.set(fileUri, sourceFile)

    // With document open: the regex path fires and resolves to the type.
    vi.spyOn(documents, 'get').mockReturnValue({
      getText: () => 'stmt:decision a1 "we will serve JWT"'
    } as any)
    expect(resolveIdAtPosition(fileUri, { line: 0, character: 7 }))
      .toEqual({ kind: 'type', name: 'decision' })

    // Without document open (documents.get returns undefined): falls through
    // to the declaration range scanner, returning the statement instead.
    vi.restoreAllMocks()
    expect(resolveIdAtPosition(fileUri, { line: 0, character: 7 }))
      .toEqual({ kind: 'statement', id: 'a1' }) // wrong: should be { kind: 'type' }
  })

  it('hasStatementDecl guard blocks the regex path but the fallback range scan still resolves the type', () => {
    // hasStatementDecl (index.ts:214) requires a *statement* declaration at the
    // cursor line before the regex runs. When only a type declaration is present,
    // the guard is false and the regex block is skipped entirely — getText is
    // never called. The fallback range scanner at index.ts:233 then picks up the
    // type declaration via its range, so the final result is still correct. This
    // means getText mock fragility is invisible in this path: a bug in the getText
    // range would never surface because getText is not called at all.
    const sourceFile: SourceFile = {
      path: '/test/kb/simple.axm',
      declarations: [
        {
          kind: 'type',
          name: 'decision',
          description: 'a decision',
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 27 } }
        }
        // No statement declaration → hasStatementDecl is false for every line
      ]
    }
    sourceFiles.set(fileUri, sourceFile)

    const mockDoc = { getText: vi.fn().mockReturnValue('stmt:decision a1 "we will serve JWT"') }
    vi.spyOn(documents, 'get').mockReturnValue(mockDoc as any)

    // Result is correct (type resolves), but via the fallback path — not the regex.
    expect(resolveIdAtPosition(fileUri, { line: 0, character: 7 }))
      .toEqual({ kind: 'type', name: 'decision' })

    // getText was never called because the hasStatementDecl guard blocked the regex block.
    expect(mockDoc.getText).not.toHaveBeenCalled()
  })

  it('getText mock is range-agnostic, so a wrong range in production would not be caught', () => {
    // The existing getText mock returns a fixed string regardless of the range
    // argument. If index.ts ever queried the wrong line/character range, tests
    // would still pass. This test pins the range actually used so a regression
    // would surface.
    const mockDoc = { getText: vi.fn().mockReturnValue('stmt:decision a1 "we will serve JWT"') }
    vi.spyOn(documents, 'get').mockReturnValue(mockDoc as any)

    const sourceFile: SourceFile = {
      path: '/test/kb/simple.axm',
      declarations: [
        {
          kind: 'statement',
          statementType: 'decision',
          id: 'a1',
          value: [{ kind: 'text', value: 'we will serve JWT' }],
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 34 } }
        }
      ]
    }
    sourceFiles.set(fileUri, sourceFile)

    resolveIdAtPosition(fileUri, { line: 1, character: 7 })

    // Pin the range production code passes so any change becomes visible
    expect(mockDoc.getText).toHaveBeenCalledWith({
      start: { line: 1, character: 0 },
      end: { line: 1, character: Number.MAX_SAFE_INTEGER }
    })

    // Demonstrate mock fragility: it returns the same line-1 text even when
    // queried for a completely different range (line 99). A stricter mock
    // would reject this call.
    expect(mockDoc.getText({ start: { line: 99, character: 0 }, end: { line: 99, character: 5 } }))
      .toBe('stmt:decision a1 "we will serve JWT"')
  })
})

describe('Hyphenated symbol rename', () => {
  // Hyphens are valid in axm identifiers but break editor word-boundary detection.
  // Without prepareRename, an editor pre-fills only 'fast' or 'restaurant' instead
  // of the full 'fast-restaurant'. These tests pin the correct behaviour.

  const fileUri = 'file:///test/kb/simple.axm'

  beforeEach(() => {
    sourceFiles.clear()
    currentIndex.types.clear()
    currentIndex.statements.clear()
    vi.restoreAllMocks()
  })

  it('prepareRename on @fast-restaurant reference returns the full hyphenated id range', async () => {
    // @fast-restaurant: '@' at char 28, id 'fast-restaurant' spans chars 29-43
    const sourceFile: SourceFile = {
      path: '/test/kb/simple.axm',
      declarations: [
        {
          kind: 'statement',
          statementType: 'decision',
          id: 'a1',
          value: [
            { kind: 'text', value: 'because of ' },
            {
              kind: 'reference',
              id: 'fast-restaurant',
              range: { start: { line: 0, character: 28 }, end: { line: 0, character: 44 } },
            },
          ],
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 45 } },
        },
      ],
    }
    sourceFiles.set(fileUri, sourceFile)
    currentIndex.statements.set('fast-restaurant', {
      id: 'fast-restaurant',
      statementType: 'domain-term',
      value: [{ kind: 'text', value: 'a restaurant that serves fast food' }],
      file: '/test/kb/simple.axm',
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 60 } },
    })

    // Cursor inside '@fast-restaurant' — char 30 is inside 'fast-restaurant' (after '@')
    const result = await handlePrepareRename({ textDocument: { uri: fileUri }, position: { line: 0, character: 30 } })

    // range must cover the full 'fast-restaurant', not just 'fast' (which stops at '-')
    expect(result).toEqual({
      range: {
        start: { line: 0, character: 29 }, // one past the '@'
        end: { line: 0, character: 44 },
      },
      placeholder: 'fast-restaurant',
    })
  })

  it('prepareRename on a hyphenated declaration id returns the full token range', async () => {
    // 'stmt:domain-term fast-restaurant "..."' — the id token spans chars 16-31
    const sourceFile: SourceFile = {
      path: '/test/kb/simple.axm',
      declarations: [
        {
          kind: 'statement',
          statementType: 'domain-term',
          id: 'fast-restaurant',
          value: [{ kind: 'text', value: 'a restaurant that serves fast food' }],
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 60 } },
        },
      ],
    }
    sourceFiles.set(fileUri, sourceFile)
    currentIndex.statements.set('fast-restaurant', {
      id: 'fast-restaurant',
      statementType: 'domain-term',
      value: [{ kind: 'text', value: 'a restaurant that serves fast food' }],
      file: '/test/kb/simple.axm',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 60 } },
    })

    vi.spyOn(documents, 'get').mockReturnValue({
      getText: () => 'stmt:domain-term fast-restaurant "a restaurant that serves fast food"',
    } as any)

    // Cursor on 'restaurant' part of 'fast-restaurant' (char 22, inside 'fast-restaurant')
    const result = await handlePrepareRename({ textDocument: { uri: fileUri }, position: { line: 0, character: 22 } })

    // 'stmt:domain-term ' is 17 chars (0–16), so 'fast-restaurant' spans 17–32
    expect(result).toEqual({
      range: {
        start: { line: 0, character: 17 },
        end: { line: 0, character: 32 },
      },
      placeholder: 'fast-restaurant',
    })
  })

  it('handleRename renames a hyphenated id across all references', async () => {
    const sourceFile: SourceFile = {
      path: '/test/kb/simple.axm',
      declarations: [
        {
          kind: 'statement',
          statementType: 'domain-term',
          id: 'fast-restaurant',
          value: [{ kind: 'text', value: 'a restaurant that serves fast food' }],
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 60 } },
        },
        {
          kind: 'statement',
          statementType: 'decision',
          id: 'a1',
          value: [
            { kind: 'text', value: 'we only serve ' },
            {
              kind: 'reference',
              id: 'fast-restaurant',
              range: { start: { line: 1, character: 32 }, end: { line: 1, character: 48 } },
            },
          ],
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 49 } },
        },
      ],
    }
    sourceFiles.set(fileUri, sourceFile)
    currentIndex.statements.set('fast-restaurant', {
      id: 'fast-restaurant',
      statementType: 'domain-term',
      value: [{ kind: 'text', value: 'a restaurant that serves fast food' }],
      file: '/test/kb/simple.axm',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 60 } },
    })

    vi.spyOn(documents, 'get').mockReturnValue({
      getText: () => 'stmt:domain-term fast-restaurant "a restaurant that serves fast food"',
    } as any)

    // Cursor on the declaration id 'fast-restaurant'
    const result = await handleRename({
      textDocument: { uri: fileUri },
      position: { line: 0, character: 22 },
      newName: 'quick-eats',
    })

    expect(result).not.toBeNull()
    const changes = result!.changes![fileUri]
    expect(changes).toHaveLength(2) // declaration + 1 reference

    // Declaration edit: 'fast-restaurant' spans chars 17–32 on line 0
    // ('stmt:domain-term ' is 17 chars, 'fast-restaurant' is 15 chars)
    expect(changes).toContainEqual({
      range: { start: { line: 0, character: 17 }, end: { line: 0, character: 32 } },
      newText: 'quick-eats',
    })
    // Reference edit: '@fast-restaurant' → '@quick-eats' (starts at char 32, id at 33–48)
    expect(changes).toContainEqual({
      range: { start: { line: 1, character: 32 }, end: { line: 1, character: 48 } },
      newText: '@quick-eats',
    })
  })
})

describe('LSP watched-file change handling', () => {
  let dir: string

  beforeEach(async () => {
    sourceFiles.clear()
    currentIndex.types.clear()
    currentIndex.statements.clear()
    vi.restoreAllMocks()
    dir = await mkdtemp(join(tmpdir(), 'axm-lsp-watch-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  async function write(name: string, content: string): Promise<string> {
    const path = join(dir, name)
    await writeFile(path, content, 'utf-8')
    return pathToFileURL(path).toString()
  }

  it('Created event reads the file from disk and indexes it', async () => {
    const uri = await write('types.axm', 'type decision "a decision"')
    const touched = await handleWatchedFileChange(uri, FileChangeType.Created)
    expect(touched).toBe(true)
    expect(sourceFiles.has(uri)).toBe(true)
    expect(sourceFiles.get(uri)!.declarations).toHaveLength(1)
  })

  it('Changed event re-reads the file and replaces the prior parse', async () => {
    const uri = await write('kb.axm', 'type decision "a decision"')
    await handleWatchedFileChange(uri, FileChangeType.Created)
    expect(sourceFiles.get(uri)!.declarations).toHaveLength(1)

    await write('kb.axm', [
      'type decision "a decision"',
      'type unknown "an open question"',
    ].join('\n'))
    const touched = await handleWatchedFileChange(uri, FileChangeType.Changed)
    expect(touched).toBe(true)
    expect(sourceFiles.get(uri)!.declarations).toHaveLength(2)
  })

  it('Deleted event removes the file from the index', async () => {
    const uri = await write('kb.axm', 'type decision "a decision"')
    await handleWatchedFileChange(uri, FileChangeType.Created)
    expect(sourceFiles.has(uri)).toBe(true)

    await unlink(new URL(uri))
    const touched = await handleWatchedFileChange(uri, FileChangeType.Deleted)
    expect(touched).toBe(true)
    expect(sourceFiles.has(uri)).toBe(false)
  })

  it('Deleted event for an unknown URI is a no-op', async () => {
    const touched = await handleWatchedFileChange(
      'file:///nonexistent/path.axm',
      FileChangeType.Deleted,
    )
    expect(touched).toBe(false)
  })

  it('skips files currently open in the editor — those sync via textDocument/didChange', async () => {
    const uri = await write('open.axm', 'type decision "a decision"')
    vi.spyOn(documents, 'get').mockReturnValue({ uri } as any)

    const touched = await handleWatchedFileChange(uri, FileChangeType.Changed)
    expect(touched).toBe(false)
    expect(sourceFiles.has(uri)).toBe(false)
  })

  it('treats a Changed event for a file that vanished mid-flight as a delete', async () => {
    const uri = await write('racing.axm', 'type decision "a decision"')
    await handleWatchedFileChange(uri, FileChangeType.Created)
    expect(sourceFiles.has(uri)).toBe(true)

    await unlink(new URL(uri))
    const touched = await handleWatchedFileChange(uri, FileChangeType.Changed)
    expect(touched).toBe(true)
    expect(sourceFiles.has(uri)).toBe(false)
  })
})
