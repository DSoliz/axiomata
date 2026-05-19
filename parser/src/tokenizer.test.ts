import { describe, expect, it } from 'vitest'
import { tokenizeLine } from './tokenizer.js'

describe('tokenizeLine', () => {
  it('returns empty array for blank line', () => {
    expect(tokenizeLine('', 0)).toEqual([])
  })

  it('returns empty array for whitespace-only line', () => {
    expect(tokenizeLine('   ', 0)).toEqual([])
  })

  it('tokenizes a full-line comment', () => {
    const tokens = tokenizeLine('// this is a comment', 0)
    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toMatchObject({ kind: 'Comment', value: 'this is a comment' })
  })

  it('tokenizes a type declaration', () => {
    const tokens = tokenizeLine('type decision "a recorded decision"', 0)
    expect(tokens).toHaveLength(3)
    expect(tokens[0]).toMatchObject({ kind: 'Keyword', value: 'type' })
    expect(tokens[1]).toMatchObject({ kind: 'Identifier', value: 'decision' })
    expect(tokens[2]).toMatchObject({ kind: 'QuotedString', value: 'a recorded decision' })
  })

  it('tokenizes a bare stmt', () => {
    const tokens = tokenizeLine('stmt df131 "value"', 0)
    expect(tokens).toHaveLength(3)
    expect(tokens[0]).toMatchObject({ kind: 'Keyword', value: 'stmt' })
    expect(tokens[1]).toMatchObject({ kind: 'Identifier', value: 'df131' })
  })

  it('tokenizes stmt:type as a single Keyword token', () => {
    const tokens = tokenizeLine('stmt:decision a1 "val"', 0)
    expect(tokens).toHaveLength(3)
    expect(tokens[0]).toMatchObject({ kind: 'Keyword', value: 'stmt:decision' })
    expect(tokens[1]).toMatchObject({ kind: 'Identifier', value: 'a1' })
  })

  it('tokenizes LSP form', () => {
    const tokens = tokenizeLine('"value" df131 stmt:decision', 0)
    expect(tokens).toHaveLength(3)
    expect(tokens[0]).toMatchObject({ kind: 'QuotedString', value: 'value' })
    expect(tokens[1]).toMatchObject({ kind: 'Identifier', value: 'df131' })
    expect(tokens[2]).toMatchObject({ kind: 'Keyword', value: 'stmt:decision' })
  })

  it('tokenizes stmt with hyphenated type name', () => {
    const tokens = tokenizeLine('stmt:domain-term fast-restaurant "desc"', 0)
    expect(tokens[0]).toMatchObject({ kind: 'Keyword', value: 'stmt:domain-term' })
    expect(tokens[1]).toMatchObject({ kind: 'Identifier', value: 'fast-restaurant' })
  })

  it('appends inline comment as a Comment token', () => {
    const tokens = tokenizeLine('stmt:decision a1 "val" // comment', 0)
    expect(tokens).toHaveLength(4)
    expect(tokens[3]).toMatchObject({ kind: 'Comment', value: 'comment' })
  })

  it('preserves escaped quote inside QuotedString value', () => {
    const tokens = tokenizeLine('stmt:decision a1 "say \\"hello\\""', 0)
    expect(tokens[2]).toMatchObject({ kind: 'QuotedString', value: 'say \\"hello\\"' })
  })

  it('produces Unknown token for unterminated string', () => {
    const tokens = tokenizeLine('stmt:decision a1 "unterminated', 0)
    expect(tokens.some(t => t.kind === 'Unknown')).toBe(true)
  })

  it('produces Unknown token for stmt: not followed by identifier', () => {
    const tokens = tokenizeLine('stmt: a1 "val"', 0)
    expect(tokens[0]).toMatchObject({ kind: 'Unknown' })
  })

  it('tracks correct character ranges', () => {
    const tokens = tokenizeLine('type decision "desc"', 5)
    expect(tokens[0].range).toEqual({ start: { line: 5, character: 0 }, end: { line: 5, character: 4 } })
    expect(tokens[1].range).toEqual({ start: { line: 5, character: 5 }, end: { line: 5, character: 13 } })
    expect(tokens[2].range).toEqual({ start: { line: 5, character: 14 }, end: { line: 5, character: 20 } })
  })

  it('QuotedString range includes both quote characters', () => {
    const tokens = tokenizeLine('"hello"', 0)
    expect(tokens[0].range).toEqual({ start: { line: 0, character: 0 }, end: { line: 0, character: 7 } })
  })
})
