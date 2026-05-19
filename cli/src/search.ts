import type { IndexedStatement, KnowledgeIndex, ValueSegment } from '@axiomate/core'

export function renderValue(segments: ValueSegment[]): string {
  return segments.map(s => s.kind === 'text' ? s.value : `@${s.id}`).join('')
}

function scoreStatement(stmt: IndexedStatement, tokens: string[]): number {
  const id = stmt.id.toLowerCase()
  const value = renderValue(stmt.value).toLowerCase()

  let total = 0
  for (const token of tokens) {
    if (id === token) total += 3
    else if (id.includes(token)) total += 2
    else if (value.includes(token)) total += 1
    else return 0  // all tokens must match somewhere
  }
  return total
}

export function searchStatements(
  index: KnowledgeIndex,
  query: string,
  typeFilter?: string,
): IndexedStatement[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const results: { stmt: IndexedStatement; score: number }[] = []

  for (const stmt of index.statements.values()) {
    if (typeFilter !== undefined && stmt.statementType !== typeFilter) continue
    const s = scoreStatement(stmt, tokens)
    if (s > 0) results.push({ stmt, score: s })
  }

  return results
    .sort((a, b) => b.score - a.score || a.stmt.id.localeCompare(b.stmt.id))
    .map(r => r.stmt)
}
