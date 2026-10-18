const axios = require("axios");
const fs = require("fs");
const path = require("path");

const URL = "https://www.okx.com/api/v5/market/history-candles";
const INST_ID = "BTC-USDT-SWAP";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function downloadHistory(target = 2000) {
  const candles = new Map();
  let after;
  let attempts = 0;

  while (candles.size < target && attempts < 50) {
    attempts++;

    const params = {
      instId: INST_ID,
      bar: "1m",
      limit: "100"
    };

    if (after) params.after = after;

    let response;

    try {
      response = await axios.get(URL, {
        params,
        timeout: 15000
      });
    } catch (error) {
      console.error("Request failed:", error.message);
      throw error;
    }

    if (response.data.code !== "0") {
      throw new Error(response.data.msg);
    }

    const batch = response.data.data;

    if (!batch || batch.length === 0) break;

    for (const c of batch) {
      if (c[8] !== "1") continue;

      candles.set(c[0], {
        timestamp: Number(c[0]),
        open: Number(c[1]),
        high: Number(c[2]),
        low: Number(c[3]),
        close: Number(c[4]),
        volume: Number(c[5])
      });
    }

    const oldest = Math.min(...batch.map(c => Number(c[0])));

    if (after && oldest >= Number(after)) {
      console.log("No older candles available.");
      break;
    }

    after = String(oldest);

    console.log(`Downloaded ${candles.size} candles`);

    await sleep(300);
  }

  const result = [...candles.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-target);

  const file = path.join(
    __dirname,
    "../../data/btc-1m-history.json"
  );

  fs.writeFileSync(file, JSON.stringify(result, null, 2));

  console.log(`Saved ${result.length} candles to ${file}`);

  return result;
}

if (require.main === module) {
  downloadHistory(2000).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { downloadHistory };
