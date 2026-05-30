import { resolve } from 'node:path'
import { loadKnowledgeBase } from '../load-kb.js'
import { formatIndex, formatTypes, groupStmtsByFile } from '../format.js'

export async function indexCommand(dir = '.', opts: { json?: boolean; type?: string; types?: boolean } = {}): Promise<void> {
  const root = resolve(dir)
  const kb = await loadKnowledgeBase(dir)
  if (opts.types) {
    const types = [...kb.index.types.values()].map(t => ({ name: t.name, description: t.description }))
    if (opts.json) {
      console.log(JSON.stringify(types, null, 2))
    } else {
      console.log(formatTypes(kb.index))
    }
    return
  }
  if (opts.json) {
    const types = [...kb.index.types.values()].map(t => ({ name: t.name, description: t.description }))
    let stmts = [...kb.index.statements.values()]
    if (opts.type !== undefined) stmts = stmts.filter(s => s.statementType === opts.type)
    const files = groupStmtsByFile(stmts, root)
    console.log(JSON.stringify({ types, files }, null, 2))
  } else {
    console.log(formatIndex(kb.index, opts.type))
  }
}
