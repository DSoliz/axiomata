import esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const base = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  logLevel: 'info',
};

if (watch) {
  const [clientCtx, serverCtx] = await Promise.all([
    esbuild.context({
      ...base,
      entryPoints: [resolve(__dirname, 'src/extension.ts')],
      outfile: resolve(__dirname, 'out/extension.js'),
      format: 'cjs',
      external: ['vscode'],
    }),
    esbuild.context({
      ...base,
      entryPoints: [resolve(__dirname, '../lsp/src/index.ts')],
      outfile: resolve(__dirname, 'out/server.js'),
      format: 'cjs',
      // fsevents is an optional native dep; chokidar falls back gracefully without it
      external: ['fsevents'],
    }),
  ]);
  await Promise.all([clientCtx.watch(), serverCtx.watch()]);
} else {
  await Promise.all([
    esbuild.build({
      ...base,
      entryPoints: [resolve(__dirname, 'src/extension.ts')],
      outfile: resolve(__dirname, 'out/extension.js'),
      format: 'cjs',
      external: ['vscode'],
    }),
    esbuild.build({
      ...base,
      entryPoints: [resolve(__dirname, '../lsp/src/index.ts')],
      outfile: resolve(__dirname, 'out/server.js'),
      format: 'cjs',
      external: ['fsevents'],
    }),
  ]);
}
