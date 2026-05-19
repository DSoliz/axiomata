import { readdir, writeFile } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'

const TEMPLATE = `\
// Knowledge base — created by axm init
// Add statements below using: axm add "<value>" --type <type>

type decision    "a recorded architectural or product decision"
type unknown     "an open question or unresolved matter"
type constraint  "a non-negotiable limit that shapes decisions"
type assumption  "something treated as true but not yet verified"
type principle   "a guiding rule that keeps future decisions consistent"
type domain-term "a named concept in the shared vocabulary"
`

export async function initCommand(dir = '.', opts: { json?: boolean } = {}): Promise<void> {
  const root = resolve(dir)
  const entries = (await readdir(root, { recursive: true, encoding: 'utf8' })) as string[]
  const existing = entries.filter(e => extname(e) === '.axm')

  if (existing.length > 0) {
    const list = existing.map(f => `  ${join(root, f)}`).join('\n')
    if (opts.json) {
      console.log(JSON.stringify({ error: 'already initialised', files: existing.map(f => join(root, f)) }, null, 2))
    } else {
      console.error(`error: .axm files already exist in ${root}\n${list}`)
    }
    process.exit(1)
  }

  const filePath = join(root, 'types.axm')
  await writeFile(filePath, TEMPLATE, 'utf-8')

  if (opts.json) {
    console.log(JSON.stringify({ file: filePath, types: ['decision', 'unknown', 'constraint', 'assumption', 'principle', 'domain-term'] }, null, 2))
  } else {
    console.log(`created: ${filePath}`)
    console.log('types:   decision, unknown, constraint, assumption, principle, domain-term')
  }
}
