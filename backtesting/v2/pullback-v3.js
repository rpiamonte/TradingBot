const { EMA, RSI } = require('technicalindicators');

class PullbackV3 {
  constructor() {
    this.ema21 = new EMA({ period: 21, values: [] });
    this.rsi14 = new RSI({ period: 14, values: [] });
    this.history = [];
    this.count = 0;
    this.lastSignalIndex = -Infinity;
  }

  next(candle, trend = 'NEUTRAL') {
    if (!candle.confirmed) {
      throw new Error('Unconfirmed candle');
    }

    const close = Number(candle.close);
    const ema21 = this.ema21.nextValue(close);
    const rsi14 = this.rsi14.nextValue(close);

    const current = {
      timestamp: candle.timestamp,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close,
      ema21,
      rsi14
    };

    this.history.push(current);
    if (this.history.length > 4) this.history.shift();
    this.count++;

    let signal = 'WAIT';

    if (
      this.history.length === 4 &&
      Number.isFinite(ema21) &&
      Number.isFinite(rsi14)
    ) {
      const previous = this.history.slice(0, 3);

      const longPullback = previous.some(
        c => Number.isFinite(c.ema21) &&
             c.low <= c.ema21
      );

      const shortPullback = previous.some(
        c => Number.isFinite(c.ema21) &&
             c.high >= c.ema21
      );

      const bullishConfirmation =
        current.close > current.open &&
        current.close > ema21 &&
        previous[2].close <= previous[2].ema21;

      const bearishConfirmation =
        current.close < current.open &&
        current.close < ema21 &&
        previous[2].close >= previous[2].ema21;

      const spaced =
        this.count - this.lastSignalIndex >= 4;

      if (
        spaced &&
        trend === 'BULLISH' &&
        longPullback &&
        bullishConfirmation &&
        rsi14 >= 50 &&
        rsi14 <= 65
      ) {
        signal = 'LONG';
      } else if (
        spaced &&
        trend === 'BEARISH' &&
        shortPullback &&
        bearishConfirmation &&
        rsi14 >= 35 &&
        rsi14 <= 50
      ) {
        signal = 'SHORT';
      }

      if (signal !== 'WAIT') {
        this.lastSignalIndex = this.count;
      }
    }

    return {
      timestamp: candle.timestamp,
      signal,
      ema21: Number.isFinite(ema21) ? ema21 : null,
      rsi14: Number.isFinite(rsi14) ? rsi14 : null
    };
  }
}

module.exports = { PullbackV3 };
