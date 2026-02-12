const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Easy refund script — drains the settlement contract and splits 50/50
 * back to both tester wallets.
 *
 * Automatically uses NEXT_PUBLIC_SETTLEMENT_CONTRACT from .env so it
 * works after upgrades without passing any env vars.
 *
 * Usage:
 *   npm run refund              # dry run (shows balances, no transactions)
 *   npm run refund:confirm      # actually withdraw + refund
 *
 * Or manually:
 *   npx hardhat run scripts/refund-testers.js --network base
 *   CONFIRM=YES npx hardhat run scripts/refund-testers.js --network base
 */

const TESTERS = [
  "0x257Cbe89968495C3aE8C81BccB8BE7f257CD5f66",
  "0x9157Feb12812b253e84447C6B52C38651fd67FcA",
];

const TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_PIZZA_TOKEN ||
  "0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07";

const SETTLEMENT_ADDRESS =
  process.env.OLD_CONTRACT_ADDRESS ||
  process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT ||
  process.env.SETTLEMENT_CONTRACT_ADDRESS;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const EMERGENCY_ABI = [
  "function emergencyWithdraw(address token, uint256 amount)",
  "function emergencyWithdraw(uint256 amount)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!SETTLEMENT_ADDRESS) {
    throw new Error(
      "No settlement address found. Set NEXT_PUBLIC_SETTLEMENT_CONTRACT in .env or pass OLD_CONTRACT_ADDRESS=0x..."
    );
  }

  const confirm = (process.env.CONFIRM || "").trim().toUpperCase() === "YES";
  const [signer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();

  const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
  const settlement = new ethers.Contract(SETTLEMENT_ADDRESS, EMERGENCY_ABI, signer);

  let symbol = "PIZZA";
  let decimals = 18;
  try { symbol = await token.symbol(); } catch {}
  try { decimals = await token.decimals(); } catch {}

  const [signerEth, contractBalance] = await Promise.all([
    ethers.provider.getBalance(signer.address),
    token.balanceOf(SETTLEMENT_ADDRESS),
  ]);

  console.log("=".repeat(70));
  console.log("  PIZZA DOTS — Refund Testers");
  console.log("=".repeat(70));
  console.log(`  Network:     Base (chainId ${net.chainId})`);
  console.log(`  Signer:      ${signer.address}`);
  console.log(`  Signer ETH:  ${ethers.formatEther(signerEth)} ETH`);
  console.log(`  Contract:    ${SETTLEMENT_ADDRESS}`);
  console.log(`  Balance:     ${ethers.formatUnits(contractBalance, decimals)} ${symbol}`);
  console.log("=".repeat(70));

  if (contractBalance === 0n) {
    console.log("\n  Nothing to refund — contract has 0 PIZZA.\n");
    return;
  }

  // Role check
  try {
    const adminRole = await settlement.DEFAULT_ADMIN_ROLE();
    const hasAdmin = await settlement.hasRole(adminRole, signer.address);
    if (!hasAdmin) {
      console.log("\n  WARNING: Signer does NOT have admin role. Withdraw will fail.\n");
    }
  } catch {}

  const refundA = contractBalance / 2n;
  const refundB = contractBalance - refundA;

  console.log("\n  Planned refunds (50/50 split):");
  console.log(`    ${TESTERS[0]}  ←  ${ethers.formatUnits(refundA, decimals)} ${symbol}`);
  console.log(`    ${TESTERS[1]}  ←  ${ethers.formatUnits(refundB, decimals)} ${symbol}`);

  if (!confirm) {
    console.log("\n  DRY RUN — no transactions sent.");
    console.log("  To execute: npm run refund:confirm\n");
    return;
  }

  // Step 1: Emergency withdraw from contract
  console.log("\n  Step 1/3: Withdrawing from contract...");
  try {
    const tx = await settlement["emergencyWithdraw(address,uint256)"](TOKEN_ADDRESS, contractBalance);
    console.log(`    TX: ${tx.hash}`);
    await tx.wait();
    console.log("    Confirmed.");
  } catch {
    console.log("    Settlement-style failed, trying vault-style...");
    const tx = await settlement["emergencyWithdraw(uint256)"](contractBalance);
    console.log(`    TX: ${tx.hash}`);
    await tx.wait();
    console.log("    Confirmed.");
  }

  // Wait for nonce to sync
  await sleep(3000);

  // Step 2: Transfer to tester #1
  console.log(`\n  Step 2/3: Sending to tester #1...`);
  const tx1 = await token.transfer(TESTERS[0], refundA);
  console.log(`    TX: ${tx1.hash}`);
  await tx1.wait();
  console.log("    Confirmed.");

  // Wait for nonce to sync
  await sleep(3000);

  // Step 3: Transfer to tester #2
  console.log(`\n  Step 3/3: Sending to tester #2...`);
  const tx2 = await token.transfer(TESTERS[1], refundB);
  console.log(`    TX: ${tx2.hash}`);
  await tx2.wait();
  console.log("    Confirmed.");

  // Final balances
  const [cAfter, aAfter, bAfter] = await Promise.all([
    token.balanceOf(SETTLEMENT_ADDRESS),
    token.balanceOf(TESTERS[0]),
    token.balanceOf(TESTERS[1]),
  ]);

  console.log("\n" + "=".repeat(70));
  console.log("  Done! Final balances:");
  console.log(`    Contract:    ${ethers.formatUnits(cAfter, decimals)} ${symbol}`);
  console.log(`    Tester #1:   ${ethers.formatUnits(aAfter, decimals)} ${symbol}`);
  console.log(`    Tester #2:   ${ethers.formatUnits(bAfter, decimals)} ${symbol}`);
  console.log("=".repeat(70) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
