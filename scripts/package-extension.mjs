/**
 * Zips `dist/` into the archive the Chrome Web Store expects.
 *
 * Two things this gets right that a one-line shell script did not:
 *
 * 1. The archive's name comes from `dist/manifest.json` — the built artefact
 *    Chrome actually reads — not from `package.json`. The zip label therefore
 *    cannot disagree with the version inside it.
 * 2. `manifest.json` ends up at the archive root. Zipping the folder itself
 *    nests everything under `dist/`, and the store rejects that upload.
 *
 * Run via `npm run package`, which builds first.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = resolve(REPO, 'dist');
const MANIFEST = resolve(DIST, 'manifest.json');

/** Read the version Chrome will see, failing loudly if the build did not run. */
function builtVersion() {
  if (!existsSync(MANIFEST)) {
    throw new Error(`No manifest at ${MANIFEST}. Run \`npm run build\` first.`);
  }

  const { version } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  if (typeof version !== 'string' || !/^\d+(\.\d+){0,3}$/.test(version)) {
    throw new Error(`dist/manifest.json has an invalid version: ${JSON.stringify(version)}`);
  }

  return version;
}

function main() {
  const version = builtVersion();
  const archive = resolve(REPO, `steroid-${version}.zip`);

  // zip appends to an existing archive rather than replacing it, which would
  // quietly carry across files deleted since the last package.
  rmSync(archive, { force: true });

  // `.` rather than the directory name, so paths are relative to dist/.
  execFileSync('zip', ['-qr', archive, '.', '-x', '*.DS_Store'], { cwd: DIST });

  const sizeKb = statSync(archive).size / 1024;
  console.log(`packaged steroid-${version}.zip (${sizeKb.toFixed(0)} KB) — upload this file`);
}

main();
