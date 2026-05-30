import { readFile, writeFile } from 'node:fs/promises'
import { loadKnowledgeBase } from '../load-kb.js'
import { toJson } from '../format.js'
import { tokenizeLine } from '@axiomata/parser'

const ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/

interface FileEdit {
  line: number
  start: number
  end: number
  newText: string
}

async function applyEdits(filePath: string, edits: FileEdit[]): Promise<void> {
  if (edits.length === 0) return
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  // Apply bottom-to-top so earlier offsets stay valid
  edits.sort((a, b) => b.line - a.line || b.start - a.start)
  for (const edit of edits) {
    const line = lines[edit.line]
    if (line === undefined) continue
    lines[edit.line] = line.slice(0, edit.start) + edit.newText + line.slice(edit.end)
  }
  await writeFile(filePath, lines.join('\n'), 'utf-8')
}

export async function renameCommand(
  oldName: string,
  newName: string,
  dir = '.',
  opts: { json?: boolean; jsonMin?: boolean } = {},
): Promise<void> {
  if (oldName === newName) {
    if (opts.json || opts.jsonMin) {
      console.log(toJson({ oldName, newName, files: 0, edits: 0 }, opts.jsonMin))
    } else {
      console.log('nothing to do: old and new names are the same')
    }
    return
  }

  if (!ID_RE.test(newName)) {
    console.error(`error: '${newName}' is not a valid identifier (must start with a letter, then letters/digits/hyphens/underscores)`)
    return process.exit(1)
  }

  const kb = await loadKnowledgeBase(dir)

  const isStmt = kb.index.statements.has(oldName)
  const isType = kb.index.types.has(oldName)

  if (!isStmt && !isType) {
    if (opts.json || opts.jsonMin) {
      console.log(toJson({ error: `'${oldName}' not found as a statement id or type name` }, opts.jsonMin))
    } else {
      console.error(`error: '${oldName}' not found as a statement id or type name`)
    }
    return process.exit(1)
  }

  // Check the new name doesn't already exist
  if ((isStmt && kb.index.statements.has(newName)) || (isType && kb.index.types.has(newName))) {
    console.error(`error: '${newName}' already exists`)
    return process.exit(1)
  }

  const fileCache = new Map<string, string[]>()
  async function getLines(filePath: string): Promise<string[]> {
    if (fileCache.has(filePath)) return fileCache.get(filePath)!
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    fileCache.set(filePath, lines)
    return lines
  }

  const editsByFile = new Map<string, FileEdit[]>()
  function addEdit(filePath: string, line: number, start: number, end: number, newText: string) {
    if (!editsByFile.has(filePath)) editsByFile.set(filePath, [])
    editsByFile.get(filePath)!.push({ line, start, end, newText })
  }

  if (isStmt) {
    const stmt = kb.index.statements.get(oldName)!

    const declLines = await getLines(stmt.file)
    const lineText = declLines[stmt.range.start.line] ?? ''
    const tok = tokenizeLine(lineText, stmt.range.start.line).find(t => t.kind === 'Identifier' && t.value === oldName)
    if (tok) addEdit(stmt.file, tok.range.start.line, tok.range.start.character, tok.range.end.character, newName)

    for (const file of kb.files) {
      for (const decl of file.declarations) {
        if (decl.kind !== 'statement') continue
        for (const seg of decl.value) {
          if (seg.kind === 'reference' && seg.id === oldName) {
            addEdit(file.path, seg.range.start.line, seg.range.start.character, seg.range.end.character, `@${newName}`)
          }
        }
      }
    }
  } else {
    const type = kb.index.types.get(oldName)!

    const declLines = await getLines(type.file)
    const lineText = declLines[type.range.start.line] ?? ''
    const tok = tokenizeLine(lineText, type.range.start.line).find(t => t.kind === 'Identifier' && t.value === oldName)
    if (tok) addEdit(type.file, tok.range.start.line, tok.range.start.character, tok.range.end.character, newName)

    for (const file of kb.files) {
      for (const decl of file.declarations) {
        if (decl.kind !== 'statement' || decl.statementType !== oldName) continue
        const lines = await getLines(file.path)
        const typeTok = tokenizeLine(lines[decl.range.start.line] ?? '', decl.range.start.line)
          .find(t => t.kind === 'Identifier' && t.value === oldName)
        if (!typeTok) continue
        addEdit(file.path, decl.range.start.line, typeTok.range.start.character, typeTok.range.end.character, newName)
      }
    }
  }

  let totalEdits = 0
  for (const [filePath, edits] of editsByFile) {
    await applyEdits(filePath, edits)
    totalEdits += edits.length
  }

  const fileCount = editsByFile.size
  if (opts.json || opts.jsonMin) {
    console.log(toJson({ oldName, newName, kind: isStmt ? 'statement' : 'type', files: fileCount, edits: totalEdits }, opts.jsonMin))
  } else {
    console.log(`renamed: ${oldName} → ${newName}`)
    console.log(`changed: ${totalEdits} occurrence${totalEdits !== 1 ? 's' : ''} across ${fileCount} file${fileCount !== 1 ? 's' : ''}`)
  }
}
