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

  if (first.kind === 'Keyword' && first.value.startsWith('stmt')) {
    return parseCanonical(meaningful, file)
  }

  if (first.kind === 'QuotedString') {
    return parseLspForm(meaningful, file)
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

function parseCanonical(tokens: Token[], file: string): { declaration: Declaration | null; errors: AxmError[] } {
  const stmtToken = tokens[0]
  const statementType = stmtToken.value === 'stmt' ? null : stmtToken.value.slice(5)

  if (tokens.length < 3 || tokens[1].kind !== 'Identifier' || tokens[2].kind !== 'QuotedString') {
    return {
      declaration: null,
      errors: [{ code: 'ParseError', message: 'expected: stmt[:<type>] <id> "<value>"', file, range: stmtToken.range }],
    }
  }

  const { segments, errors } = parseValue(tokens[2].value, tokens[2].range, file)
  const node: StatementNode = {
    kind: 'statement',
    statementType,
    id: tokens[1].value,
    value: segments,
    range: { start: stmtToken.range.start, end: tokens[2].range.end },
  }
  return { declaration: node, errors }
}

function parseLspForm(tokens: Token[], file: string): { declaration: Declaration | null; errors: AxmError[] } {
  const valueToken = tokens[0]

  if (tokens[1]?.kind !== 'Identifier') {
    return {
      declaration: null,
      errors: [{ code: 'ParseError', message: 'expected: "<value>" <id> stmt[:<type>]', file, range: valueToken.range }],
    }
  }

  const stmtToken = tokens[2]
  if (stmtToken?.kind !== 'Keyword' || !stmtToken.value.startsWith('stmt')) {
    return {
      declaration: null,
      errors: [{ code: 'ParseError', message: "expected 'stmt' or 'stmt:<type>' after id", file, range: tokens[1].range }],
    }
  }

  const statementType = stmtToken.value === 'stmt' ? null : stmtToken.value.slice(5)
  const { segments, errors } = parseValue(valueToken.value, valueToken.range, file)
  const node: StatementNode = {
    kind: 'statement',
    statementType,
    id: tokens[1].value,
    value: segments,
    range: { start: valueToken.range.start, end: stmtToken.range.end },
  }
  return { declaration: node, errors }
}
