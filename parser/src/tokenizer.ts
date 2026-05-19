import type { Range } from '@axiomate/core'

export type TokenKind = 'Keyword' | 'Identifier' | 'QuotedString' | 'Comment' | 'Unknown'

export interface Token {
  kind: TokenKind
  value: string
  range: Range
}

export function tokenizeLine(line: string, lineIndex: number): Token[] {
  const tokens: Token[] = []
  let i = 0

  function range(start: number, end: number): Range {
    return {
      start: { line: lineIndex, character: start },
      end: { line: lineIndex, character: end },
    }
  }

  while (i < line.length) {
    const ch = line[i]

    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue }

    if (ch === '/' && line[i + 1] === '/') {
      tokens.push({ kind: 'Comment', value: line.slice(i + 2).trimStart(), range: range(i, line.length) })
      break
    }

    if (ch === '"') {
      const start = i++
      let value = ''
      let closed = false
      while (i < line.length) {
        if (line[i] === '\\' && line[i + 1] === '"') { value += '\\"'; i += 2 }
        else if (line[i] === '"') { i++; closed = true; break }
        else { value += line[i++] }
      }
      tokens.push(closed
        ? { kind: 'QuotedString', value, range: range(start, i) }
        : { kind: 'Unknown', value: line.slice(start), range: range(start, line.length) })
      continue
    }

    if (/[a-zA-Z]/.test(ch)) {
      const start = i
      while (i < line.length && /[a-zA-Z0-9-]/.test(line[i])) i++
      const word = line.slice(start, i)

      if (word === 'type') {
        tokens.push({ kind: 'Keyword', value: 'type', range: range(start, i) })
      } else if (word === 'stmt') {
        if (line[i] === ':') {
          i++ // consume ':'
          if (/[a-zA-Z]/.test(line[i] ?? '')) {
            const typeStart = i
            while (i < line.length && /[a-zA-Z0-9-]/.test(line[i])) i++
            tokens.push({ kind: 'Keyword', value: `stmt:${line.slice(typeStart, i)}`, range: range(start, i) })
          } else {
            // stmt: not followed by a valid identifier
            tokens.push({ kind: 'Unknown', value: line.slice(start, i), range: range(start, i) })
          }
        } else {
          tokens.push({ kind: 'Keyword', value: 'stmt', range: range(start, i) })
        }
      } else {
        tokens.push({ kind: 'Identifier', value: word, range: range(start, i) })
      }
      continue
    }

    tokens.push({ kind: 'Unknown', value: ch, range: range(i, i + 1) })
    i++
  }

  return tokens
}
