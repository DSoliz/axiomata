import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  DiagnosticSeverity,
  MarkupKind,
  CompletionItemKind,
  DidChangeWatchedFilesNotification,
  FileChangeType,
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
  DefinitionParams,
  RenameParams,
  WorkspaceEdit,
  TextEdit,
  PrepareRenameParams,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseFile, buildIndex, tokenizeLine } from '@axiomata/parser';
import type { SourceFile, AxmError, Range as AxmRange, ValueSegment, KnowledgeIndex } from '@axiomata/core';
import { readdir, readFile } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';

interface AxmConfig {
  include?: string[]
  exclude?: string[]
  import?: string
}

function globToRegex(pattern: string): RegExp {
  let result = ''
  let i = 0
  while (i < pattern.length) {
    const ch = pattern[i]
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          result += '(?:[^/]+/)*'
          i += 3
        } else {
          result += '.*'
          i += 2
        }
      } else {
        result += '[^/]*'
        i += 1
      }
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      result += '\\' + ch
      i += 1
    } else {
      result += ch
      i += 1
    }
  }
  return new RegExp(`^${result}$`)
}

function matchesGlob(entry: string, pattern: string): boolean {
  return globToRegex(pattern).test(entry)
}

async function resolveFiles(root: string, include: string[], exclude: string[] = []): Promise<string[]> {
  const recursive = include.some(p => p.includes('**'))
  const entries = (await readdir(root, { recursive })) as string[]
  return entries
    .filter(e => include.some(p => matchesGlob(e, p)) && !exclude.some(p => matchesGlob(e, p)))
    .map(e => join(root, e))
    .sort()
}

const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);
export const documents = new TextDocuments(TextDocument);

export const sourceFiles = new Map<string, SourceFile>();
const parseErrorsByUri = new Map<string, AxmError[]>();
export let currentIndex: KnowledgeIndex = { types: new Map(), statements: new Map() };

// Global KB state — populated when axmconfig.json has an "import" field.
export const globalSourceFiles = new Map<string, SourceFile>();
export let currentGlobalIndex: KnowledgeIndex = { types: new Map(), statements: new Map() };
// When non-empty, restricts which URIs are treated as local (config mode).
// When empty, all sourceFiles are local (legacy mode).
export const localUris = new Set<string>();

function lookupStatement(id: string) {
  return currentIndex.statements.get(id) ?? currentGlobalIndex.statements.get(id);
}

function lookupType(name: string) {
  return currentIndex.types.get(name) ?? currentGlobalIndex.types.get(name);
}

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

  return { range: axmToLsp(range), message, severity: DiagnosticSeverity.Error, source: 'axiomata' };
}

