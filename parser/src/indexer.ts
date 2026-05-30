import type { AxmError, IndexedStatement, IndexedType, KnowledgeIndex, SourceFile } from '@axiomata/core'

export function buildIndex(files: SourceFile[]): { index: KnowledgeIndex; errors: AxmError[] } {
  const types = new Map<string, IndexedType>()
  const statements = new Map<string, IndexedStatement>()
  const errors: AxmError[] = []

  // Pass 1: collect all declarations
  for (const file of files) {
    for (const decl of file.declarations) {
      if (decl.kind === 'type') {
        if (types.has(decl.name)) {
          const existing = types.get(decl.name)!
          errors.push({
            code: 'DuplicateType',
            name: decl.name,
            firstFile: existing.file,
            firstRange: existing.range,
            secondFile: file.path,
            secondRange: decl.range,
          })
        } else {
          types.set(decl.name, { name: decl.name, description: decl.description, file: file.path, range: decl.range })
        }
      } else {
        if (statements.has(decl.id)) {
          const existing = statements.get(decl.id)!
          errors.push({
            code: 'DuplicateId',
            id: decl.id,
            firstFile: existing.file,
            firstRange: existing.range,
            secondFile: file.path,
            secondRange: decl.range,
          })
        } else {
          statements.set(decl.id, {
            id: decl.id,
            statementType: decl.statementType,
            value: decl.value,
            file: file.path,
            range: decl.range,
          })
        }
      }
    }
  }

  // Pass 2: resolve references and validate types
  for (const file of files) {
    for (const decl of file.declarations) {
      if (decl.kind !== 'statement') continue

      if (!types.has(decl.statementType)) {
        errors.push({ code: 'UnknownType', name: decl.statementType, file: file.path, range: decl.range })
      }

      for (const seg of decl.value) {
        if (seg.kind === 'reference' && !statements.has(seg.id)) {
          errors.push({ code: 'UnresolvedReference', id: seg.id, file: file.path, range: seg.range })
        }
      }
    }
  }

  return { index: { types, statements }, errors }
}
