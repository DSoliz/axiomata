import { resolve, relative } from 'node:path'
import { loadKnowledgeBase } from '../load-kb.js'
import { toJson } from '../format.js'

export async function summaryCommand(dir = '.', opts: { json?: boolean; jsonMin?: boolean } = {}): Promise<void> {
  const root = resolve(dir)
  const kb = await loadKnowledgeBase(dir)

  // Build per-file statement counts (by type) and type declaration counts
  const fileCounts = new Map<string, Map<string, number>>()
  const fileTypeDeclCounts = new Map<string, number>()
  for (const file of kb.files) {
    fileCounts.set(file.path, new Map())
    fileTypeDeclCounts.set(file.path, file.declarations.filter(d => d.kind === 'type').length)
  }
  let total = 0
  for (const stmt of kb.index.statements.values()) {
    const counts = fileCounts.get(stmt.file)!
    counts.set(stmt.statementType, (counts.get(stmt.statementType) ?? 0) + 1)
    total++
  }

  if (opts.json || opts.jsonMin) {
    const files: Record<string, Record<string, number>> = {}
    for (const [filePath, counts] of fileCounts) {
      const rel = relative(root, filePath)
      const fileTotal = [...counts.values()].reduce((a, b) => a + b, 0)
      files[rel] = { total: fileTotal, typeDeclarations: fileTypeDeclCounts.get(filePath) ?? 0, ...Object.fromEntries(counts) }
    }
    console.log(toJson({ total, files }, opts.jsonMin))
  } else {
    const header = `KB Summary (${total} statement${total !== 1 ? 's' : ''}, ${kb.files.length} file${kb.files.length !== 1 ? 's' : ''})`
    const lines: string[] = [header]
    for (const [filePath, counts] of fileCounts) {
      const rel = relative(root, filePath)
      const fileTotal = [...counts.values()].reduce((a, b) => a + b, 0)
      const typeDecls = fileTypeDeclCounts.get(filePath) ?? 0
      lines.push(`\n  ${rel}  (${fileTotal} statement${fileTotal !== 1 ? 's' : ''}, ${typeDecls} type declaration${typeDecls !== 1 ? 's' : ''})`)
      for (const [type, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
        lines.push(`    ${type.padEnd(20)} ${count}`)
      }
    }
    console.log(lines.join('\n'))
  }
}
