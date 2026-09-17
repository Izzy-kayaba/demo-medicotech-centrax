import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'public');
// The destination is a fixed generated directory inside this repository.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of await readdir(root)) {
  if (name.endsWith('.html') || ['assets', 'styles', 'js', 'admin'].includes(name)) {
    await cp(join(root, name), join(output, name), { recursive: true });
  }
}
console.log('Prepared public/ with website files only.');
