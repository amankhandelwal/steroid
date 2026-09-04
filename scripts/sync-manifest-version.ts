import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Makes `package.json` the single source of truth for the extension version.
 *
 * Chrome reads the version from `manifest.json`; `npm run package` names the
 * upload from it too. When those drift from `package.json`, the store rejects
 * the upload with "version already exists" — which reads like a store fault
 * rather than the typo it is. So rather than asking anyone to remember to edit
 * two files, the built manifest's version is overwritten here at build time.
 *
 * `public/manifest.json` keeps a real version string so it stays a valid
 * manifest on its own; that value is simply not the one that ships. Bump the
 * version in `package.json`.
 *
 * Runs on `closeBundle`, which fires after Vite has copied `publicDir` into
 * `outDir` — an earlier hook would write the manifest before the copy and be
 * silently overwritten by it.
 */
export function syncManifestVersion(root: string): Plugin {
  return {
    name: 'steroid:sync-manifest-version',
    apply: 'build',
    closeBundle() {
      const packageJsonPath = resolve(root, 'package.json');
      const manifestPath = resolve(root, 'dist/manifest.json');

      const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;

      if (manifest.version === version) {
        return;
      }

      const previous = manifest.version;
      manifest.version = version;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      console.log(
        `\nsync-manifest-version: dist/manifest.json ${previous} -> ${version} (from package.json).` +
          `\n  Update public/manifest.json to match when convenient; it is not what ships.`
      );
    },
  };
}
