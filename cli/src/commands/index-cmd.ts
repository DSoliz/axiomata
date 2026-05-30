import { resolve } from 'node:path'
import { loadKnowledgeBase } from '../load-kb.js'
import { formatIndex, formatTypes, groupStmtsByFile, toJson } from '../format.js'

export async function indexCommand(dir = '.', opts: { json?: boolean; jsonMin?: boolean; type?: string; types?: boolean; omitTypes?: boolean } = {}): Promise<void> {
  const root = resolve(dir)
  const kb = await loadKnowledgeBase(dir)
  const min = opts.jsonMin
  if (opts.types) {
    const types = [...kb.index.types.values()].map(t => ({ name: t.name, description: t.description }))
    if (opts.json || min) {
      console.log(toJson(types, min))
    } else {
      console.log(formatTypes(kb.index))
    }
    return
  }
  if (opts.json || min) {
    let stmts = [...kb.index.statements.values()]
    if (opts.type !== undefined) stmts = stmts.filter(s => s.statementType === opts.type)
    const files = groupStmtsByFile(stmts, root)
    const omitTypes = opts.omitTypes || opts.type !== undefined
    const out = omitTypes ? { files } : { types: [...kb.index.types.values()].map(t => ({ name: t.name, description: t.description })), files }
    console.log(toJson(out, min))
  } else {
    console.log(formatIndex(kb.index, opts.type))
  }
}
