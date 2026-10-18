'use strict';

const fs = require('fs');
const assert = require('assert');
const { backtest } = require('../v2/experiments/engine-v3-atr-filter');

const datasets = [
  ['Development', 'data/historical/btcusdt-1m-90d-2026-10-17.json'],
  ['Out-of-sample', 'data/historical/btcusdt-1m-validation-2026-07-19.json']
];

function summarize(trades) {
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const sum = list => list.reduce((total, t) => total + t.pnl, 0);

  return {
    trades: trades.length,
    wins: wins.length,
    winRatePct: trades.length
      ? +(wins.length / trades.length * 100).toFixed(2) : 0,
    netPnL: +sum(trades).toFixed(2),
    avgWin: wins.length ? +(sum(wins) / wins.length).toFixed(3) : 0,
    avgLoss: losses.length ? +(sum(losses) / losses.length).toFixed(3) : 0
  };
}

for (const [name, file] of datasets) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const candles = Array.isArray(data) ? data : data.candles;

  assert.ok(Array.isArray(candles), `Invalid dataset: ${file}`);

  const result = backtest(candles);
  const trades = result.tradeHistory;

  console.log('\n=== ' + name.toUpperCase() + ' ===');

  console.log('BY DIRECTION');
  console.table(['LONG', 'SHORT'].map(side => ({
    side,
    ...summarize(trades.filter(t => t.side === side))
  })));

  console.log('BY EXIT REASON');
  const reasons = [...new Set(trades.map(t => t.reason))];
  console.table(reasons.map(reason => ({
    reason,
    ...summarize(trades.filter(t => t.reason === reason))
  })));

  console.log('OVERALL');
  console.table([summarize(trades)]);

  console.log('BACKTEST METRICS');
  console.log({
    finalBalance: result.finalBalance,
    returnPct: result.returnPct,
    profitFactor: result.profitFactor,
    maxDrawdownPct: result.maxDrawdownPct
  });

  assert.strictEqual(trades.length, result.trades);
  assert.ok(
    Math.abs(
      trades.reduce((sum, t) => sum + t.pnl, 0) - result.netPnL
    ) < 1e-6,
    `${name}: P&L reconciliation failed`
  );
}

console.log('\nPASS: Step 78CD completed');
