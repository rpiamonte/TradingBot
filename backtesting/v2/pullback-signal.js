const { EMA, RSI } = require('technicalindicators');

class PullbackSignal {
  constructor() {
    this.ema21 = new EMA({
      period: 21,
      values: []
    });

    this.rsi14 = new RSI({
      period: 14,
      values: []
    });

    this.lastTimestamp = null;
    this.count = 0;
  }

  next(candle, trend) {
    if (!candle || candle.confirmed !== true) {
      throw new Error('Expected confirmed 1m candle');
    }

    const timestamp = Number(candle.timestamp);
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);

    if (![timestamp, open, high, low, close]
        .every(Number.isFinite)) {
      throw new Error('Invalid candle values');
    }

    if (this.lastTimestamp !== null &&
        timestamp !== this.lastTimestamp + 60000) {
      throw new Error('Non-consecutive 1m candle');
    }

    this.lastTimestamp = timestamp;
    this.count++;

    const ema21 = this.ema21.nextValue(close);
    const rsi14 = this.rsi14.nextValue(close);

    let signal = 'WAIT';

    if (Number.isFinite(ema21) &&
        Number.isFinite(rsi14)) {

      const bullishPullback =
        low <= ema21 &&
        close > ema21 &&
        close > open &&
        rsi14 >= 45 &&
        rsi14 <= 70;

      const bearishPullback =
        high >= ema21 &&
        close < ema21 &&
        close < open &&
        rsi14 >= 30 &&
        rsi14 <= 55;

      if (trend === 'BULLISH' && bullishPullback) {
        signal = 'LONG';
      }

      if (trend === 'BEARISH' && bearishPullback) {
        signal = 'SHORT';
      }
    }

    return {
      timestamp,
      signal,
      ema21: ema21 ?? null,
      rsi14: rsi14 ?? null
    };
  }
}

module.exports = { PullbackSignal };
