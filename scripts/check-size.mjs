import { statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const limit = 20_000_000;
function size(path) {
  return statSync(path).isDirectory()
    ? readdirSync(path).reduce((n, p) => n + size(join(path, p)), 0)
    : statSync(path).size;
}
const paths = process.argv.slice(2);
if (!paths.length) throw new Error('Pass a .app folder, installer or binary pair');
let total = 0;
for (const path of paths) {
  const bytes = size(path);
  total += bytes;
  console.log(`${path}: ${bytes} bytes`);
}
console.log(`Total: ${total} / ${limit} bytes`);
if (total >= limit) process.exit(1);
