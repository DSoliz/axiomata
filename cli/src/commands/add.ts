import { randomBytes } from 'node:crypto'
import { readdir, readFile, appendFile } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { loadKnowledgeBase } from '../load-kb.js'

const ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/

function generateId(existing: Set<string>): string {
  for (let i = 0; i < 20; i++) {
    const id = 's' + randomBytes(2).toString('hex')  // e.g. s3f1a
    if (!existing.has(id)) return id
  }
  throw new Error('could not generate a unique id after 20 attempts')
}

async function resolveTargetFile(dir: string, file?: string): Promise<string> {
  if (file) return resolve(file)
  const root = resolve(dir)
  const entries = (await readdir(root, { recursive: true, encoding: 'utf8' })) as string[]
  const axmFiles = entries.filter(e => extname(e) === '.axm').map(e => join(root, e)).sort()
  if (axmFiles.length === 0) {
    throw new Error(`no .axm files found in ${root} — create one first`)
  }
  if (axmFiles.length > 1) {
    const list = axmFiles.map(f => `  ${f}`).join('\n')
    throw new Error(`multiple .axm files found — use --file to specify one:\n${list}`)
  }
  return axmFiles[0]
}

function escapeValue(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function addCommand(
  value: string,
  dir = '.',
  opts: { id?: string; type?: string; file?: string; json?: boolean } = {},
): Promise<void> {
  // Validate user-supplied ID
  if (opts.id !== undefined && !ID_RE.test(opts.id)) {
    console.error(`error: '${opts.id}' is not a valid id (must start with a letter, then letters/digits/hyphens/underscores)`)
    process.exit(1)
  }

  const kb = await loadKnowledgeBase(dir)
  const existingIds = new Set<string>(kb.index.statements.keys())

  let id: string
  if (opts.id !== undefined) {
    if (existingIds.has(opts.id)) {
      console.error(`error: id '${opts.id}' already exists`)
      process.exit(1)
    }
    id = opts.id
  } else {
    id = generateId(existingIds)
  }

  const targetFile = await resolveTargetFile(dir, opts.file)
  const typePart = opts.type ? `:${opts.type}` : ''
  const line = `stmt${typePart} ${id} "${escapeValue(value)}"`

  // Append with a leading newline only if the file doesn't already end with one
  const existing = await readFile(targetFile, 'utf-8')
  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : ''
  await appendFile(targetFile, `${prefix}${line}\n`, 'utf-8')

  if (opts.json) {
    console.log(JSON.stringify({ id, type: opts.type ?? null, value, file: targetFile }, null, 2))
  } else {
    console.log(`added: ${line}`)
    console.log(`file:  ${targetFile}`)
  }
}
