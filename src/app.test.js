import { test } from 'node:test';
import assert from 'node:assert';
import app from './app.js';

test('app exports an Express application', () => {
  assert(app, 'app should be defined');
  assert(typeof app.get === 'function', 'app should have get method');
  assert(typeof app.post === 'function', 'app should have post method');
  assert(typeof app.use === 'function', 'app should have use method');
});

test('app has required middleware', () => {
  assert(app._router, 'app should have router');
});
