import { loadKnowledgeBase } from '../load-kb.js'
import { formatSearchResults, stmtToJson } from '../format.js'
import { searchStatements } from '../search.js'

export async function searchCommand(query: string, dir = '.', opts: { json?: boolean; type?: string } = {}): Promise<void> {
  const kb = await loadKnowledgeBase(dir)
  const results = searchStatements(kb.index, query, opts.type)
  if (opts.json) {
    console.log(JSON.stringify(results.map(stmtToJson), null, 2))
  } else {
    console.log(formatSearchResults(results, query))
  }
}
