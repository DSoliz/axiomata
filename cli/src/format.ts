import type { AxmError, IndexedStatement, KnowledgeIndex } from '@axiomate/core'
import { renderValue } from './search.js'

// ── JSON serialization ────────────────────────────────────────────────────────

export function stmtToJson(stmt: IndexedStatement) {
  return {
    id: stmt.id,
    type: stmt.statementType ?? null,
    value: renderValue(stmt.value),
    file: stmt.file,
  }
}

export function errorToJson(err: AxmError) {
  switch (err.code) {
    case 'DuplicateId':
      return { code: err.code, id: err.id, firstFile: err.firstFile, firstLine: err.firstRange.start.line + 1, secondFile: err.secondFile, secondLine: err.secondRange.start.line + 1 }
    case 'DuplicateType':
      return { code: err.code, name: err.name, firstFile: err.firstFile, firstLine: err.firstRange.start.line + 1, secondFile: err.secondFile, secondLine: err.secondRange.start.line + 1 }
    case 'UnknownType':
      return { code: err.code, name: err.name, file: err.file, line: err.range.start.line + 1 }
    case 'UnresolvedReference':
      return { code: err.code, id: err.id, file: err.file, line: err.range.start.line + 1 }
    case 'InvalidId':
      return { code: err.code, id: err.id, file: err.file, line: err.range.start.line + 1 }
    case 'ParseError':
      return { code: err.code, message: err.message, file: err.file, line: err.range.start.line + 1 }
  }
}

// ── Human-readable formatting ─────────────────────────────────────────────────

export function formatErrors(errors: AxmError[]): string {
  return errors.map(err => {
    switch (err.code) {
      case 'DuplicateId':
        return [
          `error [DuplicateId] id '${err.id}' declared in multiple places`,
          `  first: ${err.firstFile}:${err.firstRange.start.line + 1}:${err.firstRange.start.character}`,
          `  again: ${err.secondFile}:${err.secondRange.start.line + 1}:${err.secondRange.start.character}`,
        ].join('\n')
      case 'DuplicateType':
        return [
          `error [DuplicateType] type '${err.name}' declared in multiple places`,
          `  first: ${err.firstFile}:${err.firstRange.start.line + 1}:${err.firstRange.start.character}`,
          `  again: ${err.secondFile}:${err.secondRange.start.line + 1}:${err.secondRange.start.character}`,
        ].join('\n')
      case 'UnknownType':
        return `${err.file}:${err.range.start.line + 1}:${err.range.start.character} error [UnknownType] unknown type '${err.name}'`
      case 'UnresolvedReference':
        return `${err.file}:${err.range.start.line + 1}:${err.range.start.character} error [UnresolvedReference] unresolved reference '@${err.id}'`
      case 'InvalidId':
        return `${err.file}:${err.range.start.line + 1}:${err.range.start.character} error [InvalidId] invalid identifier '${err.id}'`
      case 'ParseError':
        return `${err.file}:${err.range.start.line + 1}:${err.range.start.character} error [ParseError] ${err.message}`
    }
  }).join('\n')
}

export function formatCheckSummary(errors: AxmError[], fileCount: number): string {
  if (errors.length === 0) {
    return `✓ ${fileCount} file${fileCount !== 1 ? 's' : ''}, no errors`
  }
  const count = `\n${errors.length} error${errors.length !== 1 ? 's' : ''}`
  return formatErrors(errors) + count
}

export function formatIndex(index: KnowledgeIndex, typeFilter?: string): string {
  const types = [...index.types.values()].sort((a, b) => a.name.localeCompare(b.name))
  let stmts = [...index.statements.values()].sort((a, b) => a.id.localeCompare(b.id))
  if (typeFilter !== undefined) stmts = stmts.filter(s => s.statementType === typeFilter)

  const lines: string[] = []

  if (typeFilter === undefined) {
    lines.push(`Types (${types.length})`)
    if (types.length === 0) {
      lines.push('  (none)')
    } else {
      for (const t of types) {
        lines.push(`  ${t.name.padEnd(20)} "${t.description}"`)
      }
    }
    lines.push('')
  }

  lines.push(`Statements (${stmts.length})${typeFilter !== undefined ? ` [type: ${typeFilter}]` : ''}`)
  if (stmts.length === 0) {
    lines.push('  (none)')
  } else {
    for (const s of stmts) {
      const type = s.statementType ? `[${s.statementType}]` : '[untyped]'
      lines.push(`  ${s.id.padEnd(24)} ${type.padEnd(18)} ${s.file}`)
    }
  }

  return lines.join('\n')
}

export function formatQueryResult(id: string, stmt: IndexedStatement | undefined): string {
  if (!stmt) return `error: no statement with id '${id}'`
  return [
    `id:    ${stmt.id}`,
    `type:  ${stmt.statementType ?? '(untyped)'}`,
    `file:  ${stmt.file}`,
    `value: ${renderValue(stmt.value)}`,
  ].join('\n')
}

export function formatSearchResults(stmts: IndexedStatement[], query: string): string {
  if (stmts.length === 0) return `no results for '${query}'`
  return stmts.map(s => {
    const type = s.statementType ? `[${s.statementType}]` : '[untyped]'
    return `  ${s.id.padEnd(24)} ${type.padEnd(18)} ${renderValue(s.value)}`
  }).join('\n')
}