function rebuildIndex() {
  // Rebuild global index when in config mode.
  if (globalSourceFiles.size > 0) {
    currentGlobalIndex = buildIndex([...globalSourceFiles.values()]).index;
  }

  const localFiles = localUris.size > 0
    ? [...sourceFiles.values()].filter(f => localUris.has(pathToFileURL(f.path).toString()))
    : [...sourceFiles.values()];
  const gi = globalSourceFiles.size > 0 ? currentGlobalIndex : undefined;

  const { index, errors: indexErrors } = buildIndex(localFiles, gi);
  currentIndex = index;

  // Only report diagnostics for local files.
  const reportableUris = localUris.size > 0 ? localUris : sourceFiles.keys();
  const errorsByUri = new Map<string, AxmError[]>();
  for (const uri of reportableUris) {
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

function removeFromIndex(uri: string) {
  sourceFiles.delete(uri);
  parseErrorsByUri.delete(uri);
  connection.sendDiagnostics({ uri, diagnostics: [] });
}

/**
 * Apply a single workspace/didChangeWatchedFiles event to the index.
 * Returns true if the index changed (caller should rebuildIndex).
 * Files currently open in the editor are skipped — those sync via textDocument/didChange.
 */
export async function handleWatchedFileChange(uri: string, type: FileChangeType): Promise<boolean> {
  if (documents.get(uri)) return false;

  if (type === FileChangeType.Deleted) {
    if (!sourceFiles.has(uri)) return false;
    removeFromIndex(uri);
    localUris.delete(uri);
    return true;
  }

  try {
    const content = await readFile(fileURLToPath(uri), 'utf-8');
    indexDocument(uri, content);
    if (localUris.size > 0) localUris.add(uri);
    return true;
  } catch {
    if (sourceFiles.has(uri)) {
      removeFromIndex(uri);
      localUris.delete(uri);
      return true;
    }
    return false;
  }
}

async function scanGlobalKb(dir: string, seen: Set<string>): Promise<void> {
  let config: AxmConfig | null = null;
  const configPath = join(dir, 'axmconfig.json');
  try {
    config = JSON.parse(await readFile(configPath, 'utf-8')) as AxmConfig;
  } catch {}

  if (config?.import) {
    const importedPath = resolve(dir, config.import);
    if (!seen.has(importedPath)) {
      await scanGlobalKb(dirname(importedPath), new Set([...seen, configPath]));
    }
  }

  const include = config?.include ?? ['*.axm'];
  const exclude = config?.exclude ?? [];
  try {
    const axmPaths = config
      ? await resolveFiles(dir, include, exclude)
      : (await readdir(dir, { recursive: true }) as string[]).filter(e => e.endsWith('.axm')).map(e => join(dir, e));

    await Promise.all(axmPaths.map(async filePath => {
      const uri = pathToFileURL(filePath).toString();
      const content = await readFile(filePath, 'utf-8');
      const { file } = parseFile(content, filePath);
      globalSourceFiles.set(uri, file);
    }));
  } catch {}
}

// Returns the global KB root path if an import was configured, otherwise undefined.
async function scanWorkspace(folderUri: string): Promise<string | undefined> {
  const folderPath = fileURLToPath(folderUri);

  let config: AxmConfig | null = null;
  try {
    config = JSON.parse(await readFile(join(folderPath, 'axmconfig.json'), 'utf-8')) as AxmConfig;
  } catch {}

  if (!config) {
    // Legacy: load all *.axm recursively, no global split.
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
    } catch {}
    return undefined;
  }

  let globalKbRoot: string | undefined;
  if (config.import) {
    const importedConfigPath = resolve(folderPath, config.import);
    globalKbRoot = dirname(importedConfigPath);
    await scanGlobalKb(globalKbRoot, new Set([join(folderPath, 'axmconfig.json')]));
  }

  const include = config.include ?? ['*.axm'];
  const exclude = config.exclude ?? [];
  try {
    const axmPaths = await resolveFiles(folderPath, include, exclude);
    await Promise.all(axmPaths.map(async filePath => {
      const uri = pathToFileURL(filePath).toString();
      localUris.add(uri);
      const content = await readFile(filePath, 'utf-8');
      indexDocument(uri, content);
    }));
  } catch {}

  return globalKbRoot;
}

function startGlobalFsWatcher(globalRoot: string): FSWatcher {
  const watcher = chokidar.watch('**/*.axm', {
    cwd: globalRoot,
    ignored: ['**/node_modules/**', '**/.git/**'],
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  const dispatch = (type: FileChangeType) => async (relPath: string) => {
    const filePath = join(globalRoot, relPath);
    const uri = pathToFileURL(filePath).toString();
    if (documents.get(uri)) return; // editor-owned — skip

    let changed = false;
    if (type === FileChangeType.Deleted) {
      if (globalSourceFiles.has(uri)) { globalSourceFiles.delete(uri); changed = true; }
    } else {
      try {
        const content = await readFile(filePath, 'utf-8');
        const { file } = parseFile(content, filePath);
        globalSourceFiles.set(uri, file);
        changed = true;
      } catch {
        if (globalSourceFiles.has(uri)) { globalSourceFiles.delete(uri); changed = true; }
      }
    }
    if (changed) rebuildIndex();
  };

  watcher.on('add', dispatch(FileChangeType.Created));
  watcher.on('change', dispatch(FileChangeType.Changed));
  watcher.on('unlink', dispatch(FileChangeType.Deleted));
  return watcher;
}

connection.onInitialize((_params: InitializeParams): InitializeResult => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,
    hoverProvider: true,
    definitionProvider: true,
    referencesProvider: true,
    renameProvider: { prepareProvider: true },
    completionProvider: { triggerCharacters: [':', '@'] },
    workspace: { workspaceFolders: { supported: true } },
  },
}));

