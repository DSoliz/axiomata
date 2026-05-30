# LSP

Language server for `.axm` files.

Depends on `parser` and `core`. Implements the Language Server Protocol to provide editor features:

- Diagnostics (parse and index errors in real time)
- Completions (statement IDs after `@`, type names after `stmt:`)
- Go to definition (jump to the declaration of a referenced statement)
- Hover (show the value and type of a referenced statement)
- Auto-insert on `"` (generate a unique ID and `stmt` scaffold)

## Workspace root discovery

The LSP does not auto-discover the KB root. The root is entirely determined by whatever workspace folders the editor sends in the LSP `initialize` handshake.

On `initialized`, the server calls `workspace/workspaceFolders` to retrieve those folders. For each one it:

1. Recursively reads the folder with `fs.readdir(..., { recursive: true })` and indexes every `.axm` file it finds (`scanWorkspace`).
2. Starts a chokidar watcher on `**/*.axm` rooted at that folder, so files created, changed, or deleted outside the editor (e.g. `axm add`, git checkouts, agent writes) flow into the live index without a manual reload (`startFsWatcher`).
3. Attempts to register `workspace/didChangeWatchedFiles` with the client as a supplementary signal — this works on VS Code but Helix only fires it for open buffers, which is why the chokidar watcher is the primary mechanism.

**Implication:** if you open a parent directory that contains the KB as a subdirectory, the server will still find and index the `.axm` files — they are discovered by recursive scan, not by looking for a `types.axm` marker. Conversely, if you open an individual `.axm` file without a workspace folder, no workspace scan runs and cross-file features (references, diagnostics for duplicate IDs/types, completions from other files) will be absent until the editor provides a folder.
