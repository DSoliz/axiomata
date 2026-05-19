import type { Range } from './position.js'

export type AxmError =
  | { code: 'DuplicateId';          id: string;      firstFile: string; firstRange: Range; secondFile: string; secondRange: Range }
  | { code: 'DuplicateType';        name: string;    firstFile: string; firstRange: Range; secondFile: string; secondRange: Range }
  | { code: 'UnknownType';          name: string;    file: string; range: Range }
  | { code: 'UnresolvedReference';  id: string;      file: string; range: Range }
  | { code: 'InvalidId';            id: string;      file: string; range: Range }
  | { code: 'ParseError';           message: string; file: string; range: Range }
