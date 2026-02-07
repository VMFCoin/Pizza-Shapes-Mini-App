import { ethers, upgrades } from "hardhat";

// Configuration
const PIZZA_TOKEN = "0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07";
const OWNER_ADDRESS = "0xd9EF10D1dB272A5105557AAfc571e7BF66c95CEC";

// 9 Veteran Charity Wallets
const CHARITY_WALLETS: [string, string, string, string, string, string, string, string, string] = [
  "0x6456879a5073038b0E57ea8E498Cb0240e949fC3", // Patriots Promise
  "0x700B53ff9a58Ee257F9A2EFda3a373D391028007", // Victory For Veterans
  "0xB697C8b4bCaE454d9dee1E83f73327D7a63600a1", // Holy Family Village
  "0x5951A4160F73b8798D68e7177dF8af6a7902e725", // Camp Cowboy
  "0xfB0EF51792c36Ae1fE6636603be199788819b67D", // Veterans In Need Project
  "0x10F01632DC709F7fA413A140739D8843b06235A1", // Honor HER Foundation
  "0x0730d4dc43cf10A3Cd986FEE17f30cB0E75410e0", // Magicians On Mission
  "0x043820c97771c570d830bb0e189778fdef5e6eeb", // April Forces
  "0x097701F99CC7b0Ff816C2355faC104ADdC6e27B9", // Little Patriots Embraced
];

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("Pizza Shapes Contract Deployment (V3 - Fresh Deploy)");
  console.log("=".repeat(60));
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Owner: ${OWNER_ADDRESS}`);
  console.log(`Network: Base Mainnet`);
  console.log(`$PIZZA Token: ${PIZZA_TOKEN}`);
  console.log("=".repeat(60));

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer ETH Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.0005")) {
    throw new Error("Insufficient ETH for deployment. Need at least 0.0005 ETH for gas on Base.");
  }

  // ========================================
  // 1. Deploy PizzaDotsStats (Stats Contract)
  // ========================================
  console.log("\n[1/4] Deploying PizzaDotsStats...");

  const StatsFactory = await ethers.getContractFactory("PizzaDotsStats");
  const statsProxy = await upgrades.deployProxy(
    StatsFactory,
    [OWNER_ADDRESS], // initialize(admin)
    {
      kind: "uups",
      initializer: "initialize",
    }
  );
  await statsProxy.waitForDeployment();
  const statsAddress = await statsProxy.getAddress();
  console.log(`   Stats Contract (Proxy): ${statsAddress}`);

  // ========================================
  // 2. Deploy WeeklyVault
  // ========================================
  console.log("\n[2/4] Deploying WeeklyVault...");

  const WeeklyVaultFactory = await ethers.getContractFactory("WeeklyVault");
  const weeklyVaultProxy = await upgrades.deployProxy(
    WeeklyVaultFactory,
    [
      PIZZA_TOKEN,
      ethers.ZeroAddress, // settlementContract - will update later
      OWNER_ADDRESS,
    ],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );
  await weeklyVaultProxy.waitForDeployment();
  const weeklyVaultAddress = await weeklyVaultProxy.getAddress();
  console.log(`   WeeklyVault (Proxy): ${weeklyVaultAddress}`);

  // ========================================
  // 3. Deploy FreeRollVault
  // ========================================
  console.log("\n[3/4] Deploying FreeRollVault...");

  const FreeRollVaultFactory = await ethers.getContractFactory("FreeRollVault");
  const freeRollVaultProxy = await upgrades.deployProxy(
    FreeRollVaultFactory,
    [
      PIZZA_TOKEN,
      ethers.ZeroAddress, // settlementContract - will update later
      weeklyVaultAddress, // overflow goes to weekly vault
      OWNER_ADDRESS,
    ],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );
  await freeRollVaultProxy.waitForDeployment();
  const freeRollVaultAddress = await freeRollVaultProxy.getAddress();
  console.log(`   FreeRollVault (Proxy): ${freeRollVaultAddress}`);

  // ========================================
  // 4. Deploy PizzaShapesSettlementV3 (dynamic amounts)
  // ========================================
  console.log("\n[4/4] Deploying PizzaShapesSettlementV3...");

  const SettlementFactory = await ethers.getContractFactory("PizzaShapesSettlementV3");
  const settlementProxy = await upgrades.deployProxy(
    SettlementFactory,
    [
      PIZZA_TOKEN,
      statsAddress,
      weeklyVaultAddress,
      freeRollVaultAddress,
      CHARITY_WALLETS,
      OWNER_ADDRESS,
    ],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );
  await settlementProxy.waitForDeployment();
  const settlementAddress = await settlementProxy.getAddress();
  console.log(`   Settlement Contract (Proxy): ${settlementAddress}`);

  // ========================================
  // 5. Update Vault References & Grant Roles
  // ========================================
  console.log("\n[5/5] Updating vault settlement references...");

  // Update WeeklyVault with settlement address
  const weeklyVault = await ethers.getContractAt("WeeklyVault", weeklyVaultAddress);
  const tx1 = await weeklyVault.setSettlementContract(settlementAddress);
  await tx1.wait();
  console.log("   WeeklyVault settlement reference updated");

  // Update FreeRollVault with settlement address
  const freeRollVault = await ethers.getContractAt("FreeRollVault", freeRollVaultAddress);
  const tx2 = await freeRollVault.setSettlementContract(settlementAddress);
  await tx2.wait();
  console.log("   FreeRollVault settlement reference updated");

  // Grant OPERATOR_ROLE to settlement contract on stats
  const stats = await ethers.getContractAt("PizzaDotsStats", statsAddress);
  const OPERATOR_ROLE = await stats.OPERATOR_ROLE();
  const tx3 = await stats.grantRole(OPERATOR_ROLE, settlementAddress);
  await tx3.wait();
  console.log("   Stats OPERATOR_ROLE granted to Settlement");

  // ========================================
  // Summary
  // ========================================
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\nContract Addresses (add to .env):");
  console.log(`NEXT_PUBLIC_STATS_CONTRACT=${statsAddress}`);
  console.log(`NEXT_PUBLIC_WEEKLY_VAULT_CONTRACT=${weeklyVaultAddress}`);
  console.log(`NEXT_PUBLIC_FREE_ROLL_CONTRACT=${freeRollVaultAddress}`);
  console.log(`NEXT_PUBLIC_SETTLEMENT_CONTRACT=${settlementAddress}`);
  console.log("\nFor Supabase Edge Functions:");
  console.log(`STATS_CONTRACT_ADDRESS=${statsAddress}`);
  console.log(`WEEKLY_VAULT_CONTRACT_ADDRESS=${weeklyVaultAddress}`);
  console.log(`FREE_ROLL_CONTRACT_ADDRESS=${freeRollVaultAddress}`);
  console.log(`SETTLEMENT_CONTRACT_ADDRESS=${settlementAddress}`);
  console.log("\n" + "=".repeat(60));
  console.log("Owner Address: " + OWNER_ADDRESS);
  console.log("All contracts are UUPS upgradeable");
  console.log("Owner has: DEFAULT_ADMIN_ROLE, UPGRADER_ROLE, OPERATOR_ROLE, PAUSER_ROLE");
  console.log("Settlement V3: enterMatch(bytes32 matchId, uint256 amount)");
  console.log("=".repeat(60));

  // Verify instructions
  console.log("\nNext Steps:");
  console.log("1. Verify contracts on BaseScan:");
  console.log(`   npx hardhat verify --network base ${statsAddress}`);
  console.log(`   npx hardhat verify --network base ${weeklyVaultAddress}`);
  console.log(`   npx hardhat verify --network base ${freeRollVaultAddress}`);
  console.log(`   npx hardhat verify --network base ${settlementAddress}`);
  console.log("\n2. Update .env file with new contract addresses");
  console.log("3. Update Vercel env vars with new contract addresses");
  console.log("4. Grant OPERATOR_ROLE to your backend wallet for settlements");
  console.log("5. Approve vaults to allow settlement contract to transfer tokens");
}

// Upgrade existing Settlement proxy from V2 → V3 (if needed)
async function upgradeSettlementV3() {
  const SETTLEMENT_PROXY = process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT;
  if (!SETTLEMENT_PROXY) {
    throw new Error("NEXT_PUBLIC_SETTLEMENT_CONTRACT not set in environment");
  }

  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("Settlement V2 → V3 Upgrade");
  console.log("=".repeat(60));
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Proxy: ${SETTLEMENT_PROXY}`);
  console.log("=".repeat(60));

  const SettlementV3Factory = await ethers.getContractFactory("PizzaShapesSettlementV3");
  const upgraded = await upgrades.upgradeProxy(SETTLEMENT_PROXY, SettlementV3Factory);
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(SETTLEMENT_PROXY);
  console.log(`\nUpgrade complete!`);
  console.log(`Proxy (unchanged): ${SETTLEMENT_PROXY}`);
  console.log(`New implementation: ${implAddress}`);
  console.log("\nenterMatch now accepts (bytes32 matchId, uint256 amount)");
  console.log("=".repeat(60));
}

// Run fresh full deployment with V3 settlement:
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// To upgrade an existing deployment instead, comment out main() above and uncomment:
// upgradeSettlementV3()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
