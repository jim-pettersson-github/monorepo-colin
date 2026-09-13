import { execFileSync } from 'node:child_process';
import { chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (!process.env.CI) {
  const cwd = fileURLToPath(new URL('../../', import.meta.url));
  const hooksPath = execFileSync('git', ['config', '--default', '.githooks', '--get', 'core.hooksPath'], { cwd, encoding: 'utf8' }).trim();
  if (hooksPath !== '.githooks') throw new Error(`Existing core.hooksPath (${hooksPath}); configure the project's .githooks manually.`);

  chmodSync(new URL('../../.githooks/pre-commit', import.meta.url), 0o755);
  execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], { cwd });
  console.log('Installed local pre-commit checks: formatting, production build, and all tests.');
}
