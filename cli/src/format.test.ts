import { describe, expect, it } from 'vitest'
import type { AxmError, Range } from '@axiomata/core'
import { formatCheckSummary, formatErrors, formatIndex, formatQueryResult } from './format.js'
import type { KnowledgeIndex, IndexedStatement } from '@axiomata/core'

function range(line: number, char: number): Range {
  return { start: { line, character: char }, end: { line, character: char + 1 } }
}

const TYPES_INDEX: KnowledgeIndex = {
  types: new Map([
    ['decision', { name: 'decision', description: 'a decision', file: 'types.axm', range: range(0, 0) }],
    ['unknown', { name: 'unknown', description: 'an unknown', file: 'types.axm', range: range(1, 0) }],
  ]),
  statements: new Map([
    ['a1', { id: 'a1', statementType: 'decision', value: [{ kind: 'text', value: 'adopt PostgreSQL' }], file: 'simple.axm', range: range(0, 0) }],
    ['u2', { id: 'u2', statementType: 'unknown', value: [{ kind: 'text', value: 'should we scale?' }], file: 'simple.axm', range: range(1, 0) }],
  ]),
}

describe('formatErrors', () => {
  it('returns empty string for no errors', () => {
    expect(formatErrors([])).toBe('')
  })

  it('formats a ParseError', () => {
    const err: AxmError = { code: 'ParseError', message: 'unexpected token', file: 'test.axm', range: range(2, 4) }
    const out = formatErrors([err])
    expect(out).toContain('test.axm:3:4')
    expect(out).toContain('[ParseError]')
    expect(out).toContain('unexpected token')
  })

  it('formats an UnknownType error', () => {
    const err: AxmError = { code: 'UnknownType', name: 'nonexistent', file: 'test.axm', range: range(0, 0) }
    const out = formatErrors([err])
    expect(out).toContain('[UnknownType]')
    expect(out).toContain("'nonexistent'")
  })

  it('formats an UnresolvedReference error', () => {
    const err: AxmError = { code: 'UnresolvedReference', id: 'missing', file: 'test.axm', range: range(0, 0) }
    const out = formatErrors([err])
    expect(out).toContain('[UnresolvedReference]')
    expect(out).toContain('@missing')
  })

  it('formats a DuplicateId error with both locations', () => {
    const err: AxmError = {
      code: 'DuplicateId', id: 'a1',
      firstFile: 'f1.axm', firstRange: range(0, 0),
      secondFile: 'f2.axm', secondRange: range(2, 0),
    }
    const out = formatErrors([err])
    expect(out).toContain('[DuplicateId]')
    expect(out).toContain('f1.axm')
    expect(out).toContain('f2.axm')
  })

  it('formats a DuplicateType error with both locations', () => {
    const err: AxmError = {
      code: 'DuplicateType', name: 'decision',
      firstFile: 'f1.axm', firstRange: range(0, 0),
      secondFile: 'f2.axm', secondRange: range(0, 0),
    }
    const out = formatErrors([err])
    expect(out).toContain('[DuplicateType]')
    expect(out).toContain("'decision'")
  })

  it('uses 1-indexed line numbers', () => {
    const err: AxmError = { code: 'ParseError', message: 'oops', file: 'f.axm', range: range(0, 0) }
    expect(formatErrors([err])).toContain('f.axm:1:0')
  })
})

describe('formatCheckSummary', () => {
  it('shows success message when no errors', () => {
    expect(formatCheckSummary([], 3)).toBe('✓ 3 files, no errors')
  })

  it('uses singular for one file', () => {
    expect(formatCheckSummary([], 1)).toBe('✓ 1 file, no errors')
  })

  it('includes error count when there are errors', () => {
    const err: AxmError = { code: 'ParseError', message: 'bad', file: 'f.axm', range: range(0, 0) }
    const out = formatCheckSummary([err], 1)
    expect(out).toContain('1 error')
    expect(out).toContain('[ParseError]')
  })

  it('uses plural for multiple errors', () => {
    const err: AxmError = { code: 'ParseError', message: 'bad', file: 'f.axm', range: range(0, 0) }
    const out = formatCheckSummary([err, err], 2)
    expect(out).toContain('2 errors')
  })
})

describe('formatIndex', () => {
  it('lists type and statement counts', () => {
    const out = formatIndex(TYPES_INDEX)
    expect(out).toContain('Types (2)')
    expect(out).toContain('Statements (2)')
  })

  it('lists type names and descriptions', () => {
    const out = formatIndex(TYPES_INDEX)
    expect(out).toContain('decision')
    expect(out).toContain('"a decision"')
  })

  it('lists statement ids and types', () => {
    const out = formatIndex(TYPES_INDEX)
    expect(out).toContain('a1')
    expect(out).toContain('[decision]')
  })

  it('shows (none) for empty collections', () => {
    const empty: KnowledgeIndex = { types: new Map(), statements: new Map() }
    const out = formatIndex(empty)
    expect(out).toContain('Types (0)')
    expect(out).toContain('(none)')
  })

  it('sorts types and statements alphabetically', () => {
    const out = formatIndex(TYPES_INDEX)
    const decisionPos = out.indexOf('decision')
    const unknownPos = out.indexOf('unknown')
    expect(decisionPos).toBeLessThan(unknownPos)
  })
})

describe('formatQueryResult', () => {
  it('shows all fields for a found statement', () => {
    const stmt: IndexedStatement = {
      id: 'a1', statementType: 'decision',
      value: [{ kind: 'text', value: 'adopt PostgreSQL' }],
      file: 'simple.axm', range: range(0, 0),
    }
    const out = formatQueryResult('a1', stmt)
    expect(out).toContain('id:    a1')
    expect(out).toContain('type:  decision')
    expect(out).toContain('file:  simple.axm')
    expect(out).toContain('value: adopt PostgreSQL')
  })

  it('renders @references inline in value', () => {
    const stmt: IndexedStatement = {
      id: 'a2', statementType: 'decision',
      value: [
        { kind: 'text', value: 'because of ' },
        { kind: 'reference', id: 'a1', range: range(0, 0) },
        { kind: 'text', value: ' the website' },
      ],
      file: 'simple.axm', range: range(0, 0),
    }
    const out = formatQueryResult('a2', stmt)
    expect(out).toContain('because of @a1 the website')
  })

  it('shows an error message when id is not found', () => {
    const out = formatQueryResult('missing', undefined)
    expect(out).toContain("no statement with id 'missing'")
  })
})
