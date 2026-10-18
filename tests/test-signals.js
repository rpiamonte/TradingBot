const { generateSignal } =
  require("../src/strategy/signals");

async function main() {
  const result = await generateSignal();

  console.log("\nBTC SCALPING SIGNAL");
  console.log("---------------------");
  console.log("Time:", result.timestamp);
  console.log("Signal:", result.signal);
  console.log("Price:", result.price);
  console.log(
    "Indicators:",
    JSON.stringify(result.indicators, null, 2)
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
