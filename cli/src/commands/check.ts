import { loadKnowledgeBase } from '../load-kb.js'
import { formatCheckSummary, errorToJson, toJson } from '../format.js'

export async function checkCommand(dir = '.', opts: { json?: boolean; jsonMin?: boolean } = {}): Promise<void> {
  const kb = await loadKnowledgeBase(dir)
  if (opts.json || opts.jsonMin) {
    console.log(toJson({ files: kb.files.length, errors: kb.errors.map(errorToJson) }, opts.jsonMin))
  } else {
    console.log(formatCheckSummary(kb.errors, kb.files.length))
  }
  if (kb.errors.length > 0) process.exit(1)
}
