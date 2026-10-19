import { execFileSync } from 'node:child_process';
import { chmodSync } from 'node:fs';
execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks']);
if (process.platform !== 'win32') {
  for (const hook of ['commit-msg', 'pre-commit']) chmodSync(`.githooks/${hook}`, 0o755);
}
