import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
const host = execFileSync('rustc', ['-vV'], { encoding: 'utf8' })
  .match(/host: (.+)/)[1]
  .trim();
const target = process.env.CARGO_BUILD_TARGET || host;
execFileSync(
  'cargo',
  [
    'build',
    '--release',
    '--no-default-features',
    '--bin',
    'cloud-study-core',
    '--target',
    target,
    '--locked',
  ],
  { stdio: 'inherit' },
);
const ext = target.includes('windows') ? '.exe' : '';
mkdirSync('binaries', { recursive: true });
copyFileSync(
  `target/${target}/release/cloud-study-core${ext}`,
  `binaries/cloud-study-core-${target}${ext}`,
);
for (const mode of ['release', 'debug']) {
  mkdirSync(`target/${mode}`, { recursive: true });
  copyFileSync(
    `target/${target}/release/cloud-study-core${ext}`,
    `target/${mode}/cloud-study-core${ext}`,
  );
}
