import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeUpdateStatus, type UpdateStatus } from '../src/application/updatePolicy';

const current: UpdateStatus = { required: false, available: false, downloaded: false, downloading: false };
test('blocks immediately when Google Play detects an update', () => {
  assert.equal(mergeUpdateStatus(current, { ...current, required: true, available: true }).required, true);
});
test('cancellation, offline checks and stale responses cannot unlock an update', () => {
  const required = { ...current, required: true };
  for (const next of [current, { ...current, error: 'offline' }, { ...current, downloaded: true }]) {
    assert.equal(mergeUpdateStatus(required, next).required, true);
  }
});
test('offline without a detected update does not manufacture a mandatory update', () => {
  assert.equal(mergeUpdateStatus(current, { ...current, error: 'offline' }).required, false);
});
test('download completion exposes installation without releasing the block', () => {
  const result = mergeUpdateStatus({ ...current, required: true, downloading: true }, { ...current, downloaded: true });
  assert.equal(result.required, true);
  assert.equal(result.downloading, false);
  assert.equal(result.downloaded, true);
});
