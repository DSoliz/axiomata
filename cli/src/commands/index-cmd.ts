import { loadKnowledgeBase } from '../load-kb.js'
import { formatIndex, stmtToJson } from '../format.js'

export async function indexCommand(dir = '.', opts: { json?: boolean; type?: string } = {}): Promise<void> {
  const kb = await loadKnowledgeBase(dir)
  if (opts.json) {
    const types = [...kb.index.types.values()].map(t => ({ name: t.name, description: t.description }))
    let stmts = [...kb.index.statements.values()]
    if (opts.type !== undefined) stmts = stmts.filter(s => s.statementType === opts.type)
    console.log(JSON.stringify({ types, statements: stmts.map(stmtToJson) }, null, 2))
  } else {
    console.log(formatIndex(kb.index, opts.type))
  }
}
