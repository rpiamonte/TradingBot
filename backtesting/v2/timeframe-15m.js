class Timeframe15m {
  constructor() {
    this.bucket = null;
    this.current = null;
    this.count = 0;
  }

  next(candle) {
    if (!candle.confirmed) {
      throw new Error('Unconfirmed 1m candle');
    }

    const timestamp = Number(candle.timestamp);

    if (!Number.isFinite(timestamp)) {
      throw new Error('Invalid timestamp');
    }

    const bucket = Math.floor(timestamp / 900000);

    if (this.bucket === null || bucket !== this.bucket) {
      if (this.current && this.count !== 15) {
        throw new Error(
          'Incomplete 15m bucket: ' + this.count
        );
      }

      this.bucket = bucket;
      this.count = 0;
      this.current = {
        timestamp: bucket * 900000,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: 0,
        confirmed: false
      };
    }

    if (this.count >= 15) {
      throw new Error('More than 15 candles in bucket');
    }

    this.current.high = Math.max(
      this.current.high, candle.high
    );

    this.current.low = Math.min(
      this.current.low, candle.low
    );

    this.current.close = candle.close;
    this.current.volume += Number(candle.volume || 0);
    this.count++;

    if (this.count === 15) {
      const completed = {
        ...this.current,
        confirmed: true
      };

      this.current = null;
      this.count = 0;
      this.bucket = null;

      return completed;
    }

    return null;
  }
}

module.exports = { Timeframe15m };
