# axiomata-vscode

VS Code extension for the [Axiomata](https://github.com/axiomata/axiomata) `.axm` format. Bundles the language server — no separate `axiomata-lsp` install needed.

## Install

### From a local build

1. Build and package the extension:

   ```sh
   cd vscode-extension
   pnpm build
   pnpm package
   ```

2. Install the `.vsix`:

   ```sh
   code --install-extension axiomata-vscode-0.1.0.vsix
   ```

   If `code` isn't on your PATH, run **Shell Command: Install 'code' command in PATH** from the Command Palette first. Alternatively, open the Command Palette (`Cmd+Shift+P`) and run **Extensions: Install from VSIX...** to pick the file manually.

On first open of any `.axm` file the extension activates automatically and starts the bundled language server.

## Features

- Syntax highlighting
- Diagnostics (unknown types, unresolved references, duplicate ids)
- Hover on `@id` references
- Completions at the start of a line (type names) and after `@` (statement ids)
- Go-to-definition, find references, rename symbol
- Cross-file changes from outside the editor (`axm add`, `axm rename`, git checkouts, agent writes) flow into open buffers automatically — no manual reload needed
