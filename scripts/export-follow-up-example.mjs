import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildFollowUpDemo } from '../src/product-room/follow-up-demo.js';

// Deliberately accepts no project data or browser export. This command exports
// only the public, fictional example embedded in this repository.
const destination = resolve(process.argv[2] || 'artifacts/follow-up/crank-review-v1.json');
if (process.argv.length > 3) throw new Error('Provide one output file path. No customer-project import is supported.');
const fixture = await buildFollowUpDemo();
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(fixture, null, 2) + '\n', { flag: 'wx' });
console.log(`Exported public fictional fixture: ${destination}`);
