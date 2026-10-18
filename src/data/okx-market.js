const axios = require("axios");

const BASE_URL = "https://www.okx.com";
const INSTRUMENT = "BTC-USDT-SWAP";

async function getCandles(bar = "1m", limit = 100) {
  const response = await axios.get(
    `${BASE_URL}/api/v5/market/candles`,
    {
      params: {
        instId: INSTRUMENT,
        bar,
        limit
      },
      timeout: 10000
    }
  );

  if (response.data.code !== "0") {
    throw new Error(
      `OKX API error: ${response.data.msg}`
    );
  }

  return response.data.data
    .map(candle => ({
      timestamp: Number(candle[0]),
      open: Number(candle[1]),
      high: Number(candle[2]),
      low: Number(candle[3]),
      close: Number(candle[4]),
      volume: Number(candle[5]),
      confirmed: candle[8] === "1"
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function main() {
  try {
    console.log("Connecting to OKX...");

    const candles = await getCandles("1m", 300);
    const confirmed = candles.filter(c => c.confirmed);

    console.log(`Instrument: ${INSTRUMENT}`);
    console.log(`Candles received: ${candles.length}`);
    console.log(`Confirmed candles: ${confirmed.length}`);

    console.table(
      confirmed.slice(-5).map(c => ({
        time: new Date(c.timestamp).toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
      }))
    );

  } catch (error) {
    console.error(
      "Failed to fetch OKX candles:",
      error.message
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { getCandles };
