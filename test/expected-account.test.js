import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedAccount } from '../src/middleware/expectedAccount.js';
function simulate(expected, actual) {
  let called = false, status = 0, body = null;
  const req = { body: expected == null ? {} : { expectedUserId: expected }, auth: { userId: actual } };
  const res = { status(value) { status=value; return this; }, json(value) { body=value; return this; } };
  expectedAccount(req, res, () => { called=true; });
  return { called, status, body };
}
test('a pending event from another account is rejected', () => {
  const actual = simulate('player-a','player-b');
  assert.equal(actual.called,false);
  assert.equal(actual.status,409);
  assert.equal(actual.body?.error?.code,'ACCOUNT_CHANGED');
});
test('matching account and clients without owner field retain access', () => {
  assert.equal(simulate('player-a','player-a').called,true);
  assert.equal(simulate(null,'player-a').called,true);
});
