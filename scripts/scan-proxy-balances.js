const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const TOKEN_ADDRESS =
  (process.env.TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_PIZZA_TOKEN ||
    "0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07");

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const PROBE_ABI = [
  // Settlement-like
  "function weeklyVault() view returns (address)",
  "function freeRollVault() view returns (address)",
  "function statsContract() view returns (address)",

  // Vault-like
  "function settlementContract() view returns (address)",
  "function weeklyVault() view returns (address)",

  // Common (settlement + vaults)
  "function pizza() view returns (address)",
];

async function tryCall(fn) {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

async function classify(addr) {
  const c = new ethers.Contract(addr, PROBE_ABI, ethers.provider);

  // Vaults expose settlementContract()
  const settlementContract = await tryCall(() => c.settlementContract());
  if (settlementContract && settlementContract !== ethers.ZeroAddress) {
    const weeklyVault = await tryCall(() => c.weeklyVault());
    if (weeklyVault && weeklyVault !== ethers.ZeroAddress) {
      return {
        kind: "freeRollVault",
        details: `settlement=${settlementContract} weeklyVault=${weeklyVault}`,
      };
    }
    return { kind: "weeklyVault", details: `settlement=${settlementContract}` };
  }

  // Settlement exposes weeklyVault() + freeRollVault()
  const weeklyVault = await tryCall(() => c.weeklyVault());
  const freeRollVault = await tryCall(() => c.freeRollVault());
  const statsContract = await tryCall(() => c.statsContract());
  if (weeklyVault && freeRollVault) {
    return {
      kind: "settlement",
      details: `weeklyVault=${weeklyVault} freeRollVault=${freeRollVault} stats=${statsContract || "?"}`,
    };
  }

  // Stats likely doesn't expose pizza(); unknown contracts might also not.
  const pizza = await tryCall(() => c.pizza());
  if (!pizza) return { kind: "stats" };

  return { kind: "unknown" };
}

async function main() {
  const manifestPath = path.join(process.cwd(), ".openzeppelin", "base.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  const tokenCode = await ethers.provider.getCode(TOKEN_ADDRESS);
  if (!tokenCode || tokenCode === "0x") {
    console.log(`Token contract not found at ${TOKEN_ADDRESS} on this network.`);
    console.log("If you're scanning a testnet, set TOKEN_ADDRESS to the correct testnet token address.");
    return;
  }

  const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, ethers.provider);
  let decimals = 18;
  try {
    decimals = await token.decimals();
  } catch {
    // Best-effort fallback (some tokens/proxies won't expose decimals cleanly)
    decimals = 18;
  }

  const proxies = (manifest.proxies || []).map((p) => p.address);
  if (proxies.length === 0) {
    console.log("No proxies found in .openzeppelin/base.json");
    return;
  }

  console.log("=".repeat(80));
  console.log("Scanning OpenZeppelin proxies for $PIZZA balances (Base)");
  console.log(`Token: ${TOKEN_ADDRESS} (decimals=${decimals})`);
  console.log("=".repeat(80));

  for (const addr of proxies) {
    const bal = await token.balanceOf(addr);
    const { kind, details } = await classify(addr);
    const balFmt = ethers.formatUnits(bal, decimals);
    const nonZero = bal > 0n ? " <-- non-zero" : "";
    console.log(
      `${addr}  kind=${kind}  pizzaBalance=${balFmt}${nonZero}${details ? `  (${details})` : ""}`,
    );
  }

  console.log("=".repeat(80));
  console.log(
    "Tip: the old settlement holding tester funds will usually show kind=settlement and a non-zero balance.",
  );
  console.log("=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

