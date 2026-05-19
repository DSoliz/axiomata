import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { AxmError, KnowledgeIndex, SourceFile } from '@axiomate/core'
import { buildIndex, parseFile } from '@axiomate/parser'

export interface KnowledgeBase {
  files: SourceFile[]
  index: KnowledgeIndex
  errors: AxmError[]
}

export async function loadKnowledgeBase(dir: string): Promise<KnowledgeBase> {
  const root = resolve(dir)
  const entries = await readdir(root, { recursive: true })

  const axmPaths = (entries as string[])
    .filter((e: string) => e.endsWith('.axm'))
    .map((e: string) => join(root, e))
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
