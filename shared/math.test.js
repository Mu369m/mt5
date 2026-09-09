const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('./dist/math.js');

test('shared math currency and scaling utilities are present and safe', () => {
  assert.equal(math.convertUsdToUsc(1.23), 123);
  assert.equal(math.convertUscToUsd(123), 1.23);
  assert.equal(math.scaleVolumeToDestination(100, 100), 1);
  assert.equal(math.scaleVolumeToDestination(100, 1000), 0.1);
  assert.equal(math.scaleVolumeToDestination(100, 0), 0);
});

test('shared math decimal and markup utilities honor expected precision', () => {
  assert.equal(math.getPointValue(2), 0.01);
  assert.equal(math.getPointValue(5), 0.00001);
  assert.equal(math.applyMarkup(1.23450, 2, 5), 1.23452);
  assert.equal(math.calculateSlippage(1.23450, 1.23470, 5), 20);
});
