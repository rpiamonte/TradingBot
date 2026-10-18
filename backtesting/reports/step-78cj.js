'use strict';

const fs = require('fs');
const assert = require('assert');
const { backtest } = require('../v2/experiments/engine-v3-atr-filter');

const datasets = [
  ['Development', 'data/historical/btcusdt-1m-90d-2026-10-17.json'],
  ['Out-of-sample', 'data/historical/btcusdt-1m-validation-2026-07-19.json']
];

const round = (n, digits = 2) =>
  Number.isFinite(n) ? +n.toFixed(digits) : null;

const month = timestamp =>
  new Date(Number(timestamp)).toISOString().slice(0, 7);

function summarize(trades) {
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);

  const sum = items =>
    items.reduce((total, t) => total + t.pnl, 0);

  const profit = sum(wins);
  const loss = -sum(losses);
  const averageWin = wins.length ? profit / wins.length : 0;
  const averageLoss = losses.length ? loss / losses.length : 0;

  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRatePct: round(trades.length ? wins.length / trades.length * 100 : 0),
    netPnL: round(sum(trades)),
    avgWin: round(averageWin, 3),
    avgLoss: round(-averageLoss, 3),
    realizedWinLossRatio: averageLoss
      ? round(averageWin / averageLoss, 3) : null,
    profitFactor: loss ? round(profit / loss, 3) : null
  };
}

for (const [name, path] of datasets) {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  const candles = Array.isArray(raw) ? raw : raw.candles;

  assert.ok(Array.isArray(candles) && candles.length > 0);

  const result = backtest(candles);
  const trades = result.tradeHistory;

  assert.strictEqual(trades.length, result.trades);
  assert.ok(
    Math.abs(
      trades.reduce((s, t) => s + t.pnl, 0) - result.netPnL
    ) < 1e-6
  );

  console.log('\n=== ' + name.toUpperCase() + ' ===');

  const first = candles[0];
  const last = candles[candles.length - 1];

  console.log('MARKET CONTEXT');
  console.table([{
    start: new Date(Number(first.timestamp)).toISOString(),
    end: new Date(Number(last.timestamp)).toISOString(),
    startPrice: round(Number(first.open)),
    endPrice: round(Number(last.close)),
    btcChangePct: round(
      (Number(last.close) / Number(first.open) - 1) * 100
    ),
    tradesPer30Days: round(trades.length / (candles.length / 1440) * 30)
  }]);

  console.log('MONTHLY TRADE PERFORMANCE (ENTRY MONTH)');
  const months = [...new Set(trades.map(t => month(t.entryTime)))].sort();

  console.table(months.map(m => ({
    month: m,
    ...summarize(trades.filter(t => month(t.entryTime) === m))
  })));

  console.log('MONTHLY PERFORMANCE BY DIRECTION');
  console.table(months.flatMap(m =>
    ['LONG', 'SHORT'].map(side => ({
      month: m,
      side,
      ...summarize(trades.filter(t =>
        month(t.entryTime) === m && t.side === side
      ))
    }))
  ));

  console.log('OVERALL TRADE QUALITY');
  console.table([summarize(trades)]);

  console.log('BY DIRECTION');
  console.table(['LONG', 'SHORT'].map(side => ({
    side,
    ...summarize(trades.filter(t => t.side === side))
  })));

  console.log('BY EXIT REASON');
  console.table(
    [...new Set(trades.map(t => t.reason))].map(reason => ({
      reason,
      ...summarize(trades.filter(t => t.reason === reason))
    }))
  );

  console.log('BACKTEST METRICS');
  console.log({
    finalBalance: result.finalBalance,
    netPnL: result.netPnL,
    returnPct: result.returnPct,
    profitFactor: result.profitFactor,
    maxDrawdownPct: result.maxDrawdownPct
  });
}

console.log('\nPASS: Step 78CJ completed');
