import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptAccessStep, receiptSecurity } from '../src/application/receiptSecurity';

test('facial recognition starts disabled and persists changes across instances', async () => {
  const values = new Map<string, string>();
  const store = { getItemAsync: async (key: string) => values.get(key) ?? null, setItemAsync: async (key: string, value: string) => { values.set(key, value); } };
  assert.equal(await receiptSecurity(store).load(), false);
  await receiptSecurity(store).save(true);
  assert.equal(await receiptSecurity(store).load(), true);
  await receiptSecurity(store).save(false);
  assert.equal(await receiptSecurity(store).load(), false);
});

test('scanner-only access does not require an employee photo', () => {
  assert.equal(receiptAccessStep(false, null), 'payrolls');
  assert.equal(receiptAccessStep(false, 'photo'), 'payrolls');
});

test('enabled recognition always requires a photo and the face step', () => {
  assert.throws(() => receiptAccessStep(true, null), /fotografía/);
  assert.equal(receiptAccessStep(true, 'photo'), 'face');
});

test('unreadable or corrupt configuration does not silently disable recognition', async () => {
  const store = { getItemAsync: async () => 'corrupt', setItemAsync: async () => {} };
  await assert.rejects(receiptSecurity(store).load(), /no es válida/);
  await assert.rejects(receiptSecurity({ ...store, getItemAsync: async () => { throw new Error('storage unavailable'); } }).load(), /storage unavailable/);
});

test('saving failures propagate so the UI cannot claim a successful change', async () => {
  await assert.rejects(receiptSecurity({ getItemAsync: async () => 'true', setItemAsync: async () => { throw new Error('write failed'); } }).save(false), /write failed/);
});
