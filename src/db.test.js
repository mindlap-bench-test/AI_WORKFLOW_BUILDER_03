import { test } from 'node:test';
import assert from 'node:assert';
import * as db from './db.js';

test('db module exports required functions', () => {
  assert(typeof db.query === 'function', 'query function should exist');
  assert(typeof db.getClient === 'function', 'getClient function should exist');
  assert(typeof db.close === 'function', 'close function should exist');
  assert(typeof db.initialize === 'function', 'initialize function should exist');
});
