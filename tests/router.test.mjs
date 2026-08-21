import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRelevance, routeQuery } from '../src/lib/agent/relevance.ts';

// TASK 1 — smart routing: the retrieval/scan pipeline must run ONLY for
// permit-related input, and must be short-circuited for off-topic input.

test('off-topic queries do NOT trigger the retrieval pipeline', () => {
  for (const q of ['what is the weather today', 'tell me a joke', 'who won the game last night', 'write me a poem']) {
    let called = false;
    const out = routeQuery(q, false, { retrieve: () => { called = true; return 'RAN'; } });
    assert.equal(called, false, `retrieve should NOT be called for: "${q}"`);
    assert.equal(out.ran, false);
    assert.equal(classifyRelevance(q).relevant, false);
  }
});

test('permit-related queries DO trigger the retrieval pipeline', () => {
  for (const q of [
    'what is the minimum rear setback',
    'does my building height comply with the zoning code',
    'how many parking spaces are required',
    'explain the egress width requirement',
  ]) {
    let called = false;
    const out = routeQuery(q, false, { retrieve: () => { called = true; return 'RAN'; } });
    assert.equal(called, true, `retrieve SHOULD be called for: "${q}"`);
    assert.equal(out.ran, true);
    assert.equal(out.result, 'RAN');
    assert.equal(classifyRelevance(q).relevant, true);
  }
});

test('a query tied to a specific assessment item is always relevant', () => {
  assert.equal(classifyRelevance('why?', true).relevant, true);
});

test('empty query is not relevant', () => {
  assert.equal(classifyRelevance('', false).relevant, false);
});
