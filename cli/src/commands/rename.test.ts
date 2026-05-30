import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renameCommand } from './rename.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'axm-rename-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

async function write(name: string, content: string) {
  await writeFile(join(tmpDir, name), content, 'utf-8')
}

async function read(name: string): Promise<string> {
  return readFile(join(tmpDir, name), 'utf-8')
}

describe('axm rename — statement ID', () => {
  it('renames a statement id in its declaration and all references', async () => {
    await write('types.axm', 'type decision "a decision"')
    await write('kb.axm', [
      'decision a1 "we serve fast food"',
      'decision a2 "because of @a1 we need a website"',
    ].join('\n'))

    await renameCommand('a1', 'auth-decision', tmpDir)

    const content = await read('kb.axm')
    expect(content).toContain('decision auth-decision "we serve fast food"')
    expect(content).toContain('@auth-decision')
    expect(content).not.toContain(' a1 ')
    expect(content).not.toContain('@a1')
  })

  it('renames a hyphenated statement id across all references', async () => {
    await write('types.axm', 'type domain-term "a domain concept"')
    await write('domain.axm', 'domain-term fast-restaurant "serves fast food"')
    await write('decisions.axm', [
      'domain-term fast-food "food served quickly"',
      'domain-term quick-service "quick service model"',
      'domain-term a1 "because of @fast-restaurant and @fast-food we pivot"',
    ].join('\n'))

    await renameCommand('fast-restaurant', 'quick-eats', tmpDir)

    const domain = await read('domain.axm')
    expect(domain).toBe('domain-term quick-eats "serves fast food"')

    const decisions = await read('decisions.axm')
    expect(decisions).toContain('domain-term fast-food')
    expect(decisions).toContain('@fast-food')
    expect(decisions).toContain('@quick-eats')
    expect(decisions).not.toContain('fast-restaurant')
    expect(decisions).not.toContain('@fast-restaurant')
  })

  it('renames across multiple files', async () => {
    await write('types.axm', 'type decision "a decision"')
    await write('a.axm', 'decision a1 "first decision"')
    await write('b.axm', 'decision b1 "because of @a1 we do this"')

    await renameCommand('a1', 'root-decision', tmpDir)

    expect(await read('a.axm')).toContain('root-decision "first decision"')
    expect(await read('b.axm')).toContain('@root-decision')
  })

  it('is a no-op when old and new name are the same', async () => {
    await write('types.axm', 'type decision "a decision"')
    await write('kb.axm', 'decision a1 "we serve fast food"')

    const before = await read('kb.axm')
    await renameCommand('a1', 'a1', tmpDir)
    expect(await read('kb.axm')).toBe(before)
  })
})

describe('axm rename — type name', () => {
  it('renames a type declaration and all usages', async () => {
    await write('types.axm', 'type decision "a recorded decision"')
    await write('kb.axm', [
      'decision a1 "we use JWT"',
      'decision a2 "because of @a1 the site needs login"',
    ].join('\n'))

    await renameCommand('decision', 'adr', tmpDir)

    const types = await read('types.axm')
    expect(types).toBe('type adr "a recorded decision"')

    const kb = await read('kb.axm')
    expect(kb).toContain('adr a1')
    expect(kb).toContain('adr a2')
    expect(kb).not.toContain('decision a1')
    expect(kb).not.toContain('decision a2')
  })

  it('renames a hyphenated type name in declaration and all usages', async () => {
    await write('types.axm', 'type domain-term "a domain concept"')
    await write('kb.axm', [
      'domain-term fast-restaurant "serves fast food"',
      'domain-term quick-service "quick service model"',
    ].join('\n'))

    await renameCommand('domain-term', 'concept', tmpDir)

    const types = await read('types.axm')
    expect(types).toBe('type concept "a domain concept"')

    const kb = await read('kb.axm')
    expect(kb).toContain('concept fast-restaurant')
    expect(kb).toContain('concept quick-service')
    expect(kb).not.toContain('domain-term')
  })
})

describe('axm rename — error cases', () => {
  it('exits 1 when the symbol is not found', async () => {
    await write('kb.axm', 'type decision "a decision"')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await renameCommand('nonexistent', 'other', tmpDir)

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('not found'))
  })

  it('exits 1 when the new name already exists', async () => {
    await write('kb.axm', [
      'type decision "a decision"',
      'decision a1 "first"',
      'decision a2 "second"',
    ].join('\n'))
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await renameCommand('a1', 'a2', tmpDir)

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('already exists'))
  })

  it('exits 1 when the new name is not a valid identifier', async () => {
    await write('kb.axm', 'type decision "a decision"')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await renameCommand('decision', '123bad', tmpDir)

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('not a valid identifier'))
  })
})
