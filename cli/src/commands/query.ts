import { loadKnowledgeBase } from '../load-kb.js'
import { formatQueryResult, stmtToJson } from '../format.js'

export async function queryCommand(id: string, dir = '.', opts: { json?: boolean } = {}): Promise<void> {
  const kb = await loadKnowledgeBase(dir)
  const stmt = kb.index.statements.get(id)
  if (opts.json) {
    console.log(JSON.stringify(stmt ? stmtToJson(stmt) : null, null, 2))
  } else {
    console.log(formatQueryResult(id, stmt))
  }
  if (!stmt) process.exit(1)
}
