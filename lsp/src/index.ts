import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  DiagnosticSeverity,
  MarkupKind,
  CompletionItemKind,
} from 'vscode-languageserver/node.js';
import type {
  InitializeParams,
  InitializeResult,
  Diagnostic,
  HoverParams,
  Hover,
  CompletionParams,
  CompletionItem,
  ReferenceParams,
  Location,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseFile, buildIndex } from '@axiomate/parser';
import type { SourceFile, AxmError, Range as AxmRange, ValueSegment, KnowledgeIndex } from '@axiomate/core';
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);
const documents = new TextDocuments(TextDocument);

const sourceFiles = new Map<string, SourceFile>();
const parseErrorsByUri = new Map<string, AxmError[]>();
let currentIndex: KnowledgeIndex = { types: new Map(), statements: new Map() };

function axmToLsp(range: AxmRange) {
  return {
    start: { line: range.start.line, character: range.start.character },
    end: { line: range.end.line, character: range.end.character },
  };
}

function renderValue(segments: ValueSegment[]): string {
  return segments.map(s => s.kind === 'text' ? s.value : `@${s.id}`).join('');
}

function toDiagnostic(error: AxmError, forUri: string): Diagnostic {
  let range!: AxmRange;
  let message!: string;

  switch (error.code) {
    case 'DuplicateId': {
      const isFirst = pathToFileURL(error.firstFile).toString() === forUri;
      range = isFirst ? error.firstRange : error.secondRange;
      message = `Duplicate id '${error.id}'`;
      break;
    }
    case 'DuplicateType': {
      const isFirst = pathToFileURL(error.firstFile).toString() === forUri;
      range = isFirst ? error.firstRange : error.secondRange;
      message = `Duplicate type '${error.name}'`;
      break;
    }
    case 'UnknownType':
      range = error.range;
      message = `Unknown type '${error.name}'`;
      break;
    case 'UnresolvedReference':
      range = error.range;
      message = `Unresolved reference '@${error.id}'`;
      break;
    case 'InvalidId':
      range = error.range;
      message = `Invalid id '${error.id}'`;
      break;
    case 'ParseError':
      range = error.range;
      message = error.message;
      break;
  }

  return { range: axmToLsp(range), message, severity: DiagnosticSeverity.Error, source: 'axiomate' };
}

function rebuildIndex() {
  const { index, errors: indexErrors } = buildIndex([...sourceFiles.values()]);
  currentIndex = index;

  const errorsByUri = new Map<string, AxmError[]>();
  for (const uri of sourceFiles.keys()) {
    errorsByUri.set(uri, [...(parseErrorsByUri.get(uri) ?? [])]);
  }

  for (const error of indexErrors) {
    if (error.code === 'DuplicateId' || error.code === 'DuplicateType') {
      for (const key of ['firstFile', 'secondFile'] as const) {
        const uri = pathToFileURL(error[key]).toString();
        if (!errorsByUri.has(uri)) errorsByUri.set(uri, []);
        errorsByUri.get(uri)!.push(error);
      }
    } else {
      const uri = pathToFileURL(error.file).toString();
      if (!errorsByUri.has(uri)) errorsByUri.set(uri, []);
      errorsByUri.get(uri)!.push(error);
    }
  }

  for (const [uri, fileErrors] of errorsByUri) {
    connection.sendDiagnostics({
      uri,
      diagnostics: fileErrors.map(e => toDiagnostic(e, uri)),
    });
  }
}

function indexDocument(uri: string, content: string) {
  const path = fileURLToPath(uri);
  const { file, errors } = parseFile(content, path);
  sourceFiles.set(uri, file);
  parseErrorsByUri.set(uri, errors);
}

async function scanWorkspace(folderUri: string) {
  const folderPath = fileURLToPath(folderUri);
  try {
    const entries = (await readdir(folderPath, { encoding: 'utf8', recursive: true })) as string[];
    await Promise.all(
      entries
        .filter(e => extname(e) === '.axm')
        .map(async rel => {
          const filePath = join(folderPath, rel);
          const content = await readFile(filePath, 'utf-8');
          indexDocument(pathToFileURL(filePath).toString(), content);
        })
    );
  } catch {
    // non-fatal — editor may not have a workspace folder
  }
}

connection.onInitialize((_params: InitializeParams): InitializeResult => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,
    hoverProvider: true,
    referencesProvider: true,
    completionProvider: { triggerCharacters: [':', '@'] },
    workspace: { workspaceFolders: { supported: true } },
  },
}));

