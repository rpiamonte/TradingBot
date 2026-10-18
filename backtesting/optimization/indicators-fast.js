const {
  EMA,
  MACD,
  StochasticRSI,
  ATR
} = require("technicalindicators");

function calculateIndicators(candles) {
  const closed = candles.filter(c => c.confirmed);

  if (closed.length < 250) {
    throw new Error("Need at least 250 closed candles");
  }

  const closes = closed.map(c => c.close);
  const highs = closed.map(c => c.high);
  const lows = closed.map(c => c.low);

  const last = arr => arr[arr.length - 1];

  const ema9 = EMA.calculate({
    period: 9,
    values: closes
  });

  const ema21 = EMA.calculate({
    period: 21,
    values: closes
  });

  const ema200 = EMA.calculate({
    period: 200,
    values: closes
  });

  const macd = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  const stoch = StochasticRSI.calculate({
    values: closes,
    rsiPeriod: 14,
    stochasticPeriod: 14,
    kPeriod: 3,
    dPeriod: 3
  });

  const atr = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14
  });

  return {
    price: last(closes),
    ema9: last(ema9),
    ema21: last(ema21),
    ema200: last(ema200),
    macd: last(macd),
    stochRSI: last(stoch),
    atr: last(atr)
  };
}

module.exports = { calculateIndicators };
