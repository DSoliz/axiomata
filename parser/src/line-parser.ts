import type { AxmError, Declaration, StatementNode, TypeDeclarationNode } from '@axiomata/core'
import type { Token } from './tokenizer.js'
import { parseValue } from './value-parser.js'

export function parseLine(
  tokens: Token[],
  file: string,
): { declaration: Declaration | null; errors: AxmError[] } {
  const commentIdx = tokens.findIndex(t => t.kind === 'Comment')
  const meaningful = commentIdx === -1 ? tokens : tokens.slice(0, commentIdx)

  if (meaningful.length === 0) return { declaration: null, errors: [] }

  const first = meaningful[0]

  if (first.kind === 'Keyword' && first.value === 'type') {
    return parseTypeDecl(meaningful, file)
  }

  if (first.kind === 'Identifier') {
    return parseStatement(meaningful, file)
  }

  return {
    declaration: null,
    errors: [{ code: 'ParseError', message: `unexpected token '${first.value}'`, file, range: first.range }],
  }
}

function parseTypeDecl(tokens: Token[], file: string): { declaration: Declaration | null; errors: AxmError[] } {
  if (tokens.length < 3 || tokens[1].kind !== 'Identifier' || tokens[2].kind !== 'QuotedString') {
    return {
      declaration: null,
      errors: [{ code: 'ParseError', message: 'expected: type <name> "<description>"', file, range: tokens[0].range }],
    }
  }

  const { segments } = parseValue(tokens[2].value, tokens[2].range, file)
  const description = segments.map(s => s.kind === 'text' ? s.value : '').join('')

  const node: TypeDeclarationNode = {
    kind: 'type',
    name: tokens[1].value,
    description,
    range: { start: tokens[0].range.start, end: tokens[2].range.end },
  }
  return { declaration: node, errors: [] }
}

function parseStatement(tokens: Token[], file: string): { declaration: Declaration | null; errors: AxmError[] } {
  // typed:   <type> <id> "<value>"
  // untyped: <id> "<value>"
  const isTyped = tokens[1]?.kind === 'Identifier' && tokens[2]?.kind === 'QuotedString'
  const isUntyped = tokens[1]?.kind === 'QuotedString'

  if (isTyped) {
    const { segments, errors } = parseValue(tokens[2].value, tokens[2].range, file)
    const node: StatementNode = {
      kind: 'statement',
      statementType: tokens[0].value,
      id: tokens[1].value,
      value: segments,
      range: { start: tokens[0].range.start, end: tokens[2].range.end },
    }
    return { declaration: node, errors }
  }

  if (isUntyped) {
    const { segments, errors } = parseValue(tokens[1].value, tokens[1].range, file)
    const node: StatementNode = {
      kind: 'statement',
      statementType: null,
      id: tokens[0].value,
      value: segments,
      range: { start: tokens[0].range.start, end: tokens[1].range.end },
    }
    return { declaration: node, errors }
  }

  return {
    declaration: null,
    errors: [{ code: 'ParseError', message: 'expected: [<type>] <id> "<value>"', file, range: tokens[0].range }],
  }
}
