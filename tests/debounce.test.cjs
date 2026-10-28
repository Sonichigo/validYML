const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDebouncer } = require('../out/debounce');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('coalesces edits per document without losing another document', async () => {
  const calls = [];
  const debounce = createDebouncer(30);
  debounce.schedule('a', () => calls.push('old'));
  debounce.schedule('b', () => calls.push('b'));
  debounce.schedule('a', () => calls.push('new'));
  await wait(80);
  assert.deepEqual(calls.sort(), ['b', 'new']);
  debounce.dispose();
});

test('cancel and dispose suppress pending callbacks', async () => {
  const calls = [];
  const debounce = createDebouncer(30);
  debounce.schedule('a', () => calls.push('a'));
  debounce.cancel('a');
  debounce.schedule('b', () => calls.push('b'));
  debounce.dispose();
  await wait(80);
  assert.deepEqual(calls, []);
});
