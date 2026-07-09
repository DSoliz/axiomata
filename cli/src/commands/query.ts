import { loadKnowledgeBase } from '../load-kb.js'
import { formatQueryResult, stmtToJson, toJson } from '../format.js'

export async function queryCommand(id: string, dir = '.', opts: { json?: boolean; jsonMin?: boolean } = {}): Promise<void> {
  const kb = await loadKnowledgeBase(dir)
  const stmt = kb.index.statements.get(id) ?? kb.globalIndex?.statements.get(id)
  if (opts.json || opts.jsonMin) {
    console.log(toJson(stmt ? stmtToJson(stmt) : null, opts.jsonMin))
  } else {
    console.log(formatQueryResult(id, stmt))
  }
  if (!stmt) process.exit(1)
}
