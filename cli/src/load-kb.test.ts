import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadKnowledgeBase } from './load-kb.js'

async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2), 'utf-8')
}

const TYPES = `type domain-term "a domain term"
type decision "a decision"`

const DOMAIN = `domain-term fast-restaurant "a restaurant which has no dine-in"`

const SIMPLE = `decision a1 "@fast-restaurant"
decision a2 "because of @a1 the website"`

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
    await write('test.axm', 'nonexistent a1 "val"')
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

describe('loadKnowledgeBase with axmconfig.json', () => {
  it('uses include patterns to select files', async () => {
    await write('types.axm', TYPES)
    await write('domain.axm', DOMAIN)
    await writeJson(join(tmpDir, 'axmconfig.json'), { include: ['domain.axm'] })
    const kb = await loadKnowledgeBase(tmpDir)
    expect(kb.files).toHaveLength(1)
    expect(kb.index.statements.has('fast-restaurant')).toBe(true)
    expect(kb.index.types.size).toBe(0)
  })

  it('defaults include to *.axm (non-recursive) when omitted', async () => {
    await mkdir(join(tmpDir, 'sub'))
    await write('types.axm', TYPES)
    await write(join('sub', 'domain.axm'), DOMAIN)
    await writeJson(join(tmpDir, 'axmconfig.json'), {})
    const kb = await loadKnowledgeBase(tmpDir)
    expect(kb.files).toHaveLength(1)
    expect(kb.files[0].path).toContain('types.axm')
  })

  it('resolves references to global statements via import', async () => {
    // Global KB
    await write('types.axm', TYPES)
    await write('domain.axm', DOMAIN)
    await writeJson(join(tmpDir, 'axmconfig.json'), { include: ['*.axm'] })

    // Plan KB in subdirectory
    const planDir = join(tmpDir, 'plan')
    await mkdir(planDir)
    await writeFile(join(planDir, 'plan.axm'), 'decision a1 "@fast-restaurant"', 'utf-8')
    await writeJson(join(planDir, 'axmconfig.json'), {
      include: ['*.axm'],
      import: '../axmconfig.json',
    })

    const kb = await loadKnowledgeBase(planDir)
    expect(kb.errors).toHaveLength(0)
    expect(kb.globalIndex?.statements.has('fast-restaurant')).toBe(true)
    expect(kb.index.statements.has('fast-restaurant')).toBe(false)
  })

  it('reports DuplicateId when a plan id collides with a global id', async () => {
    await write('types.axm', TYPES)
    await write('domain.axm', DOMAIN)
    await writeJson(join(tmpDir, 'axmconfig.json'), { include: ['*.axm'] })

    const planDir = join(tmpDir, 'plan')
    await mkdir(planDir)
    await writeFile(join(planDir, 'plan.axm'), 'decision fast-restaurant "collision"', 'utf-8')
    await writeJson(join(planDir, 'axmconfig.json'), {
      include: ['*.axm'],
      import: '../axmconfig.json',
    })

    const kb = await loadKnowledgeBase(planDir)
    expect(kb.errors.some(e => e.code === 'DuplicateId')).toBe(true)
  })

  it('throws on circular imports', async () => {
    await writeJson(join(tmpDir, 'axmconfig.json'), {
      include: ['*.axm'],
      import: './axmconfig.json',
    })
    await expect(loadKnowledgeBase(tmpDir)).rejects.toThrow('Circular import')
  })

  it('resolves transitive imports', async () => {
    // Grandparent KB
    const grandparentDir = join(tmpDir, 'gp')
    await mkdir(grandparentDir)
    await writeFile(join(grandparentDir, 'types.axm'), TYPES, 'utf-8')
    await writeJson(join(grandparentDir, 'axmconfig.json'), { include: ['*.axm'] })

    // Parent KB imports grandparent
    const parentDir = join(tmpDir, 'parent')
    await mkdir(parentDir)
    await writeFile(join(parentDir, 'domain.axm'), DOMAIN, 'utf-8')
    await writeJson(join(parentDir, 'axmconfig.json'), {
      include: ['*.axm'],
      import: '../gp/axmconfig.json',
    })

    // Plan imports parent (which itself imports grandparent)
    const planDir = join(tmpDir, 'plan')
    await mkdir(planDir)
    await writeFile(join(planDir, 'plan.axm'), 'decision a1 "@fast-restaurant"', 'utf-8')
    await writeJson(join(planDir, 'axmconfig.json'), {
      include: ['*.axm'],
      import: '../parent/axmconfig.json',
    })

    const kb = await loadKnowledgeBase(planDir)
    expect(kb.errors).toHaveLength(0)
    expect(kb.globalIndex?.statements.has('fast-restaurant')).toBe(true)
    expect(kb.globalIndex?.types.has('decision')).toBe(true)
  })
})
