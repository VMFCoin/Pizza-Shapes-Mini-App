const { ethers } = require("hardhat");
require("dotenv").config();

const CONTRACTS = [
  { label: "OLD Settlement", address: "0xe841A3c453C75D58533c498F1a43e34283de19B9" },
  { label: "CURRENT Settlement", address: "0xb3E75c6957a0d0131f1F3586937e179590bBF852" },
];

const PIZZA_TOKEN = "0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07";
const BASESCAN_KEY = process.env.BASESCAN_API_KEY;

async function fetchTokenTransfers(contractAddr) {
  const params = new URLSearchParams({
    chainid: "8453",
    module: "account",
    action: "tokentx",
    address: contractAddr,
    contractaddress: PIZZA_TOKEN,
    startblock: "0",
    endblock: "99999999",
    sort: "asc",
    apikey: BASESCAN_KEY,
  });
  const url = `https://api.etherscan.io/v2/api?${params.toString()}`;
  const resp = await fetch(url);
  const json = await resp.json();
  if (json.status === "0") return [];
  return Array.isArray(json.result) ? json.result : [];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const token = new ethers.Contract(PIZZA_TOKEN, [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ], ethers.provider);
  const decimals = Number(await token.decimals());

  const globalDeposits = {};

  for (const contract of CONTRACTS) {
    const currentBalance = await token.balanceOf(contract.address);
    console.log("\n" + "=".repeat(70));
    console.log(`  ${contract.label}: ${contract.address}`);
    console.log(`  Current balance: ${ethers.formatUnits(currentBalance, decimals)} PIZZA`);
    console.log("=".repeat(70));

    const txs = await fetchTokenTransfers(contract.address);
    if (txs.length === 0) { console.log("  No transfers found."); continue; }

    // Only count enterMatch deposits (not emergencyWithdraw transfers)
    const deposits = txs.filter(t =>
      t.to.toLowerCase() === contract.address.toLowerCase() &&
      t.functionName && t.functionName.includes("enterMatch")
    );

    console.log(`\n  PLAYER DEPOSITS (enterMatch calls): ${deposits.length}`);
    for (const t of deposits) {
      const from = ethers.getAddress(t.from);
      const amount = BigInt(t.value);
      const date = new Date(parseInt(t.timeStamp) * 1000).toISOString().replace("T", " ").slice(0, 16);

      if (!globalDeposits[from]) globalDeposits[from] = 0n;
      globalDeposits[from] += amount;

      console.log(`    ${date}  ${from}  +${ethers.formatUnits(amount, decimals)} PIZZA`);
    }

    await sleep(1000);
  }

  console.log("\n" + "=".repeat(70));
  console.log("  TOTAL OWED PER TESTER (all contracts combined)");
  console.log("=".repeat(70));

  for (const [addr, total] of Object.entries(globalDeposits)) {
    console.log(`\n  ${addr}`);
    console.log(`    Total deposited: ${ethers.formatUnits(total, decimals)} PIZZA`);
  }

  const grandTotal = Object.values(globalDeposits).reduce((a, b) => a + b, 0n);
  console.log(`\n  GRAND TOTAL: ${ethers.formatUnits(grandTotal, decimals)} PIZZA`);
  console.log("=".repeat(70));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
