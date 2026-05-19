import { describe, expect, it } from 'vitest'
import { parseValue } from './value-parser.js'
import type { Range } from '@axiomata/core'

function r(line: number, start: number, end: number): Range {
  return { start: { line, character: start }, end: { line, character: end } }
}

describe('parseValue', () => {
  it('parses plain text as a single TextSegment', () => {
    const { segments, errors } = parseValue('hello world', r(0, 0, 13), 'f.axm')
    expect(errors).toHaveLength(0)
    expect(segments).toEqual([{ kind: 'text', value: 'hello world' }])
  })

  it('parses a single reference', () => {
    const { segments, errors } = parseValue('@fast-restaurant', r(0, 10, 28), 'f.axm')
    expect(errors).toHaveLength(0)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ kind: 'reference', id: 'fast-restaurant' })
  })

  it('parses mixed text and reference', () => {
    const { segments } = parseValue('because of @a1 the website', r(0, 20, 48), 'f.axm')
    expect(segments).toHaveLength(3)
    expect(segments[0]).toEqual({ kind: 'text', value: 'because of ' })
    expect(segments[1]).toMatchObject({ kind: 'reference', id: 'a1' })
    expect(segments[2]).toEqual({ kind: 'text', value: ' the website' })
  })

  it('parses multiple adjacent references', () => {
    const { segments } = parseValue('@a1 and @a2', r(0, 0, 13), 'f.axm')
    expect(segments).toHaveLength(3)
    expect(segments[0]).toMatchObject({ kind: 'reference', id: 'a1' })
    expect(segments[1]).toEqual({ kind: 'text', value: ' and ' })
    expect(segments[2]).toMatchObject({ kind: 'reference', id: 'a2' })
  })

  it('treats escaped quote as literal text', () => {
    const { segments } = parseValue('say \\"hello\\"', r(0, 0, 15), 'f.axm')
    expect(segments).toEqual([{ kind: 'text', value: 'say "hello"' }])
  })

  it('treats @ followed by space as plain text', () => {
    const { segments } = parseValue('@ not a ref', r(0, 0, 13), 'f.axm')
    expect(segments).toEqual([{ kind: 'text', value: '@ not a ref' }])
  })

  it('treats @@ as plain text for the first @', () => {
    const { segments } = parseValue('@@a1', r(0, 0, 6), 'f.axm')
    // first @ is not followed by alpha immediately, second @ starts a reference
    expect(segments.some(s => s.kind === 'reference')).toBe(true)
  })

  it('returns empty array for empty raw string', () => {
    const { segments } = parseValue('', r(0, 0, 2), 'f.axm')
    expect(segments).toHaveLength(0)
  })

  it('computes correct reference range offset', () => {
    // quote at character 20: "@a1"
    // offset = 21, @ at raw pos 0 → char 21, end at raw pos 3 → char 24
    const { segments } = parseValue('@a1', r(0, 20, 25), 'f.axm')
    const ref = segments[0] as Extract<typeof segments[0], { kind: 'reference' }>
    expect(ref.range.start.character).toBe(21)
    expect(ref.range.end.character).toBe(24)
  })

  it('reference range accounts for preceding text offset', () => {
    // "abc @a1" — quote at char 0, @ is at raw offset 4
    // offset = 1, start = 1 + 4 = 5, end = 1 + 7 = 8
    const { segments } = parseValue('abc @a1', r(0, 0, 9), 'f.axm')
    const ref = segments.find(s => s.kind === 'reference') as any
    expect(ref.range.start.character).toBe(5)
    expect(ref.range.end.character).toBe(8)
  })
})
