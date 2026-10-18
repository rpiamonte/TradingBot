const { EMA } = require('technicalindicators');

class Trend15m {
  constructor() {
    this.ema50 = new EMA({ period: 50, values: [] });
    this.ema200 = new EMA({ period: 200, values: [] });
    this.lastTimestamp = null;
    this.state = null;
  }

  next(candle) {
    if (!candle || candle.confirmed !== true) {
      throw new Error('Expected confirmed 15m candle');
    }

    const timestamp = Number(candle.timestamp);
    const close = Number(candle.close);

    if (!Number.isFinite(timestamp) ||
        !Number.isFinite(close) ||
        close <= 0) {
      throw new Error('Invalid 15m candle');
    }

    if (this.lastTimestamp !== null &&
        timestamp !== this.lastTimestamp + 900000) {
      throw new Error('Non-consecutive 15m candle');
    }

    const ema50 = this.ema50.nextValue(close);
    const ema200 = this.ema200.nextValue(close);

    let trend = 'NEUTRAL';

    if (Number.isFinite(ema50) &&
        Number.isFinite(ema200)) {
      if (ema50 > ema200) trend = 'BULLISH';
      else if (ema50 < ema200) trend = 'BEARISH';
    }

    this.lastTimestamp = timestamp;

    this.state = {
      timestamp,
      close,
      ema50: ema50 ?? null,
      ema200: ema200 ?? null,
      trend
    };

    return this.state;
  }

  getCurrent() {
    return this.state;
  }
}

module.exports = { Trend15m };
