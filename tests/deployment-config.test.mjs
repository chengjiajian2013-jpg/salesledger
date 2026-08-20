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

test('production deployment applies the Fenghua category migration before Worker deploy', async () => {
  const workflow = await read('../.github/workflows/deploy-main.yml');
  assert.match(workflow, /Apply production D1 migration/);
  assert.match(workflow, /d1 execute salesledger-db --remote --file=\.\/migrations\/003_add_fenghua_categories\.sql/);
});
