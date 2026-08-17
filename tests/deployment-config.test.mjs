import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('dev deployment binds the test access key from GitHub Actions secrets', async () => {
  const workflow = await read('../.github/workflows/deploy-dev.yml');

  assert.match(workflow, /environment:\s*test/);
  assert.match(workflow, /secrets:\s*\|\s*ACCESS_KEY/);
  assert.match(workflow, /ACCESS_KEY:\s*\$\{\{\s*secrets\.TEST_ACCESS_KEY\s*\}\}/);
});
