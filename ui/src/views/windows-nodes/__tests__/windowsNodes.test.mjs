import test from 'node:test';
import assert from 'node:assert/strict';
import { canControlSession, canStartSession, commandLifecycleLabel, flattenUiTree, mapError } from '../windowsNodesLogic.js';

test('only online-ready nodes can start a session', () => {
  assert.equal(canStartSession({ status: 'ONLINE' }), true);
  assert.equal(canStartSession({ status: 'LOCKED' }), false);
});

test('locked and disconnected nodes cannot be controlled', () => {
  assert.equal(canControlSession({ status: 'SESSION_LOCKED' }, { status: 'ACTIVE' }), false);
  assert.equal(canControlSession({ status: 'SESSION_DISCONNECTED' }, { status: 'ACTIVE' }), false);
  assert.equal(canControlSession({ status: 'ONLINE' }, { status: 'ACTIVE' }), true);
});

test('command lifecycle labels prefer evidence pending over empty success', () => {
  assert.equal(commandLifecycleLabel({ command: { status: 'EVIDENCE_PENDING' } }), 'Evidence pending');
  assert.equal(commandLifecycleLabel({ command: { status: 'COMPLETED' }, evidence_ready: true }), 'Completed');
  assert.equal(commandLifecycleLabel({ command: { status: 'EVIDENCE_FAILED' } }), 'Evidence failed');
});

test('maps typed backend errors without exposing payloads', () => {
  assert.deepEqual(mapError({ code: 'SESSION_LOCKED', message: 'Desktop is locked', secret: 'never shown' }), {
    code: 'SESSION_LOCKED',
    message: 'Desktop is locked'
  });
});

test('searches UI tree metadata recursively', () => {
  const items = flattenUiTree(
    [{ name: 'Window', children: [{ name: 'Save', automationId: 'saveButton', controlType: 'Button' }] }],
    'save'
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].automationId, 'saveButton');
  assert.equal(items[0].depth, 1);
});
