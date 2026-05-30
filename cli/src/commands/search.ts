import { resolve } from 'node:path'
import { loadKnowledgeBase } from '../load-kb.js'
import { formatSearchResults, groupStmtsByFile, toJson } from '../format.js'
import { searchStatements } from '../search.js'

export async function searchCommand(query: string, dir = '.', opts: { json?: boolean; jsonMin?: boolean; type?: string } = {}): Promise<void> {
  const root = resolve(dir)
  const kb = await loadKnowledgeBase(dir)
  const results = searchStatements(kb.index, query, opts.type)
  if (opts.json || opts.jsonMin) {
    console.log(toJson({ files: groupStmtsByFile(results, root) }, opts.jsonMin))
  } else {
    console.log(formatSearchResults(results, query))
  }
}
