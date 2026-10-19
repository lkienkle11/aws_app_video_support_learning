import { execFileSync } from 'node:child_process';
const names = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
for (const name of names) {
  const bytes = Number(
    execFileSync('git', ['cat-file', '-s', `:${name}`], { encoding: 'utf8' }).trim(),
  );
  if (
    bytes > 1_000_000 ||
    /(^|\/)(files|tools|target|node_modules|dist|vendor|\.codegraph)\//.test(name) ||
    /\.(mp4|m4v|mov|webm|sqlite(?:-.*)?|db|zip|exe|dmg|deb|AppImage)$/i.test(name)
  ) {
    throw new Error(`Refusing generated/heavy data in Git: ${name} (${bytes} bytes)`);
  }
}
console.log(`Staged-file guard: ${names.length} files checked`);
