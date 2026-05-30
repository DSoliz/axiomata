import type { Range } from './position.js'
import type { ValueSegment } from './ast.js'

export interface IndexedType {
  name: string
  description: string
  file: string
  range: Range
}

export interface IndexedStatement {
  id: string
  statementType: string
  value: ValueSegment[]
  file: string
  range: Range
}

export interface KnowledgeIndex {
  types: Map<string, IndexedType>
  statements: Map<string, IndexedStatement>
}
