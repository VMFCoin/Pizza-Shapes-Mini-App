const { ethers, upgrades } = require("hardhat");

/**
 * Upgrade PizzaShapesSettlement V4 → V5
 *
 * V5 adds `settleTiedMatch()` — splits the 77% winner portion equally
 * among co-winners when a match ends in a tie.
 *
 * Usage:
 *   npx hardhat run scripts/upgrade-v5.js --network base
 *
 * Requires:
 *   - NEXT_PUBLIC_SETTLEMENT_CONTRACT set in .env (proxy address)
 *   - Deployer wallet must have UPGRADER_ROLE on the proxy
 */

async function main() {
  const SETTLEMENT_PROXY = process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT;
  if (!SETTLEMENT_PROXY) {
    throw new Error("NEXT_PUBLIC_SETTLEMENT_CONTRACT not set in environment");
  }

  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("Settlement V4 → V5 Upgrade (Tied Match Settlement)");
  console.log("=".repeat(60));
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Proxy:    ${SETTLEMENT_PROXY}`);
  console.log("=".repeat(60));

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer ETH Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.0003")) {
    throw new Error("Insufficient ETH for upgrade. Need at least 0.0003 ETH for gas on Base.");
  }

  // Deploy new implementation and upgrade proxy
  console.log("\nDeploying PizzaShapesSettlementV5 implementation...");

  const SettlementV5Factory = await ethers.getContractFactory("PizzaShapesSettlementV5");
  // V5 adds only a new function + helper — no new storage, so no initializer needed
  const upgraded = await upgrades.upgradeProxy(SETTLEMENT_PROXY, SettlementV5Factory, {
    unsafeAllow: ['missing-initializer'],
  });
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(SETTLEMENT_PROXY);

  console.log("\n" + "=".repeat(60));
  console.log("UPGRADE COMPLETE!");
  console.log("=".repeat(60));
  console.log(`Proxy (unchanged): ${SETTLEMENT_PROXY}`);
  console.log(`New implementation: ${implAddress}`);
  console.log("\nNew function available:");
  console.log("  settleTiedMatch(bytes32 matchId, address[] winners, address[] players, uint256[] slices)");
  console.log("\nTied match distribution (77% winner portion):");
  console.log("  Split equally among all co-winners");
  console.log("=".repeat(60));

  // Verify instructions
  console.log("\nNext Steps:");
  console.log(`1. Verify implementation on BaseScan:`);
  console.log(`   npx hardhat verify --network base ${implAddress}`);
  console.log("2. Update settle-match edge function to route tied matches");
  console.log("3. No .env changes needed — proxy address is unchanged");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