connection.onInitialized(async () => {
  const folders = await connection.workspace.getWorkspaceFolders();
  if (folders?.length) {
    await Promise.all(folders.map(f => scanWorkspace(f.uri)));
    rebuildIndex();
  }
});

documents.onDidChangeContent(change => {
  indexDocument(change.document.uri, change.document.getText());
  rebuildIndex();
});

connection.onHover((params: HoverParams): Hover | null => {
  const sourceFile = sourceFiles.get(params.textDocument.uri);
  if (!sourceFile) return null;

  const pos = params.position;

  for (const decl of sourceFile.declarations) {
    if (decl.kind !== 'statement') continue;
    for (const seg of decl.value) {
      if (seg.kind !== 'reference') continue;
      const r = seg.range;
      if (r.start.line === pos.line && r.start.character <= pos.character && pos.character <= r.end.character) {
        const stmt = currentIndex.statements.get(seg.id);
        if (!stmt) return null;
        const typeLabel = stmt.statementType ? `*${stmt.statementType}*  ` : '';
        return {
          contents: { kind: MarkupKind.Markdown, value: `${typeLabel}\`${seg.id}\` — ${renderValue(stmt.value)}` },
          range: axmToLsp(r),
        };
      }
    }
  }

  return null;
});

type ResolvedPosition =
  | { kind: 'statement'; id: string }
  | { kind: 'type'; name: string }

function resolveIdAtPosition(uri: string, pos: { line: number; character: number }): ResolvedPosition | null {
  const sourceFile = sourceFiles.get(uri);
  if (!sourceFile) return null;

  for (const decl of sourceFile.declarations) {
    if (decl.kind !== 'statement') continue;
    for (const seg of decl.value) {
      if (seg.kind !== 'reference') continue;
      const r = seg.range;
      if (r.start.line === pos.line && r.start.character <= pos.character && pos.character <= r.end.character) {
        return { kind: 'statement', id: seg.id };
      }
    }
  }

  for (const decl of sourceFile.declarations) {
    if (decl.kind === 'statement') {
      const r = decl.range;
      if (r.start.line <= pos.line && pos.line <= r.end.line) {
        return { kind: 'statement', id: decl.id };
      }
    } else if (decl.kind === 'type') {
      const r = decl.range;
      if (r.start.line <= pos.line && pos.line <= r.end.line) {
        return { kind: 'type', name: decl.name };
      }
    }
  }

  return null;
}

connection.onReferences((params: ReferenceParams): Location[] => {
  const resolved = resolveIdAtPosition(params.textDocument.uri, params.position);
  if (!resolved) return [];

  const locations: Location[] = [];

  if (resolved.kind === 'statement') {
    const { id } = resolved;

    if (params.context.includeDeclaration) {
      const stmt = currentIndex.statements.get(id);
      if (stmt) {
        locations.push({ uri: pathToFileURL(stmt.file).toString(), range: axmToLsp(stmt.range) });
      }
    }

    for (const [uri, file] of sourceFiles) {
      for (const decl of file.declarations) {
        if (decl.kind !== 'statement') continue;
        for (const seg of decl.value) {
          if (seg.kind === 'reference' && seg.id === id) {
            locations.push({ uri, range: axmToLsp(seg.range) });
          }
        }
      }
    }
  } else {
    const { name } = resolved;

    if (params.context.includeDeclaration) {
      const type = currentIndex.types.get(name);
      if (type) {
        locations.push({ uri: pathToFileURL(type.file).toString(), range: axmToLsp(type.range) });
      }
    }

    for (const [uri, file] of sourceFiles) {
      for (const decl of file.declarations) {
        if (decl.kind === 'statement' && decl.statementType === name) {
          locations.push({ uri, range: axmToLsp(decl.range) });
        }
      }
    }
  }

  return locations;
});

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const lineUpToCursor = doc.getText({
    start: { line: params.position.line, character: 0 },
    end: params.position,
  });

  if (/\bstmt:[\w-]*$/.test(lineUpToCursor)) {
    return [...currentIndex.types.values()].map(t => ({
      label: t.name,
      kind: CompletionItemKind.EnumMember,
      detail: t.description,
    }));
  }

  if (/@[\w-]*$/.test(lineUpToCursor)) {
    return [...currentIndex.statements.values()].map(s => ({
      label: s.id,
      kind: CompletionItemKind.Reference,
      detail: s.statementType ?? undefined,
      documentation: renderValue(s.value),
    }));
  }

  return [];
});

documents.listen(connection);
connection.listen();
