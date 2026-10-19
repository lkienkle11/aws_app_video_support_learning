import { execFileSync } from 'node:child_process';
import { chmodSync } from 'node:fs';
execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks']);
if (process.platform !== 'win32') chmodSync('.githooks/commit-msg', 0o755);
