import { loadKnowledgeBase } from '../load-kb.js'
import { formatCheckSummary } from '../format.js'

export async function checkCommand(dir: string = '.'): Promise<void> {
  const kb = await loadKnowledgeBase(dir)
  console.log(formatCheckSummary(kb.errors, kb.files.length))
  if (kb.errors.length > 0) process.exit(1)
}
