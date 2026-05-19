export interface Position {
  /** 0-indexed */
  line: number
  /** 0-indexed */
  character: number
}

export interface Range {
  start: Position
  end: Position
}
