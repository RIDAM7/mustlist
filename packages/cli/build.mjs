// Builds the publishable CLI into packages/cli/dist:
//   cli.js         one ESM bundle (MCP SDK, search and tools included; no runtime deps)
//   snapshot.json  every card from the repository's dist/, for offline use
// Run from anywhere: `pnpm --filter mustlist build` (prepublishOnly runs it too).
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const out = path.join(here, 'dist');

// 1. Fresh card data from cards/ (validates every card; fails on errors).
execSync('pnpm build:data', { cwd: root, stdio: 'inherit' });

// 2. The offline snapshot.
const dist = path.join(root, 'dist');
const read = (relative) => readFileSync(path.join(dist, ...relative.split('/')), 'utf8');
const index = JSON.parse(read('index.json'));
const snapshot = {
  taken: new Date().toISOString(),
  source: 'bundled',
  cards: index.map(({ id }) => JSON.parse(read(`cards/${id}.json`))),
  markdown: Object.fromEntries(index.map(({ id }) => [id, read(`cards/${id}.md`)])),
};
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'snapshot.json'), JSON.stringify(snapshot));

// 3. The bundle. Some bundled CommonJS code calls require(), so provide one.
await build({
  entryPoints: [path.join(here, 'src', 'bin.ts')],
  outfile: path.join(out, 'cli.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: {
    js: "import { createRequire as __mustlistCreateRequire } from 'node:module';\nconst require = __mustlistCreateRequire(import.meta.url);",
  },
  legalComments: 'external',
  logLevel: 'warning',
});

// 4. Licences: code is MIT, card content is CC BY 4.0.
copyFileSync(path.join(root, 'LICENSE'), path.join(out, 'LICENSE'));
copyFileSync(path.join(root, 'LICENSE-CONTENT'), path.join(out, 'LICENSE-CONTENT'));

const kb = (file) => `${Math.round(statSync(path.join(out, file)).size / 1024)} KB`;
console.log(
  `mustlist CLI: dist/cli.js ${kb('cli.js')}, dist/snapshot.json ${kb('snapshot.json')} (${index.length} cards)`,
);
