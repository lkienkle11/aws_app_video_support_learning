import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function bytes(path) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) return stat.size;
  return readdirSync(path).reduce((sum, name) => sum + bytes(join(path, name)), 0);
}
const root = process.argv[2] || '.';
const size = bytes(root);
console.log(`Complete repository: ${size} / 7000000000 bytes`);
if (size > 7_000_000_000) process.exit(1);
