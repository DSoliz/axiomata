import type { AxmError, IndexedStatement, KnowledgeIndex } from '@axiomate/core'

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

export function formatIndex(index: KnowledgeIndex): string {
  const types = [...index.types.values()].sort((a, b) => a.name.localeCompare(b.name))
  const stmts = [...index.statements.values()].sort((a, b) => a.id.localeCompare(b.id))

  const lines: string[] = []

  lines.push(`Types (${types.length})`)
  if (types.length === 0) {
    lines.push('  (none)')
  } else {
    for (const t of types) {
      lines.push(`  ${t.name.padEnd(20)} "${t.description}"`)
    }
  }

  lines.push('')
  lines.push(`Statements (${stmts.length})`)
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

  const value = stmt.value
    .map((seg: { kind: string; value?: string; id?: string }) =>
      seg.kind === 'text' ? seg.value ?? '' : `@${seg.id ?? ''}`)
    .join('')

  return [
    `id:    ${stmt.id}`,
    `type:  ${stmt.statementType ?? '(untyped)'}`,
    `file:  ${stmt.file}`,
    `value: ${value}`,
  ].join('\n')
}
