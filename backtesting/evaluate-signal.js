function evaluateSignal(current, previous) {
  if (!current || !previous) return "WAIT";

  const bullishTrend =
    current.ema9 > current.ema21 &&
    current.price > current.ema200;

  const bearishTrend =
    current.ema9 < current.ema21 &&
    current.price < current.ema200;

  const bullishCross =
    previous.stochRSI.k <= previous.stochRSI.d &&
    current.stochRSI.k > current.stochRSI.d &&
    current.stochRSI.k < 30;

  const bearishCross =
    previous.stochRSI.k >= previous.stochRSI.d &&
    current.stochRSI.k < current.stochRSI.d &&
    current.stochRSI.k > 70;

  if (
    bullishTrend &&
    current.macd.histogram > 0 &&
    bullishCross
  ) {
    return "LONG";
  }

  if (
    bearishTrend &&
    current.macd.histogram < 0 &&
    bearishCross
  ) {
    return "SHORT";
  }

  return "WAIT";
}

module.exports = { evaluateSignal };
