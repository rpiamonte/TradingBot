const { createIndicatorStream } = require('./indicators-v2');
const { Timeframe15m } = require('./timeframe-15m');
const { Trend15m } = require('./trend-15m');
const { PullbackSignal } = require('./pullback-signal');
const { evaluateSignal } = require('./evaluate-signal-v2');

const config = {
  capital: 1000,
  risk: 0.01,
  maxExposure: 1.0,
  atrMultiplier: 1.5,
  rewardRatio: 2,
  fee: 0.0005,
  slippage: 0.0002
};

function backtest(candles) {
  let balance = config.capital;
  let peak = balance;
  let maxDrawdown = 0;
  let minimumEquity = balance;
  let position = null;
  let pending = null;
  const trades = [];

  function estimatedEquity(mark) {
    if (!position) return balance;

    const p = position;
    const direction = p.side === 'LONG' ? 1 : -1;
    const exit = mark * (1 - direction * config.slippage);
    const gross = (exit - p.entry) * p.quantity * direction;
    const exitFee = exit * p.quantity * config.fee;

    return balance + gross - p.entryFee - exitFee;
  }

  function observeEquity(value) {
    if (!Number.isFinite(value)) {
      throw new Error('Invalid equity value');
    }

    peak = Math.max(peak, value);
    minimumEquity = Math.min(minimumEquity, value);

    if (peak > 0) {
      maxDrawdown = Math.max(
        maxDrawdown,
        (peak - value) / peak
      );
    }
  }

  function recordExit(candle, level, reason) {
    const p = position;
    const direction = p.side === 'LONG' ? 1 : -1;
    const exit = level * (1 - direction * config.slippage);
    const gross = (exit - p.entry) * p.quantity * direction;
    const exitFee = exit * p.quantity * config.fee;
    const pnl = gross - p.entryFee - exitFee;
    balance += pnl;
    observeEquity(balance);
    trades.push({ side: p.side, entryTime: p.time, exitTime: candle.timestamp,
      entry: p.entry, exit, pnl, balance, reason });
    position = null;
  }

  const indicatorStream = createIndicatorStream();
  const timeframe15m = new Timeframe15m();
  const trend15m = new Trend15m();
  const pullbackSignal = new PullbackSignal();
  let currentTrend15m = null;

  function updateTrend(candle) {
    const completed = timeframe15m.next(candle);

    if (completed) {
      currentTrend15m = trend15m.next(completed);
    }
  }
  let previousStreamValue = null;

  // Warm up indicators using historical candles.
  // The original trading loop begins at index 251.
  for (let j = 0; j < Math.min(251, candles.length); j++) {
    previousStreamValue = indicatorStream.next(candles[j]);
    updateTrend(candles[j]);
    pullbackSignal.next(candles[j], 'NEUTRAL');
  }

  for (let i = 251; i < candles.length; i++) {
    const candle = candles[i];
    const streamCurrent = indicatorStream.next(candle);
    updateTrend(candle);
    const pullback = pullbackSignal.next(
      candle,
      currentTrend15m?.trend ?? 'NEUTRAL'
    );
    const streamPrevious = previousStreamValue;
    previousStreamValue = streamCurrent;
    if (!candle.confirmed) throw new Error(`Unconfirmed candle at index ${i}`);
    let occupiedThisCandle = Boolean(position || pending);

    if (pending && !position) {
      const direction = pending.side === 'LONG' ? 1 : -1;
      const entry = candle.open * (1 + direction * config.slippage);
      const distance = pending.atr * config.atrMultiplier;
      if (distance > 0 && Number.isFinite(distance)) {
        const stop = entry - direction * distance;
        const target = entry + direction * distance * config.rewardRatio;
        const estimatedRiskPerUnit = distance + entry * config.fee +
          stop * config.fee + stop * config.slippage;
        const riskQuantity =
          balance * config.risk / estimatedRiskPerUnit;

        const exposureQuantity =
          balance * config.maxExposure /
          (entry * (1 + config.fee));

        const quantity = Math.min(
          riskQuantity,
          exposureQuantity
        );

        if (quantity > 0 && Number.isFinite(quantity)) {
          position = { side: pending.side, entry, stop, target, quantity,
            entryFee: entry * quantity * config.fee, time: candle.timestamp };
        }
      }
      pending = null;
    }

    if (position) {
      observeEquity(estimatedEquity(candle.open));
      const p = position;
      // If the candle opens beyond a protective level, fill at the open,
      // not at an unreachable stop/target price.
      const openStop = p.side === 'LONG' ? candle.open <= p.stop : candle.open >= p.stop;
      const openTarget = p.side === 'LONG' ? candle.open >= p.target : candle.open <= p.target;
      const stopHit = p.side === 'LONG' ? candle.low <= p.stop : candle.high >= p.stop;
      const targetHit = p.side === 'LONG' ? candle.high >= p.target : candle.low <= p.target;
      if (openStop) recordExit(candle, candle.open, 'STOP_GAP');
      else if (openTarget) recordExit(candle, p.target, 'TARGET_GAP');
      else if (stopHit) recordExit(candle, p.stop, 'STOP');
      else if (targetHit) recordExit(candle, p.target, 'TARGET');

      if (position) {
        const adverse = p.side === 'LONG'
          ? candle.low
          : candle.high;

        observeEquity(estimatedEquity(adverse));
        observeEquity(estimatedEquity(candle.close));
      }
    }

    // Equity and drawdown are tracked by observeEquity().
    // Do not enter again on a candle that already held a position.
    if (occupiedThisCandle || position || balance <= 0 || i === candles.length - 1) continue;

    const current = streamCurrent;
    const previous = streamPrevious;
    const signal = pullback.signal;

    if (
      (signal === 'LONG' || signal === 'SHORT') &&
      current.atr > 0
    ) {
      pending = { side: signal, atr: current.atr };
    }
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  return {
    initialCapital: config.capital, finalBalance: balance,
    netPnL: balance - config.capital,
    returnPct: (balance / config.capital - 1) * 100,
    trades: trades.length,
    winRate: trades.length ? wins.length / trades.length * 100 : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : null,
    maxDrawdownPct: maxDrawdown * 100,
    openPosition: position,
    finalEquity: position
      ? estimatedEquity(candles[candles.length - 1].close)
      : balance,
    minimumObservedEquity: minimumEquity,
    tradeHistory: trades
  };
}

module.exports = { backtest };
