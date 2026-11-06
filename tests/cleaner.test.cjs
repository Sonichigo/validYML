const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isKubernetesManifest } = require('../out/cleaner');

test('accepts a Kubernetes manifest', () => {
  assert.equal(isKubernetesManifest('apiVersion: v1\nkind: Pod\nmetadata:\n  name: demo\n'), true);
});

test('rejects an explicit null document after a manifest', () => {
  assert.equal(isKubernetesManifest('apiVersion: v1\nkind: Pod\n---\nnull\n'), false);
  assert.equal(isKubernetesManifest('apiVersion: v1\nkind: Pod\n---\n~\n'), false);
});

test('tolerates a trailing empty document', () => {
  assert.equal(isKubernetesManifest('apiVersion: v1\nkind: Pod\n---\n'), true);
  assert.equal(isKubernetesManifest('apiVersion: v1\nkind: Pod\n---\n# end\n'), true);
});

test('rejects YAML that is not a manifest', () => {
  assert.equal(isKubernetesManifest('services:\n  web:\n    image: nginx\n'), false);
  assert.equal(isKubernetesManifest('foo: bar\n'), false);
});
