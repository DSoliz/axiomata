import { describe, expect, it } from 'vitest'
import { tokenizeLine } from './tokenizer.js'
import { parseLine } from './line-parser.js'
import type { StatementNode, TypeDeclarationNode } from '@axiomate/core'

function parse(source: string) {
  const tokens = tokenizeLine(source, 0)
  return parseLine(tokens, 'test.axm')
}

describe('parseLine', () => {
  it('returns null for empty token array', () => {
    const { declaration, errors } = parse('')
    expect(declaration).toBeNull()
    expect(errors).toHaveLength(0)
  })

  it('returns null for comment-only line', () => {
    expect(parse('// comment').declaration).toBeNull()
  })

  it('parses a type declaration', () => {
    const { declaration, errors } = parse('type decision "a recorded decision"')
    expect(errors).toHaveLength(0)
    expect(declaration).toMatchObject<Partial<TypeDeclarationNode>>({
      kind: 'type',
      name: 'decision',
      description: 'a recorded decision',
    })
  })

  it('parses a canonical statement with a type', () => {
    const { declaration, errors } = parse('stmt:decision a1 "we adopt PostgreSQL"')
    expect(errors).toHaveLength(0)
    expect(declaration).toMatchObject<Partial<StatementNode>>({
      kind: 'statement',
      statementType: 'decision',
      id: 'a1',
    })
  })

  it('parses a canonical statement without a type', () => {
    const { declaration } = parse('stmt df131 "some value"')
    expect(declaration).toMatchObject({ kind: 'statement', statementType: null, id: 'df131' })
  })

  it('parses an LSP-form statement', () => {
    const { declaration, errors } = parse('"we adopt PostgreSQL" a1 stmt:decision')
    expect(errors).toHaveLength(0)
    expect(declaration).toMatchObject({ kind: 'statement', statementType: 'decision', id: 'a1' })
  })

  it('canonical and LSP forms produce equivalent nodes', () => {
    const canonical = parse('stmt:decision a1 "value"').declaration as StatementNode
    const lsp = parse('"value" a1 stmt:decision').declaration as StatementNode
    expect(canonical.statementType).toBe(lsp.statementType)
    expect(canonical.id).toBe(lsp.id)
    expect(canonical.value).toEqual(lsp.value)
  })

  it('strips inline comment and does not affect declaration', () => {
    const { declaration, errors } = parse('stmt:decision a1 "val" // comment')
    expect(errors).toHaveLength(0)
    expect(declaration).not.toBeNull()
  })

  it('returns ParseError for unrecognised first token', () => {
    const { declaration, errors } = parse('unknown token here')
    expect(declaration).toBeNull()
    expect(errors[0].code).toBe('ParseError')
  })

  it('returns ParseError for incomplete type declaration', () => {
    expect(parse('type').errors[0].code).toBe('ParseError')
    expect(parse('type decision').errors[0].code).toBe('ParseError')
  })

  it('returns ParseError for stmt missing id or value', () => {
    expect(parse('stmt:decision').errors[0].code).toBe('ParseError')
    expect(parse('stmt:decision a1').errors[0].code).toBe('ParseError')
  })

  it('returns ParseError for LSP form missing stmt keyword', () => {
    expect(parse('"value" a1').errors[0].code).toBe('ParseError')
  })

  it('carries ValueSegments on statement node', () => {
    const { declaration } = parse('stmt:decision a1 "because of @b1 text"')
    const stmt = declaration as StatementNode
    expect(stmt.value).toHaveLength(3)
    expect(stmt.value[1]).toMatchObject({ kind: 'reference', id: 'b1' })
  })

  it('declaration range spans the full line excluding comments', () => {
    const { declaration } = parse('type decision "desc" // comment')
    // range should end at close of the quoted string, not at the comment
    expect(declaration!.range.end.character).toBe(20)
  })
})
