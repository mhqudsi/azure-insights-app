/**
 * Builds deploy-package/ for Azure App Service (Node SSR):
 *   deploy-package/
 *     browser/   ← Angular browser build
 *     server/    ← Angular SSR server
 *     package.json  (start: node server/server.mjs)
 *     node_modules/ (production deps only)
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const deployDir = join(root, 'deploy-package');
const distRoot = join(root, 'dist/azure-insights-app');

rmSync(deployDir, { recursive: true, force: true });
mkdirSync(deployDir, { recursive: true });

cpSync(join(distRoot, 'browser'), join(deployDir, 'browser'), { recursive: true });
cpSync(join(distRoot, 'server'), join(deployDir, 'server'), { recursive: true });

const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const deployPkg = {
  name: rootPkg.name,
  version: rootPkg.version,
  private: true,
  type: 'module',
  engines: rootPkg.engines,
  scripts: {
    start: 'node server/server.mjs',
  },
  dependencies: rootPkg.dependencies,
};

writeFileSync(join(deployDir, 'package.json'), JSON.stringify(deployPkg, null, 2));
cpSync(join(root, 'package-lock.json'), join(deployDir, 'package-lock.json'));

console.log('Installing production dependencies in deploy-package…');
execSync('npm ci --omit=dev', { cwd: deployDir, stdio: 'inherit' });

console.log('deploy-package ready.');
