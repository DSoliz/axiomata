import { describe, expect, it } from 'vitest'
import type { Declaration } from '@axiomate/core'
import { parseFile } from './parse-file.js'

const TYPES = `type domain-term "a domain term"
type decision "a decision"
type unknown "an unknown"`

const DOMAIN = `// domt as in domain-term
stmt:domain-term fast-restaurant "a restaurant which has no dine-in"`

const SIMPLE = `// This is a comment

stmt:decision a1 "@fast-restaurant"
stmt:decision a2 "because of @a1 the website"
stmt:unknown u2 "should @fast-restaurant website"`

describe('parseFile', () => {
  it('handles empty file', () => {
    const { file, errors } = parseFile('', 'empty.axm')
    expect(file.declarations).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  it('handles a file of only comments and blank lines', () => {
    const { file, errors } = parseFile('// a comment\n\n// another', 'comments.axm')
    expect(file.declarations).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  it('parses types.axm correctly', () => {
    const { file, errors } = parseFile(TYPES, 'types.axm')
    expect(errors).toHaveLength(0)
    expect(file.declarations).toHaveLength(3)
    expect(file.declarations.every((d: Declaration) => d.kind === 'type')).toBe(true)
  })

  it('parses domain-language.axm correctly', () => {
    const { file, errors } = parseFile(DOMAIN, 'domain-language.axm')
    expect(errors).toHaveLength(0)
    expect(file.declarations).toHaveLength(1)
    expect(file.declarations[0]).toMatchObject({
      kind: 'statement',
      statementType: 'domain-term',
      id: 'fast-restaurant',
    })
  })

  it('parses simple-use-case.axm statements correctly', () => {
    const { file, errors } = parseFile(SIMPLE, 'simple.axm')
    expect(errors).toHaveLength(0)
    expect(file.declarations).toHaveLength(3)
    expect(file.declarations.map((d: Declaration) => (d as any).id)).toEqual(['a1', 'a2', 'u2'])
  })

  it('accumulates errors and still returns valid declarations', () => {
    const source = `type decision "valid"\n!!!\nstmt:decision a1 "also valid"`
    const { file, errors } = parseFile(source, 'test.axm')
    expect(errors.length).toBeGreaterThan(0)
    expect(file.declarations).toHaveLength(2)
  })

  it('handles Windows line endings', () => {
    const { file, errors } = parseFile('type decision "desc"\r\nstmt:decision a1 "val"', 'test.axm')
    expect(errors).toHaveLength(0)
    expect(file.declarations).toHaveLength(2)
  })

  it('sets the correct file path on the returned SourceFile', () => {
    const { file } = parseFile('', '/kb/test.axm')
    expect(file.path).toBe('/kb/test.axm')
  })

  it('error ranges reference the correct line number', () => {
    const source = 'type decision "valid"\n!!!\nstmt:decision a1 "valid"'
    const { errors } = parseFile(source, 'test.axm')
    expect((errors[0] as { range: { start: { line: number } } }).range.start.line).toBe(1)
  })

  it('handles file with trailing newline', () => {
    const { file, errors } = parseFile('type decision "desc"\n', 'test.axm')
    expect(errors).toHaveLength(0)
    expect(file.declarations).toHaveLength(1)
  })
})
