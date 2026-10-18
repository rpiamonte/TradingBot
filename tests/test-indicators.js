const { getCandles } = require("../src/data/okx-market");
const { calculateIndicators } = require("../src/strategy/indicators");

async function main() {
  const candles = await getCandles("1m", 300);
  const result = calculateIndicators(candles);

  console.log("\nBTC SCALPING INDICATORS");
  console.log("-------------------------");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
