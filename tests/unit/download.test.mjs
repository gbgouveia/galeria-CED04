import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoParts } from '../../src/services/downloadService.js';

const photo = (id, mb) => ({ id, sizeBytes: mb * 1024 * 1024 });

test('mantém tudo em uma parte quando cabe no limite', () => {
  const parts = splitIntoParts([photo('a', 1), photo('b', 2)], 10 * 1024 * 1024);
  assert.equal(parts.length, 1);
});

test('divide em partes respeitando o limite e a ordem, sem perder fotos', () => {
  const list = Array.from({ length: 10 }, (_, i) => photo(String(i), 3));
  const parts = splitIntoParts(list, 10 * 1024 * 1024);
  assert.equal(parts.length, 4);
  assert.deepEqual(parts.flat().map((p) => p.id), list.map((p) => p.id));
  for (const part of parts) assert.ok(part.reduce((s, p) => s + p.sizeBytes, 0) <= 10 * 1024 * 1024);
});

test('foto maior que o limite fica sozinha em uma parte', () => {
  const parts = splitIntoParts([photo('big', 20), photo('small', 1)], 10 * 1024 * 1024);
  assert.deepEqual(parts.map((p) => p.length), [1, 1]);
});
