import { randomBytes } from 'node:crypto'
import { readFile, appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { SourceFile } from '@axiomata/core'
import { loadKnowledgeBase } from '../load-kb.js'
import { toJson } from '../format.js'

const ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/

function generateId(existing: Set<string>): string {
  for (let i = 0; i < 20; i++) {
    const id = 's' + randomBytes(2).toString('hex')  // e.g. s3f1a
    if (!existing.has(id)) return id
  }
  throw new Error('could not generate a unique id after 20 attempts')
}

function resolveTargetFile(dir: string, kbFiles: SourceFile[], file?: string): string {
  if (file) return resolve(file)
  const axmFiles = kbFiles.map(f => f.path).sort()
  if (axmFiles.length === 0) {
    throw new Error(`no .axm files found in ${resolve(dir)} — create one first`)
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
  opts: { id?: string; type?: string; file?: string; json?: boolean; jsonMin?: boolean } = {},
): Promise<void> {
  // Validate user-supplied ID
  if (opts.id !== undefined && !ID_RE.test(opts.id)) {
    console.error(`error: '${opts.id}' is not a valid id (must start with a letter, then letters/digits/hyphens/underscores)`)
    process.exit(1)
  }

  const kb = await loadKnowledgeBase(dir)
  const existingIds = new Set<string>([
    ...kb.index.statements.keys(),
    ...(kb.globalIndex?.statements.keys() ?? []),
  ])

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

  if (!opts.type) {
    console.error('error: --type is required')
    process.exit(1)
  }

  const targetFile = resolveTargetFile(dir, kb.files, opts.file)
  const line = `${opts.type} ${id} "${escapeValue(value)}"`

  // Append with a leading newline only if the file doesn't already end with one
  const existing = await readFile(targetFile, 'utf-8')
  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : ''
  await appendFile(targetFile, `${prefix}${line}\n`, 'utf-8')

  if (opts.json || opts.jsonMin) {
    console.log(toJson({ id, type: opts.type, value, file: targetFile }, opts.jsonMin))
  } else {
    console.log(`added: ${line}`)
    console.log(`file:  ${targetFile}`)
  }
}
