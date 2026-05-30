import { resolve } from 'node:path'
import type { IndexedStatement } from '@axiomata/core'
import { loadKnowledgeBase } from '../load-kb.js'
import { groupStmtsByFile, formatRefs, toJson } from '../format.js'

export async function refsCommand(id: string, dir = '.', opts: { json?: boolean; jsonMin?: boolean } = {}): Promise<void> {
  const root = resolve(dir)
  const kb = await loadKnowledgeBase(dir)

  const isStmt = kb.index.statements.has(id)
  const isType = kb.index.types.has(id)

  if (!isStmt && !isType) {
    if (opts.json || opts.jsonMin) {
      console.log(toJson(null, opts.jsonMin))
    } else {
      console.error(`error: '${id}' not found as a statement id or type name`)
    }
    process.exit(1)
  }

  let refs: IndexedStatement[]
  let mode: 'statement' | 'type'

  if (isStmt) {
    refs = [...kb.index.statements.values()].filter(stmt =>
      stmt.value.some(seg => seg.kind === 'reference' && seg.id === id)
    )
    mode = 'statement'
  } else {
    refs = [...kb.index.statements.values()].filter(stmt => stmt.statementType === id)
    mode = 'type'
  }

  if (opts.json || opts.jsonMin) {
    console.log(toJson({ files: groupStmtsByFile(refs, root) }, opts.jsonMin))
  } else {
    console.log(formatRefs(id, refs, mode))
  }
}
