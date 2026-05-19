import type { AxmError, Range, ValueSegment } from '@axiomata/core'

export function parseValue(
  raw: string,
  quoteRange: Range,
  _file: string,
): { segments: ValueSegment[]; errors: AxmError[] } {
  const segments: ValueSegment[] = []
  const errors: AxmError[] = []
  const line = quoteRange.start.line
  const offset = quoteRange.start.character + 1 // +1 for the opening "

  let i = 0
  let text = ''

  while (i < raw.length) {
    if (raw[i] === '\\' && raw[i + 1] === '"') {
      text += '"'
      i += 2
      continue
    }

    if (raw[i] === '@') {
      const atPos = i
      i++ // skip @

      const idStart = i
      while (i < raw.length && /[a-zA-Z0-9-]/.test(raw[i])) i++
      const id = raw.slice(idStart, i)

      if (id.length === 0 || !/^[a-zA-Z]/.test(id)) {
        // not a valid reference start — treat @ as plain text and rewind
        text += '@'
        i = atPos + 1
        continue
      }

      if (text.length > 0) {
        segments.push({ kind: 'text', value: text })
        text = ''
      }

      segments.push({
        kind: 'reference',
        id,
        range: {
          start: { line, character: offset + atPos },
          end: { line, character: offset + i },
        },
      })
      continue
    }

    text += raw[i++]
  }

  if (text.length > 0) {
    segments.push({ kind: 'text', value: text })
  }

  return { segments, errors }
}
