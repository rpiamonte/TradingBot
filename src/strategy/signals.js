const { getCandles } = require("../data/okx-market");
const { calculateIndicators } = require("./indicators");

async function generateSignal() {
  const candles = await getCandles("1m", 300);
  const closed = candles.filter(c => c.confirmed);

  if (closed.length < 251) {
    throw new Error("Insufficient confirmed candles");
  }

  const current = calculateIndicators(closed);
  const previous = calculateIndicators(closed.slice(0, -1));

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

  let signal = "WAIT";

  if (
    bullishTrend &&
    current.macd.histogram > 0 &&
    bullishCross
  ) {
    signal = "LONG";
  } else if (
    bearishTrend &&
    current.macd.histogram < 0 &&
    bearishCross
  ) {
    signal = "SHORT";
  }

  return {
    timestamp: new Date(
      closed[closed.length - 1].timestamp
    ).toISOString(),
    signal,
    price: current.price,
    indicators: current
  };
}

module.exports = { generateSignal };
