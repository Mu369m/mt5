const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('./dist/math.js');

test('shared math currency and scaling utilities are present and safe', () => {
  assert.equal(math.convertUsdToUsc(1.23), 123);
  assert.equal(math.convertUscToUsd(123), 1.23);
  assert.equal(math.scaleVolumeToDestination(100, 100), 1);
  assert.equal(math.scaleVolumeToDestination(100, 1000), 0.1);
  assert.equal(math.scaleVolumeToDestination(100, 0), 0);
  assert.equal(math.scaleVolumeFromDestination(1, 100), 100);
});

test('shared math decimal and markup utilities honor expected precision', () => {
  assert.equal(math.getPointValue(2), 0.01);
  assert.equal(math.getPointValue(5), 0.00001);
  assert.equal(math.applyMarkup(1.23450, 2, 5), 1.23452);
  assert.equal(math.calculateSlippage(1.23450, 1.23470, 5), 20);
  assert.equal(math.roundDecimal(1.234567, 4), 1.2346);
  assert.equal(math.normalizeValidLots(0.0049, 0.01), 0);
  assert.equal(math.pipsToPoints(10, 5), 100);
  assert.equal(math.pointsToPips(20, 5), 2);
});

test('sandbox adapter mode remains explicit and disconnected by default', async () => {
  const { createSandboxTradingDestinationAdapter, createUnavailableTradingDestinationAdapter } = require('../mt-bridge/dist/adapters.js');
  const sandbox = createSandboxTradingDestinationAdapter();
  const unavailable = createUnavailableTradingDestinationAdapter();

  assert.equal(sandbox.mode, 'SANDBOX');
  assert.equal(sandbox.liveEnabled, false);
  const health = await sandbox.healthCheck();
  assert.equal(health.status, 'OFFLINE');

  assert.equal(unavailable.mode, 'SANDBOX');
  assert.equal(unavailable.liveEnabled, false);
  await assert.rejects(() => unavailable.connect(), /No live trading destination adapter is connected/);
});

test('execution router refuses to convert a non-live destination adapter into a safety adapter', () => {
  const { createUnavailableTradingDestinationAdapter } = require('../mt-bridge/dist/adapters.js');
  const { destinationAdapterToExecutionAdapter } = require('../mt-bridge/dist/execution-router.js');
  const adapter = createUnavailableTradingDestinationAdapter();

  assert.throws(() => destinationAdapterToExecutionAdapter(adapter), /registered live trading destination adapter/);
});

test('registry keeps a visible, safe live-adapter scan path and rejects implicit sandbox discovery', () => {
  const { createTradingDestinationRegistry, createSandboxTradingDestinationAdapter, createUnavailableTradingDestinationAdapter, createLiveTradingDestinationAdapter } = require('../mt-bridge/dist/adapters.js');
  const registry = createTradingDestinationRegistry();
  const sandbox = createSandboxTradingDestinationAdapter();
  const unavailable = createUnavailableTradingDestinationAdapter();
  const live = createLiveTradingDestinationAdapter();

  registry.register(sandbox, 'SANDBOX');
  registry.register(unavailable, 'UNAVAILABLE');
  registry.register(live, 'LIVE');

  assert.equal(registry.hasLiveAdapter(), false);
  assert.equal(registry.getLiveAdapter(), undefined);
  assert.equal(registry.get('SANDBOX')?.mode, 'SANDBOX');
  assert.equal(registry.get('LIVE')?.liveEnabled, false);
});

test('netting engine rejects invalid tenant context, symbol and direction before mutating exposure', () => {
  const { processNettingOffset } = require('../mt-bridge/dist/netting.js');
  assert.throws(() => processNettingOffset('', 'EURUSD', 'BUY', 1), /Tenant context is required/);
  assert.throws(() => processNettingOffset('tenant', '', 'BUY', 1), /Symbol is required/);
  assert.throws(() => processNettingOffset('tenant', 'EURUSD', 'HOLD', 1), /Direction must be BUY or SELL/);
  assert.throws(() => processNettingOffset('tenant', 'EURUSD', 'BUY', 0), /Volume lots must be a positive finite number/);
});

test('risk engine rejects malformed flow profile and execution config before routing a book', () => {
  const { classifyFlow, evaluateTrade, calculateCopyLots } = require('../mt-bridge/dist/risk.js');
  assert.throws(() => classifyFlow({}), /Invalid flow profile input/);
  assert.equal(calculateCopyLots({ lotSizingMode: 'FIXED', fixedLots: 1 }, 0, 100, 100), 0);
  assert.equal(calculateCopyLots({ lotSizingMode: 'BAD', fixedLots: 1 }, 1, 100, 100), 0);
  assert.equal(calculateCopyLots({ lotSizingMode: 'FIXED', fixedLots: Number.NaN }, 1, 100, 100), 0);
  assert.deepEqual(evaluateTrade({}, 'EURUSD', 'BUY', 1, 'B_BOOK', 0), { allowed: false, reason: 'Invalid execution config', direction: 'BUY', volumeLots: 1, book: 'B_BOOK' });
});

