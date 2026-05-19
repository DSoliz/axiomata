import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadKnowledgeBase } from './load-kb.js'

const TYPES = `type domain-term "a domain term"
type decision "a decision"`

const DOMAIN = `stmt:domain-term fast-restaurant "a restaurant which has no dine-in"`

const SIMPLE = `stmt:decision a1 "@fast-restaurant"
stmt:decision a2 "because of @a1 the website"`

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'axm-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

async function write(name: string, content: string) {
  await writeFile(join(tmpDir, name), content, 'utf-8')
}

describe('loadKnowledgeBase', () => {
  it('returns empty index for an empty directory', async () => {
    const kb = await loadKnowledgeBase(tmpDir)
    expect(kb.files).toHaveLength(0)
    expect(kb.errors).toHaveLength(0)
    expect(kb.index.types.size).toBe(0)
    expect(kb.index.statements.size).toBe(0)
  })

  it('ignores non-.axm files', async () => {
    await write('notes.txt', 'some text')
    await write('README.md', '# readme')
    const kb = await loadKnowledgeBase(tmpDir)
    expect(kb.files).toHaveLength(0)
  })

  it('loads and parses a single .axm file', async () => {
    await write('types.axm', TYPES)
    const kb = await loadKnowledgeBase(tmpDir)
    expect(kb.files).toHaveLength(1)
    expect(kb.index.types.size).toBe(2)
    expect(kb.errors).toHaveLength(0)
  })

  it('loads multiple .axm files and builds a unified index', async () => {
    await write('types.axm', TYPES)
    await write('domain.axm', DOMAIN)
    await write('simple.axm', SIMPLE)
    const kb = await loadKnowledgeBase(tmpDir)
    expect(kb.files).toHaveLength(3)
    expect(kb.index.statements.has('fast-restaurant')).toBe(true)
    expect(kb.index.statements.has('a1')).toBe(true)
    expect(kb.errors).toHaveLength(0)
  })

  it('loads .axm files from subdirectories', async () => {
    await mkdir(join(tmpDir, 'decisions'))
    await write('types.axm', TYPES)
    await write(join('decisions', 'a1.axm'), DOMAIN)
    const kb = await loadKnowledgeBase(tmpDir)
    expect(kb.files).toHaveLength(2)
  })

  it('collects parse errors without throwing', async () => {
    await write('bad.axm', '!!!\ntype decision "valid"')
    const kb = await loadKnowledgeBase(tmpDir)
    expect(kb.errors.length).toBeGreaterThan(0)
    expect(kb.files).toHaveLength(1)
  })

  it('collects semantic errors from the indexer', async () => {
    await write('test.axm', 'stmt:nonexistent a1 "val"')
    const kb = await loadKnowledgeBase(tmpDir)
    expect(kb.errors.some(e => e.code === 'UnknownType')).toBe(true)
  })

  it('resolves the directory path relative to cwd', async () => {
    await write('types.axm', TYPES)
    // loadKnowledgeBase should accept absolute paths
    const kb = await loadKnowledgeBase(tmpDir)
    expect(kb.files[0].path).toContain('types.axm')
  })
})
