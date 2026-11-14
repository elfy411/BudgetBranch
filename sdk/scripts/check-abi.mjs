import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const [frozen, copy, manifest] = await Promise.all([
  readFile(new URL('../../docs/abi.ts', import.meta.url)),
  readFile(new URL('../src/types.ts', import.meta.url)),
  readFile(new URL('../../docs/FROZEN_INTERFACE.json', import.meta.url), 'utf8'),
]);
const expectedHash = JSON.parse(manifest).files['docs/abi.ts'].sha256;
assert.equal(createHash('sha256').update(frozen).digest('hex'), expectedHash, 'Frozen ABI hash differs');
assert.ok(copy.equals(frozen), 'sdk/src/types.ts must be byte-identical to the frozen docs/abi.ts');
