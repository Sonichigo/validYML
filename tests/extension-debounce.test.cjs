const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
const events = {};
let calls = 0;
let deletes = 0;
const diagnosticCollection = { set() {}, delete() { deletes++; }, dispose() {} };
const vscode = {
  languages: { createDiagnosticCollection: () => diagnosticCollection },
  commands: { registerCommand: () => ({ dispose() {} }) },
  workspace: {
    getConfiguration: () => ({ get: () => true }),
    onDidChangeTextDocument: callback => (events.change = callback, { dispose() {} }),
    onDidOpenTextDocument: callback => (events.open = callback, { dispose() {} }),
    onDidCloseTextDocument: callback => (events.close = callback, { dispose() {} }),
  },
};
Module._load = function(request, parent, isMain) {
  if (request === 'vscode') return vscode;
  if (parent?.filename.endsWith('extension.js') && request === './validator') return { validateFile: async () => { calls++; return []; } };
  return originalLoad.apply(this, arguments);
};
const extension = require('../out/extension');
Module._load = originalLoad;
const document = { languageId: 'yaml', uri: { toString: () => 'file:///test.yaml' } };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('a burst of editor changes triggers one validation; closing cancels pending work', async () => {
  extension.activate({ subscriptions: [] });
  events.change({ document });
  events.change({ document });
  events.change({ document });
  await wait(400);
  assert.equal(calls, 1);
  events.change({ document });
  events.close(document);
  assert.equal(deletes, 0, 'closing preserves existing diagnostics');
  await wait(400);
  assert.equal(calls, 1);
});
