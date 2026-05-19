import { loadKnowledgeBase } from '../load-kb.js'
import { formatCheckSummary, errorToJson } from '../format.js'

export async function checkCommand(dir = '.', opts: { json?: boolean } = {}): Promise<void> {
  const kb = await loadKnowledgeBase(dir)
  if (opts.json) {
    console.log(JSON.stringify({ files: kb.files.length, errors: kb.errors.map(errorToJson) }, null, 2))
  } else {
    console.log(formatCheckSummary(kb.errors, kb.files.length))
  }
  if (kb.errors.length > 0) process.exit(1)
}
