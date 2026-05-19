import type { Range } from './position.js'

export interface TextSegment {
  kind: 'text'
  value: string
}

export interface ReferenceSegment {
  kind: 'reference'
  id: string
  range: Range
}

export type ValueSegment = TextSegment | ReferenceSegment

export interface TypeDeclarationNode {
  kind: 'type'
  name: string
  description: string
  range: Range
}

export interface StatementNode {
  kind: 'statement'
  /** null when declared as bare `stmt` with no type */
  statementType: string | null
  id: string
  value: ValueSegment[]
  range: Range
}

export type Declaration = TypeDeclarationNode | StatementNode

export interface SourceFile {
  path: string
  declarations: Declaration[]
}
