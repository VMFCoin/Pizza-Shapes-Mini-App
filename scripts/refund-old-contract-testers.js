const { ethers } = require("hardhat");

require("dotenv").config();

/**
 * Refund testers from an old settlement/vault contract that still holds $PIZZA.
 *
 * This script:
 * - reads the old contract's $PIZZA token balance
 * - withdraws it via `emergencyWithdraw(...)` (admin-only)
 * - sends 50/50 back to the two tester wallets
 *
 * Safety:
 * - set CONFIRM=YES to actually execute transfers
 *
 * Usage:
 *   OLD_CONTRACT_ADDRESS=0x... npx hardhat run scripts/refund-old-contract-testers.js --network base
 *   CONFIRM=YES OLD_CONTRACT_ADDRESS=0x... npx hardhat run scripts/refund-old-contract-testers.js --network base
 */

const TESTERS = [
  "0x257Cbe89968495C3aE8C81BccB8BE7f257CD5f66",
  "0x9157Feb12812b253e84447C6B52C38651fd67FcA",
];

const TOKEN_ADDRESS =
  (process.env.TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_PIZZA_TOKEN ||
    "0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07");

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const EMERGENCY_WITHDRAW_ABI = [
  // Settlement (V2/V3/V4)
  "function emergencyWithdraw(address token, uint256 amount)",
  // Vaults
  "function emergencyWithdraw(uint256 amount)",
  // AccessControl (best-effort)
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
];

async function main() {
  const oldContract = (process.env.OLD_CONTRACT_ADDRESS || "").trim();
  if (!oldContract) {
    throw new Error(
      "Missing OLD_CONTRACT_ADDRESS env var (the old contract that still holds tester funds).",
    );
  }

  const confirm = (process.env.CONFIRM || "").trim().toUpperCase() === "YES";
  const [signer] = await ethers.getSigners();

  const tokenCode = await ethers.provider.getCode(TOKEN_ADDRESS);
  if (!tokenCode || tokenCode === "0x") {
    throw new Error(
      `Token contract not found at ${TOKEN_ADDRESS} on this network. Set TOKEN_ADDRESS to the correct token.`,
    );
  }

  const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
  const old = new ethers.Contract(oldContract, EMERGENCY_WITHDRAW_ABI, signer);

  let symbol = "TOKEN";
  let decimals = 18;
  try {
    symbol = await token.symbol();
  } catch {
    symbol = "TOKEN";
  }
  try {
    decimals = await token.decimals();
  } catch {
    decimals = 18;
  }
  const [signerEth, oldPizzaBal, oldEthBal] = await Promise.all([
    ethers.provider.getBalance(signer.address),
    token.balanceOf(oldContract),
    ethers.provider.getBalance(oldContract),
  ]);

  console.log("=".repeat(80));
  console.log("Refund testers from old contract");
  console.log("=".repeat(80));
  const net = await ethers.provider.getNetwork();
  console.log(`Network chainId: ${net.chainId}`);
  console.log(`Signer:          ${signer.address}`);
  console.log(`Signer ETH:      ${ethers.formatEther(signerEth)} ETH`);
  console.log(`Token:           ${symbol} (${TOKEN_ADDRESS})`);
  console.log(`Old contract:    ${oldContract}`);
  console.log(`Old ${symbol}:   ${ethers.formatUnits(oldPizzaBal, decimals)}`);
  if (oldEthBal > 0n) {
    console.log(
      `Old ETH balance: ${ethers.formatEther(oldEthBal)} ETH (note: this script does NOT sweep native ETH)`,
    );
  }

  if (oldPizzaBal === 0n) {
    console.log("Nothing to refund: old contract has 0 token balance.");
    return;
  }

  // Best-effort role check (will throw if contract doesn't expose AccessControl view fns)
  try {
    const adminRole = await old.DEFAULT_ADMIN_ROLE();
    const hasAdmin = await old.hasRole(adminRole, signer.address);
    console.log(`Signer has DEFAULT_ADMIN_ROLE: ${hasAdmin}`);
    if (!hasAdmin) {
      console.log("WARNING: signer is not admin; emergencyWithdraw is expected to revert.");
    }
  } catch {
    console.log("Role check skipped (contract did not expose AccessControl view fns).");
  }

  const refundA = oldPizzaBal / 2n;
  const refundB = oldPizzaBal - refundA;

  console.log("-".repeat(80));
  console.log("Planned refunds (50/50 split of old contract balance):");
  console.log(`- ${TESTERS[0]}  <=  ${ethers.formatUnits(refundA, decimals)} ${symbol}`);
  console.log(`- ${TESTERS[1]}  <=  ${ethers.formatUnits(refundB, decimals)} ${symbol}`);
  console.log("-".repeat(80));

  if (!confirm) {
    console.log("Dry run only. Re-run with CONFIRM=YES to execute withdrawals + refunds.");
    return;
  }

  // 1) Withdraw all tokens from old contract to signer via emergencyWithdraw
  console.log("Withdrawing tokens from old contract...");
  try {
    const tx = await old["emergencyWithdraw(address,uint256)"](TOKEN_ADDRESS, oldPizzaBal);
    console.log(`- tx: ${tx.hash}`);
    await tx.wait();
  } catch (e) {
    console.log(
      "Settlement-style emergencyWithdraw(address,uint256) failed; trying vault-style emergencyWithdraw(uint256)...",
    );
    const tx = await old["emergencyWithdraw(uint256)"](oldPizzaBal);
    console.log(`- tx: ${tx.hash}`);
    await tx.wait();
  }

  // 2) Refund both testers
  console.log("Sending refunds...");
  const tx1 = await token.transfer(TESTERS[0], refundA);
  console.log(`- refund #1 tx: ${tx1.hash}`);
  await tx1.wait();

  const tx2 = await token.transfer(TESTERS[1], refundB);
  console.log(`- refund #2 tx: ${tx2.hash}`);
  await tx2.wait();

  const [oldAfter, aAfter, bAfter] = await Promise.all([
    token.balanceOf(oldContract),
    token.balanceOf(TESTERS[0]),
    token.balanceOf(TESTERS[1]),
  ]);

  console.log("Done.");
  console.log(`Old contract ${symbol} balance now: ${ethers.formatUnits(oldAfter, decimals)}`);
  console.log(`Tester #1 ${symbol} balance now:     ${ethers.formatUnits(aAfter, decimals)}`);
  console.log(`Tester #2 ${symbol} balance now:     ${ethers.formatUnits(bAfter, decimals)}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

