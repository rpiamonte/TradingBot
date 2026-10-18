const { calculateIndicators } = require("../src/strategy/indicators");
const { evaluateSignal } = require("./evaluate-signal");

const config = {
  capital: 1000,
  risk: 0.01,
  atrMultiplier: 1.5,
  rewardRatio: 2,
  fee: 0.0005,
  slippage: 0.0002
};

function backtest(candles) {
  let balance = config.capital;
  let peak = balance;
  let maxDrawdown = 0;
  let position = null;
  const trades = [];

  for (let i = 251; i < candles.length - 1; i++) {
    const candle = candles[i];

    // Manage existing position using this candle.
    if (position) {
      const p = position;
      const stopHit = p.side === "LONG"
        ? candle.low <= p.stop
        : candle.high >= p.stop;

      const targetHit = p.side === "LONG"
        ? candle.high >= p.target
        : candle.low <= p.target;

      if (stopHit || targetHit) {
        // Conservative: stop takes priority.
        const level = stopHit ? p.stop : p.target;
        const exit = level * (
          p.side === "LONG"
            ? 1 - config.slippage
            : 1 + config.slippage
        );

        const direction = p.side === "LONG" ? 1 : -1;
        const gross = (exit - p.entry) * p.quantity * direction;
        const exitFee = exit * p.quantity * config.fee;
        const pnl = gross - p.entryFee - exitFee;

        balance += pnl;

        trades.push({
          side: p.side,
          entryTime: p.time,
          exitTime: candle.timestamp,
          entry: p.entry,
          exit,
          pnl,
          balance,
          reason: stopHit ? "STOP" : "TARGET"
        });

        position = null;
      }
    }

    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(
      maxDrawdown,
      (peak - balance) / peak
    );

    if (position || balance <= 0) continue;

    const history = candles.slice(0, i + 1);
    const current = calculateIndicators(history);
    const previous = calculateIndicators(history.slice(0, -1));

    const signal = evaluateSignal(current, previous);
    if (signal === "WAIT") continue;

    const next = candles[i + 1];
    const direction = signal === "LONG" ? 1 : -1;
    const entry = next.open * (
      1 + direction * config.slippage
    );

    const distance = current.atr * config.atrMultiplier;
    if (!(distance > 0)) continue;

    const stop = entry - direction * distance;
    const target = entry + direction * distance * config.rewardRatio;

    // Include estimated fees and slippage in risk sizing.
    const estimatedRiskPerUnit =
      distance +
      entry * config.fee +
      stop * config.fee +
      stop * config.slippage;

    const quantity = balance * config.risk / estimatedRiskPerUnit;
    const entryFee = entry * quantity * config.fee;

    position = {
      side: signal,
      entry,
      stop,
      target,
      quantity,
      entryFee,
      time: next.timestamp
    };
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);

  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(
    losses.reduce((s, t) => s + t.pnl, 0)
  );

  return {
    initialCapital: config.capital,
    finalBalance: balance,
    netPnL: balance - config.capital,
    returnPct: (balance / config.capital - 1) * 100,
    trades: trades.length,
    winRate: trades.length
      ? wins.length / trades.length * 100
      : 0,
    profitFactor: grossLoss
      ? grossProfit / grossLoss
      : null,
    maxDrawdownPct: maxDrawdown * 100,
    openPosition: position,
    tradeHistory: trades
  };
}

module.exports = { backtest };
