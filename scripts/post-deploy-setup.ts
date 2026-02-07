import { ethers } from "hardhat";

// New contract addresses from deployment
const SETTLEMENT = "0xb3E75c6957a0d0131f1F3586937e179590bBF852";
const FREE_ROLL_VAULT = "0x3fD5b27466D5d03519c558fFF54fa0040eC76fD2";
const STATS = "0xe0E8f0c39b35f7169fC3b35f81efB9203e82636F";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Running post-deploy setup as ${deployer.address}`);

  // 1. Set settlement contract on FreeRollVault
  console.log("\n[1/2] Setting settlement on FreeRollVault...");
  const freeRollVault = await ethers.getContractAt("FreeRollVault", FREE_ROLL_VAULT);
  const tx1 = await freeRollVault.setSettlementContract(SETTLEMENT);
  await tx1.wait();
  console.log("   FreeRollVault settlement reference updated");

  // 2. Grant OPERATOR_ROLE to settlement contract on Stats
  console.log("\n[2/2] Granting OPERATOR_ROLE on Stats...");
  const stats = await ethers.getContractAt("PizzaDotsStats", STATS);
  const OPERATOR_ROLE = await stats.OPERATOR_ROLE();
  const tx2 = await stats.grantRole(OPERATOR_ROLE, SETTLEMENT);
  await tx2.wait();
  console.log("   Stats OPERATOR_ROLE granted to Settlement");

  console.log("\nPost-deploy setup complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
