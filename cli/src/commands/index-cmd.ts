import { loadKnowledgeBase } from '../load-kb.js'
import { formatIndex } from '../format.js'

export async function indexCommand(dir: string = '.'): Promise<void> {
  const kb = await loadKnowledgeBase(dir)
  console.log(formatIndex(kb.index))
}