test('smart routing rejects malformed telemetry and toxic-flow signatures before route scoring', () => {
  const { recordExecutionMetrics, selectBestSlippageDestination, assessToxicFlowAndCalculateDelay } = require('../mt-bridge/dist/smart-routing.js');
  assert.throws(() => recordExecutionMetrics('', 'D1', 1, 1), /Symbol is required/);
  assert.throws(() => recordExecutionMetrics('EURUSD', '', 1, 1), /Destination id is required/);
  assert.throws(() => recordExecutionMetrics('EURUSD', 'D1', NaN, 1), /Slippage points must be a finite non-negative number/);
  assert.throws(() => assessToxicFlowAndCalculateDelay('', 1), /Source group is required/);
  assert.throws(() => assessToxicFlowAndCalculateDelay('G1', 0), /Lots must be a positive finite number/);
  assert.equal(selectBestSlippageDestination('', ['D1']), null);
  assert.equal(selectBestSlippageDestination('EURUSD', []), null);
});

test('router rejects malformed rule-resolution inputs before scanning Prisma routing rules', async () => {
  const { resolveDestinationForGroup } = require('../mt-bridge/dist/router.js');
  await assert.rejects(() => resolveDestinationForGroup('', 'JK1\\1A\\G-fwd', 1, 'EURUSD'), /Tenant context is required/);
  await assert.rejects(() => resolveDestinationForGroup('tenant-id', '', 1, 'EURUSD'), /Source group is required/);
  await assert.rejects(() => resolveDestinationForGroup('tenant-id', 'JK1\\1A\\G-fwd', 0, 'EURUSD'), /Lots must be a positive finite number/);
  await assert.rejects(() => resolveDestinationForGroup('tenant-id', 'JK1\\1A\\G-fwd', 1, ''), /Symbol is required/);
});

test('news shield rejects malformed calendar and test event input before volatility window scoring', () => {
  const { checkNewsShieldWindow, injectTestNewsEvent } = require('../mt-bridge/dist/news-shield.js');
  assert.equal(checkNewsShieldWindow().isShieldActive, false);
  assert.throws(() => injectTestNewsEvent('', 5), /Title is required/);
  assert.throws(() => injectTestNewsEvent('NFP Event', Number.NaN), /Delay minutes must be a finite positive number/);
});

test('symbol resolver rejects malformed explicit mapping and normalization configuration before attempting a destination symbol pass-through', () => {
  const { resolveDestinationSymbol } = require('../mt-bridge/dist/symbol-resolver.js');
  assert.throws(() => resolveDestinationSymbol('', {}), /Source symbol is required/);
  assert.throws(() => resolveDestinationSymbol('EURUSD', { explicitMappings: { EURUSD: '' } }), /Explicit destination symbol must not be empty/);
  assert.throws(() => resolveDestinationSymbol('EURUSD', { prefixes: [''] }), /Prefix entries must be non-empty strings/);
  assert.throws(() => resolveDestinationSymbol('EURUSD', { suffixes: [''] }), /Suffix entries must be non-empty strings/);
});

test('copier rejects malformed event and heartbeat payloads before dispatching into a slave adapter', async () => {
  const { dispatchCopierEvent, recordHeartbeat } = require('../mt-bridge/dist/copier.js');

  const invalidPayload = await dispatchCopierEvent({}, 'slave-1', 1, (symbol) => symbol);
  assert.equal(invalidPayload.status, 'FAILED');
  assert.match(invalidPayload.errorMessage, /Event payload is required/);

  const invalidSymbol = await dispatchCopierEvent({
    eventId: 'e1',
    profileId: 'p1',
    masterConnectionId: 'm1',
    masterTicket: 'TICKET-1',
    eventType: 'ORDER_OPEN',
    symbol: '',
    volumeLots: 1,
    occurredAt: '2026-09-09T00:00:00.000Z',
  }, 'slave-1', 1, (symbol) => symbol);
  assert.equal(invalidSymbol.status, 'FAILED');
  assert.match(invalidSymbol.errorMessage, /Symbol is required/);

  assert.throws(() => recordHeartbeat({ connectionId: '', sentAt: '2026-09-09T00:00:00.000Z' }), /Connection id is required/);
});

test('copier reconciliation refuses blank connection identifiers and empty snapshot inventories before looking up a connected slave adapter', async () => {
  const { reconcilePositions } = require('../mt-bridge/dist/copier.js');
  await assert.rejects(() => reconcilePositions('', []), /Slave connection id is required/);
  await assert.rejects(() => reconcilePositions('slave-1', []), /Expected positions must be a non-empty array/);
});
