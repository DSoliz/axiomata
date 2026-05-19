import type { IndexedStatement } from '@axiomate/core'
import { loadKnowledgeBase } from '../load-kb.js'
import { stmtToJson, formatRefs } from '../format.js'

export async function refsCommand(id: string, dir = '.', opts: { json?: boolean } = {}): Promise<void> {
  const kb = await loadKnowledgeBase(dir)

  const isStmt = kb.index.statements.has(id)
  const isType = kb.index.types.has(id)

  if (!isStmt && !isType) {
    if (opts.json) {
      console.log(JSON.stringify(null, null, 2))
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

  if (opts.json) {
    console.log(JSON.stringify(refs.map(stmtToJson), null, 2))
  } else {
    console.log(formatRefs(id, refs, mode))
  }
}
