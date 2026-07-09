import { readdir, readFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import type { AxmError, KnowledgeIndex, SourceFile } from '@axiomata/core'
import { buildIndex, parseFile } from '@axiomata/parser'

export interface KnowledgeBase {
  files: SourceFile[]
  index: KnowledgeIndex
  globalIndex?: KnowledgeIndex
  errors: AxmError[]
}

interface AxmConfig {
  include?: string[]
  exclude?: string[]
  import?: string
}

function globToRegex(pattern: string): RegExp {
  let result = ''
  let i = 0
  while (i < pattern.length) {
    const ch = pattern[i]
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          result += '(?:[^/]+/)*'  // **/ → zero or more path segments
          i += 3
        } else {
          result += '.*'           // ** → anything including slashes
          i += 2
        }
      } else {
        result += '[^/]*'          // * → any non-slash chars
        i += 1
      }
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      result += '\\' + ch
      i += 1
    } else {
      result += ch
      i += 1
    }
  }
  return new RegExp(`^${result}$`)
}

function matchesGlob(entry: string, pattern: string): boolean {
  return globToRegex(pattern).test(entry)
}

async function resolveFiles(root: string, include: string[], exclude: string[] = []): Promise<string[]> {
  const recursive = include.some(p => p.includes('**'))
  const entries = (await readdir(root, { recursive })) as string[]
  return entries
    .filter(e => include.some(p => matchesGlob(e, p)) && !exclude.some(p => matchesGlob(e, p)))
    .map(e => join(root, e))
    .sort()
}

async function loadKnowledgeBaseInternal(dir: string, seen: Set<string>): Promise<KnowledgeBase> {
  const root = resolve(dir)

  let config: AxmConfig | null = null
  const configPath = join(root, 'axmconfig.json')
  try {
    config = JSON.parse(await readFile(configPath, 'utf-8')) as AxmConfig
  } catch {
    // No config — fall back to legacy behaviour
  }

  if (config === null) {
    const entries = await readdir(root, { recursive: true })
    const axmPaths = (entries as string[])
      .filter(e => e.endsWith('.axm'))
      .map(e => join(root, e))
      .sort()

    const files: SourceFile[] = []
    const parseErrors: AxmError[] = []
    for (const filePath of axmPaths) {
      const source = await readFile(filePath, 'utf-8')
      const { file, errors } = parseFile(source, filePath)
      files.push(file)
      parseErrors.push(...errors)
    }

    const { index, errors: indexErrors } = buildIndex(files)
    return { files, index, errors: [...parseErrors, ...indexErrors] }
  }

  let globalIndex: KnowledgeIndex | undefined

  if (config.import) {
    const importedConfigPath = resolve(root, config.import)
    const importedDir = dirname(importedConfigPath)

    if (seen.has(importedConfigPath)) {
      throw new Error(`Circular import detected involving: ${importedConfigPath}`)
    }

    const nextSeen = new Set([...seen, configPath])
    const importedKb = await loadKnowledgeBaseInternal(importedDir, nextSeen)

    // Merge the imported KB's own global with its local index so the plan
    // gets the full transitive closure of what the imported KB can resolve.
    globalIndex = {
      types: new Map([...(importedKb.globalIndex?.types ?? []), ...importedKb.index.types]),
      statements: new Map([...(importedKb.globalIndex?.statements ?? []), ...importedKb.index.statements]),
    }
  }

  const include = config.include ?? ['*.axm']
  const exclude = config.exclude ?? []
  const axmPaths = await resolveFiles(root, include, exclude)

  const files: SourceFile[] = []
  const parseErrors: AxmError[] = []
  for (const filePath of axmPaths) {
    const source = await readFile(filePath, 'utf-8')
    const { file, errors } = parseFile(source, filePath)
    files.push(file)
    parseErrors.push(...errors)
  }

  const { index, errors: indexErrors } = buildIndex(files, globalIndex)
  return { files, index, globalIndex, errors: [...parseErrors, ...indexErrors] }
}

export async function loadKnowledgeBase(dir: string): Promise<KnowledgeBase> {
  return loadKnowledgeBaseInternal(dir, new Set())
}
