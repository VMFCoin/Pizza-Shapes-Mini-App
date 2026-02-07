import { ethers } from "hardhat";

const SETTLEMENT = "0xb3E75c6957a0d0131f1F3586937e179590bBF852";
const STATS = "0xe0E8f0c39b35f7169fC3b35f81efB9203e82636F";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Granting OPERATOR_ROLE as ${deployer.address}`);

  const stats = await ethers.getContractAt("PizzaDotsStats", STATS);
  const OPERATOR_ROLE = await stats.OPERATOR_ROLE();
  const tx = await stats.grantRole(OPERATOR_ROLE, SETTLEMENT);
  await tx.wait();
  console.log("Stats OPERATOR_ROLE granted to Settlement");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
