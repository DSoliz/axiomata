import { loadKnowledgeBase } from '../load-kb.js'
import { formatQueryResult } from '../format.js'

export async function queryCommand(id: string, dir: string = '.'): Promise<void> {
  const kb = await loadKnowledgeBase(dir)
  const stmt = kb.index.statements.get(id)
  console.log(formatQueryResult(id, stmt))
  if (!stmt) process.exit(1)
}
