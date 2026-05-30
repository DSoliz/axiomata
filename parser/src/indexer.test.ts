import { describe, expect, it } from 'vitest'
import { parseFile } from './parse-file.js'
import { buildIndex } from './indexer.js'
import type { SourceFile } from '@axiomata/core'

const TYPES = `type domain-term "a domain term"
type decision "a decision"
type unknown "an unknown"`

const DOMAIN = `domain-term fast-restaurant "a restaurant which has no dine-in"`

const SIMPLE = `decision a1 "@fast-restaurant"
decision a2 "because of @a1 the website"
unknown u2 "should @fast-restaurant website"`

function files(...sources: Array<[string, string]>): SourceFile[] {
  return sources.map(([src, path]) => parseFile(src, path).file)
}

describe('buildIndex', () => {
  it('returns an empty index for no files', () => {
    const { index, errors } = buildIndex([])
    expect(errors).toHaveLength(0)
    expect(index.types.size).toBe(0)
    expect(index.statements.size).toBe(0)
  })

  it('indexes type declarations', () => {
    const { index, errors } = buildIndex(files([TYPES, 'types.axm']))
    expect(errors).toHaveLength(0)
    expect(index.types.size).toBe(3)
    expect(index.types.has('decision')).toBe(true)
    expect(index.types.has('domain-term')).toBe(true)
  })

  it('indexes statements', () => {
    const { index, errors } = buildIndex(files([TYPES, 'types.axm'], [DOMAIN, 'domain.axm']))
    expect(errors).toHaveLength(0)
    expect(index.statements.has('fast-restaurant')).toBe(true)
    expect(index.statements.get('fast-restaurant')?.statementType).toBe('domain-term')
  })

  it('resolves all references in the full example with no errors', () => {
    const { errors } = buildIndex(files(
      [TYPES, 'types.axm'],
      [DOMAIN, 'domain.axm'],
      [SIMPLE, 'simple.axm'],
    ))
    expect(errors).toHaveLength(0)
  })

  it('resolves forward references regardless of file order', () => {
    // simple.axm references statements declared in domain.axm, which comes after
    const { errors } = buildIndex(files(
      [SIMPLE, 'simple.axm'],
      [DOMAIN, 'domain.axm'],
      [TYPES, 'types.axm'],
    ))
    expect(errors).toHaveLength(0)
  })

  it('reports DuplicateId for the same id in two files', () => {
    const { errors } = buildIndex(files(
      [TYPES, 'types.axm'],
      ['decision a1 "first"', 'f1.axm'],
      ['decision a1 "second"', 'f2.axm'],
    ))
    const err = errors.find(e => e.code === 'DuplicateId')
    expect(err).toBeDefined()
    expect((err as any).id).toBe('a1')
    expect((err as any).firstFile).toBe('f1.axm')
    expect((err as any).secondFile).toBe('f2.axm')
  })

  it('reports DuplicateId for the same id within the same file', () => {
    const { errors } = buildIndex(files(
      [TYPES, 'types.axm'],
      ['decision a1 "first"\ndecision a1 "second"', 'test.axm'],
    ))
    expect(errors.some(e => e.code === 'DuplicateId')).toBe(true)
  })

  it('reports DuplicateType for the same type name across files', () => {
    const { errors } = buildIndex(files(
      ['type decision "desc"', 'f1.axm'],
      ['type decision "other"', 'f2.axm'],
    ))
    const err = errors.find(e => e.code === 'DuplicateType')
    expect(err).toBeDefined()
    expect((err as any).name).toBe('decision')
    expect((err as any).firstFile).toBe('f1.axm')
    expect((err as any).secondFile).toBe('f2.axm')
  })

  it('reports UnknownType when a stmt references an undeclared type', () => {
    const { errors } = buildIndex(files(['nonexistent a1 "val"', 'test.axm']))
    const err = errors.find(e => e.code === 'UnknownType')
    expect(err).toBeDefined()
    expect((err as any).name).toBe('nonexistent')
  })

  it('reports UnresolvedReference for an @id that is not in the index', () => {
    const { errors } = buildIndex(files(
      [TYPES, 'types.axm'],
      ['decision a1 "@doesnotexist"', 'test.axm'],
    ))
    const err = errors.find(e => e.code === 'UnresolvedReference')
    expect(err).toBeDefined()
    expect((err as any).id).toBe('doesnotexist')
  })

  it('stores the correct source file path on indexed entries', () => {
    const { index } = buildIndex(files(
      [TYPES, 'types.axm'],
      [DOMAIN, 'domain-language.axm'],
    ))
    expect(index.statements.get('fast-restaurant')?.file).toBe('domain-language.axm')
    expect(index.types.get('decision')?.file).toBe('types.axm')
  })

  it('DuplicateType error carries ranges for both declarations', () => {
    const { errors } = buildIndex(files(
      ['type decision "desc"', 'f1.axm'],
      ['type decision "other"', 'f2.axm'],
    ))
    const err = errors.find(e => e.code === 'DuplicateType') as any
    expect(err.firstRange).toBeDefined()
    expect(err.secondRange).toBeDefined()
    expect(err.firstRange.start.line).toBe(0)
    expect(err.secondRange.start.line).toBe(0)
  })
})
