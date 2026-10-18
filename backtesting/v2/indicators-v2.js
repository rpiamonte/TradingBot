const {
  EMA,
  MACD,
  StochasticRSI,
  ATR
} = require('technicalindicators');

function createIndicatorStream() {
  const ema9 = new EMA({
    period: 9,
    values: []
  });

  const ema21 = new EMA({
    period: 21,
    values: []
  });

  const ema200 = new EMA({
    period: 200,
    values: []
  });

  const macd = new MACD({
    values: [],
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  const stoch = new StochasticRSI({
    values: [],
    rsiPeriod: 14,
    stochasticPeriod: 14,
    kPeriod: 3,
    dPeriod: 3
  });

  const atr = new ATR({
    high: [],
    low: [],
    close: [],
    period: 14
  });

  function next(candle) {
    const price = Number(candle.close);

    return {
      price,
      ema9: ema9.nextValue(price),
      ema21: ema21.nextValue(price),
      ema200: ema200.nextValue(price),
      macd: macd.nextValue(price),
      stochRSI: stoch.nextValue(price),
      atr: atr.nextValue({
        high: Number(candle.high),
        low: Number(candle.low),
        close: price
      })
    };
  }

  return { next };
}

module.exports = { createIndicatorStream };
