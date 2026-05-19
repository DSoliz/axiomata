import type { AxmError, SourceFile } from '@axiomata/core'
import { tokenizeLine } from './tokenizer.js'
import { parseLine } from './line-parser.js'

export function parseFile(source: string, path: string): { file: SourceFile; errors: AxmError[] } {
  const lines = source.split('\n')
  const declarations: SourceFile['declarations'] = []
  const errors: AxmError[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '')
    const tokens = tokenizeLine(line, i)

    for (const tok of tokens) {
      if (tok.kind === 'Unknown') {
        errors.push({ code: 'ParseError', message: `unexpected input '${tok.value}'`, file: path, range: tok.range })
      }
    }

    const { declaration, errors: lineErrors } = parseLine(tokens, path)
    errors.push(...lineErrors)
    if (declaration) declarations.push(declaration)
  }

  return { file: { path, declarations }, errors }
}