const fsWatchers: FSWatcher[] = [];

function startFsWatcher(folderPath: string): FSWatcher {
  const watcher = chokidar.watch('**/*.axm', {
    cwd: folderPath,
    ignored: ['**/node_modules/**', '**/.git/**'],
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  const dispatch = (type: FileChangeType) => async (relPath: string) => {
    const uri = pathToFileURL(join(folderPath, relPath)).toString();
    if (await handleWatchedFileChange(uri, type)) rebuildIndex();
  };

  watcher.on('add', dispatch(FileChangeType.Created));
  watcher.on('change', dispatch(FileChangeType.Changed));
  watcher.on('unlink', dispatch(FileChangeType.Deleted));
  return watcher;
}

connection.onInitialized(async () => {
  const folders = await connection.workspace.getWorkspaceFolders();
  if (folders?.length) {
    const globalRoots = await Promise.all(folders.map(f => scanWorkspace(f.uri)));
    rebuildIndex();
    for (const folder of folders) {
      fsWatchers.push(startFsWatcher(fileURLToPath(folder.uri)));
    }
    for (const globalRoot of globalRoots) {
      if (globalRoot) fsWatchers.push(startGlobalFsWatcher(globalRoot));
    }
  }
  // Supplementary signal — works when the client honours it (e.g. VS Code).
  // Helix advertises support but only fires for open buffers, which is why we also
  // run our own chokidar watcher above. Files open in the editor are skipped by
  // handleWatchedFileChange to avoid racing the textDocument/didChange path.
  try {
    await connection.client.register(DidChangeWatchedFilesNotification.type, {
      watchers: [{ globPattern: '**/*.axm' }],
    });
  } catch {
    // Client doesn't support dynamic registration — non-fatal, chokidar covers us.
  }
});

connection.onDidChangeWatchedFiles(async ({ changes }) => {
  const results = await Promise.all(changes.map(c => handleWatchedFileChange(c.uri, c.type)));
  if (results.some(Boolean)) rebuildIndex();
});

connection.onShutdown(async () => {
  await Promise.all(fsWatchers.map(w => w.close()));
  fsWatchers.length = 0;
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
        const stmt = lookupStatement(seg.id);
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

export type ResolvedPosition =
  | { kind: 'statement'; id: string }
  | { kind: 'type'; name: string }

export function resolveIdAtPosition(uri: string, pos: { line: number; character: number }): ResolvedPosition | null {
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

  // Check if cursor is over the type name (first identifier) of a typed statement.
  // Must run before the statement/type loop below so the type token is matched first.
  const doc = documents.get(uri);
  if (doc) {
    const hasStatementDecl = sourceFile.declarations.some(
      decl => decl.kind === 'statement' && decl.range.start.line <= pos.line && pos.line <= decl.range.end.line
    );
    if (hasStatementDecl) {
      const lineText = doc.getText({
        start: { line: pos.line, character: 0 },
        end: { line: pos.line, character: Number.MAX_SAFE_INTEGER },
      });
      const lineTokens = tokenizeLine(lineText, pos.line).filter(t => t.kind !== 'Comment');
      // Typed statement: Identifier Identifier QuotedString — first identifier is the type
      if (lineTokens[0]?.kind === 'Identifier' && lineTokens[1]?.kind === 'Identifier' && lineTokens[2]?.kind === 'QuotedString') {
        const typeTok = lineTokens[0];
        if (typeTok.range.start.character <= pos.character && pos.character <= typeTok.range.end.character) {
          return { kind: 'type', name: typeTok.value };
        }
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

  const allFiles = [...sourceFiles.entries(), ...globalSourceFiles.entries()];

  if (resolved.kind === 'statement') {
    const { id } = resolved;

    if (params.context.includeDeclaration) {
      const stmt = lookupStatement(id);
      if (stmt) {
        locations.push({ uri: pathToFileURL(stmt.file).toString(), range: axmToLsp(stmt.range) });
      }
    }

    for (const [uri, file] of allFiles) {
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
      const type = lookupType(name);
      if (type) {
        locations.push({ uri: pathToFileURL(type.file).toString(), range: axmToLsp(type.range) });
      }
    }

    for (const [uri, file] of allFiles) {
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

  if (/^[\w-]*$/.test(lineUpToCursor)) {
    return [...currentIndex.types.values(), ...currentGlobalIndex.types.values()].map(t => ({
      label: t.name,
      kind: CompletionItemKind.EnumMember,
      detail: t.description,
    }));
  }

  if (/@[\w-]*$/.test(lineUpToCursor)) {
    return [...currentIndex.statements.values(), ...currentGlobalIndex.statements.values()].map(s => ({
      label: s.id,
      kind: CompletionItemKind.Reference,
      detail: s.statementType ?? undefined,
      documentation: renderValue(s.value),
    }));
  }

  return [];
});

export function handleDefinition(params: DefinitionParams): Location | null {
  const resolved = resolveIdAtPosition(params.textDocument.uri, params.position);
  if (!resolved) return null;

  if (resolved.kind === 'statement') {
    const stmt = lookupStatement(resolved.id);
    if (stmt) {
      return { uri: pathToFileURL(stmt.file).toString(), range: axmToLsp(stmt.range) };
    }
  } else if (resolved.kind === 'type') {
    const type = lookupType(resolved.name);
    if (type) {
      return { uri: pathToFileURL(type.file).toString(), range: axmToLsp(type.range) };
    }
  }

  return null;
}

connection.onDefinition(handleDefinition);

async function getLineText(uri: string, line: number): Promise<string> {
  const doc = documents.get(uri);
  if (doc) {
    return doc.getText({ start: { line, character: 0 }, end: { line, character: Number.MAX_SAFE_INTEGER } });
  }
  const content = await readFile(fileURLToPath(uri), 'utf-8');
  return content.split('\n')[line] ?? '';
}

export async function handlePrepareRename(
  params: PrepareRenameParams,
): Promise<{ range: ReturnType<typeof axmToLsp>; placeholder: string } | null> {
  const resolved = resolveIdAtPosition(params.textDocument.uri, params.position);
  if (!resolved) return null;

  const uri = params.textDocument.uri;
  const pos = params.position;
  const sourceFile = sourceFiles.get(uri);

  if (resolved.kind === 'statement') {
    const { id } = resolved;

    // Block rename when the declaration lives only in the imported global KB.
    if (!currentIndex.statements.has(id) && currentGlobalIndex.statements.has(id)) return null;

    // Reference segment (@id) — the AST already has its exact range; skip the leading '@'
    if (sourceFile) {
      for (const decl of sourceFile.declarations) {
        if (decl.kind !== 'statement') continue;
        for (const seg of decl.value) {
          if (seg.kind !== 'reference' || seg.id !== id) continue;
          const r = seg.range;
          if (r.start.line === pos.line && r.start.character <= pos.character && pos.character <= r.end.character) {
            return {
              range: axmToLsp({ start: { line: r.start.line, character: r.start.character + 1 }, end: r.end }),
              placeholder: id,
            };
          }
        }
      }
    }

    // Declaration ID — tokenize the line to find the exact token bounds
    const stmt = currentIndex.statements.get(id);
    if (stmt) {
      const stmtUri = pathToFileURL(stmt.file).toString();
      const lineText = await getLineText(stmtUri, stmt.range.start.line);
      const tok = tokenizeLine(lineText, stmt.range.start.line).find(t => t.kind === 'Identifier' && t.value === id);
      if (tok) return { range: axmToLsp(tok.range), placeholder: id };
    }
  } else {
    const { name } = resolved;

    // Block rename when the type lives only in the imported global KB.
    if (!currentIndex.types.has(name) && currentGlobalIndex.types.has(name)) return null;

    // type-name usage — find the type identifier (first token) on a typed statement line
    if (sourceFile) {
      for (const decl of sourceFile.declarations) {
        if (decl.kind !== 'statement' || decl.statementType !== name) continue;
        const r = decl.range;
        if (r.start.line <= pos.line && pos.line <= r.end.line) {
          const lineText = await getLineText(uri, decl.range.start.line);
          const typeTok = tokenizeLine(lineText, decl.range.start.line)
            .find(t => t.kind === 'Identifier' && t.value === name);
          if (typeTok) {
            return { range: axmToLsp(typeTok.range), placeholder: name };
          }
        }
      }
    }

    // Type declaration name — tokenize to find the name identifier token
    const type = currentIndex.types.get(name);
    if (type) {
      const typeUri = pathToFileURL(type.file).toString();
      const lineText = await getLineText(typeUri, type.range.start.line);
      const tok = tokenizeLine(lineText, type.range.start.line).find(t => t.kind === 'Identifier' && t.value === name);
      if (tok) return { range: axmToLsp(tok.range), placeholder: name };
    }
  }

  return null;
}

connection.onPrepareRename(handlePrepareRename);

export async function handleRename(params: RenameParams): Promise<WorkspaceEdit | null> {
  const resolved = resolveIdAtPosition(params.textDocument.uri, params.position);
  if (!resolved) return null;

  const { newName } = params;
  const editsByUri = new Map<string, TextEdit[]>();

  function addEdit(uri: string, range: AxmRange, newText: string) {
    if (!editsByUri.has(uri)) editsByUri.set(uri, []);
    editsByUri.get(uri)!.push({ range: axmToLsp(range), newText });
  }

  if (resolved.kind === 'statement') {
    const { id } = resolved;

    const stmt = currentIndex.statements.get(id);
    if (stmt) {
      const uri = pathToFileURL(stmt.file).toString();
      const lineText = await getLineText(uri, stmt.range.start.line);
      const tok = tokenizeLine(lineText, stmt.range.start.line).find(t => t.kind === 'Identifier' && t.value === id);
      if (tok) addEdit(uri, tok.range, newName);
    }

    for (const [uri, file] of sourceFiles) {
      for (const decl of file.declarations) {
        if (decl.kind !== 'statement') continue;
        for (const seg of decl.value) {
          if (seg.kind === 'reference' && seg.id === id) {
            addEdit(uri, seg.range, `@${newName}`);
          }
        }
      }
    }
  } else {
    const { name } = resolved;

    const type = currentIndex.types.get(name);
    if (type) {
      const uri = pathToFileURL(type.file).toString();
      const lineText = await getLineText(uri, type.range.start.line);
      const tok = tokenizeLine(lineText, type.range.start.line).find(t => t.kind === 'Identifier' && t.value === name);
      if (tok) addEdit(uri, tok.range, newName);
    }

    for (const [uri, file] of sourceFiles) {
      for (const decl of file.declarations) {
        if (decl.kind !== 'statement' || decl.statementType !== name) continue;
        const lineText = await getLineText(uri, decl.range.start.line);
        const typeTok = tokenizeLine(lineText, decl.range.start.line).find(t => t.kind === 'Identifier' && t.value === name);
        if (!typeTok) continue;
        addEdit(uri, typeTok.range, newName);
      }
    }
  }

  return { changes: Object.fromEntries(editsByUri) };
}

connection.onRenameRequest(handleRename);

if (!process.env.VITEST) {
  documents.listen(connection);
  connection.listen();
}
