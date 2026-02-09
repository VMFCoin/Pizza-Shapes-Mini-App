require("@nomicfoundation/hardhat-chai-matchers");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PizzaShapesSettlement — 2-8 Player Multiplayer", function () {
  // Shared fixture: deploys all contracts and sets up roles
  async function deployFixture() {
    const signers = await ethers.getSigners();
    // 0=admin, 1=operator, 2=weeklyVault, 3=freeRollVault, 4-11=players (8)
    const [admin, operator, weeklyVault, freeRollVault, ...playerSigners] = signers;
    const p1 = playerSigners[0], p2 = playerSigners[1], p3 = playerSigners[2],
      p4 = playerSigners[3], p5 = playerSigners[4], p6 = playerSigners[5],
      p7 = playerSigners[6], p8 = playerSigners[7];

    // Generate 9 charity addresses (don't need signers, just addresses)
    const charityAddrs: string[] = [];
    for (let i = 0; i < 9; i++) {
      charityAddrs.push(ethers.Wallet.createRandom().address);
    }

    // Deploy mock PIZZA token (ERC20)
    const MockToken = await ethers.getContractFactory("MockPizzaToken");
    const pizza = await MockToken.deploy("Pizza Token", "PIZZA", ethers.parseEther("1000000"));
    await pizza.waitForDeployment();

    // Deploy Stats contract (UUPS proxy)
    const Stats = await ethers.getContractFactory("PizzaDotsStats");
    const stats = await upgrades.deployProxy(Stats, [admin.address], {
      initializer: "initialize",
      kind: "uups",
    });
    await stats.waitForDeployment();

    // Deploy Settlement V4 (inherits V3) via UUPS proxy
    // We deploy V3 first, then upgrade to V4 — mimicking production
    const V3 = await ethers.getContractFactory("PizzaShapesSettlementV3");
    const settlement = await upgrades.deployProxy(
      V3,
      [
        await pizza.getAddress(),
        await stats.getAddress(),
        weeklyVault.address,
        freeRollVault.address,
        charityAddrs,
        admin.address,
      ],
      { initializer: "initialize", kind: "uups" }
    );
    await settlement.waitForDeployment();

    // Upgrade to V4
    const V4 = await ethers.getContractFactory("PizzaShapesSettlementV4");
    const settlementV4 = await upgrades.upgradeProxy(
      await settlement.getAddress(),
      V4,
      { unsafeAllow: ["missing-initializer"] }
    );

    // Grant OPERATOR_ROLE to operator on settlement + stats
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    await settlementV4.grantRole(OPERATOR_ROLE, operator.address);
    await stats.grantRole(OPERATOR_ROLE, await settlementV4.getAddress());

    // Distribute PIZZA to players
    const players = [p1, p2, p3, p4, p5, p6, p7, p8];
    const entryAmount = ethers.parseEther("100"); // 100 PIZZA per player
    for (const p of players) {
      await pizza.transfer(p.address, entryAmount);
      await pizza.connect(p).approve(await settlementV4.getAddress(), ethers.MaxUint256);
    }

    return {
      pizza,
      stats,
      settlement: settlementV4,
      admin,
      operator,
      weeklyVault,
      freeRollVault,
      charityAddrs,
      players,
      entryAmount,
      OPERATOR_ROLE,
    };
  }

  // Helper: create a match, have N players enter, settle, and verify distributions
  async function runMatchWithPlayers(
    playerCount: number,
    fixture: Awaited<ReturnType<typeof deployFixture>>
  ) {
    const { pizza, settlement, operator, weeklyVault, freeRollVault, charityAddrs, players } = fixture;
    const matchPlayers = players.slice(0, playerCount);
    const entryAmount = ethers.parseEther("100");
    const matchId = ethers.keccak256(
      ethers.toUtf8Bytes(`match_${playerCount}_players_${Date.now()}`)
    );

    // All players enter the match
    for (const p of matchPlayers) {
      await settlement.connect(p).enterMatch(matchId, entryAmount);
    }

    // Verify match state
    const matchData = await settlement.getMatch(matchId);
    expect(matchData.players.length).to.equal(playerCount);
    const expectedPool = entryAmount * BigInt(playerCount);
    expect(matchData.totalPool).to.equal(expectedPool);

    // Winner is first player, slices are sequential (winner has most)
    const winner = matchPlayers[0].address;
    const playerAddrs = matchPlayers.map((p) => p.address);
    const slices = matchPlayers.map((_, i) => BigInt(playerCount - i)); // winner gets most

    // Capture balances BEFORE settlement
    const winnerBalBefore = await pizza.balanceOf(winner);
    const weeklyBalBefore = await pizza.balanceOf(weeklyVault.address);
    const freeRollBalBefore = await pizza.balanceOf(freeRollVault.address);
    const burnAddr = "0x000000000000000000000000000000000000dEaD";
    const burnBalBefore = await pizza.balanceOf(burnAddr);
    const charityBalsBefore: bigint[] = [];
    for (const c of charityAddrs) {
      charityBalsBefore.push(await pizza.balanceOf(c));
    }

    // Settle the match
    const tx = await settlement
      .connect(operator)
      .settleMatch(matchId, winner, playerAddrs, slices);
    await tx.wait();

    // Calculate expected distributions
    const totalPool = expectedPool;
    const winnerAmt = (totalPool * 7700n) / 10000n;
    const weeklyAmt = (totalPool * 1000n) / 10000n;
    const burnAmt = (totalPool * 700n) / 10000n;
    const freeRollAmt = (totalPool * 300n) / 10000n;
    const charityAmt = (totalPool * 300n) / 10000n;
    const perCharity = charityAmt / 9n;

    // Verify winner payout
    const winnerBalAfter = await pizza.balanceOf(winner);
    expect(winnerBalAfter - winnerBalBefore).to.equal(winnerAmt);

    // Verify weekly vault
    const weeklyBalAfter = await pizza.balanceOf(weeklyVault.address);
    expect(weeklyBalAfter - weeklyBalBefore).to.equal(weeklyAmt);

    // Verify burn
    const burnBalAfter = await pizza.balanceOf(burnAddr);
    expect(burnBalAfter - burnBalBefore).to.equal(burnAmt);

    // Verify free roll vault
    const freeRollBalAfter = await pizza.balanceOf(freeRollVault.address);
    expect(freeRollBalAfter - freeRollBalBefore).to.equal(freeRollAmt);

    // Verify charity distributions (each of 9 charities)
    for (let i = 0; i < 9; i++) {
      const charityBalAfter = await pizza.balanceOf(charityAddrs[i]);
      expect(charityBalAfter - charityBalsBefore[i]).to.equal(perCharity);
    }

    // Verify match is settled
    const matchAfter = await settlement.getMatch(matchId);
    expect(matchAfter.settled).to.be.true;

    // Verify pool accounting
    const pools = await settlement.getPoolBalances();
    expect(pools[0]).to.be.gte(weeklyAmt);    // weekly
    expect(pools[1]).to.be.gte(freeRollAmt);   // freeRoll
    expect(pools[2]).to.be.gte(burnAmt);       // burned

    return {
      totalPool,
      winnerAmt,
      weeklyAmt,
      burnAmt,
      freeRollAmt,
      charityAmt,
      perCharity,
    };
  }

  // ============ ENTRY TESTS ============

  describe("Match Entry (2-8 players)", function () {
    it("should allow 2 players to enter a match", async function () {
      const fixture = await loadFixture(deployFixture);
      const { settlement, players } = fixture;
      const entry = ethers.parseEther("100");
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("entry_2p"));

      await settlement.connect(players[0]).enterMatch(matchId, entry);
      await settlement.connect(players[1]).enterMatch(matchId, entry);

      const match = await settlement.getMatch(matchId);
      expect(match.players.length).to.equal(2);
      expect(match.totalPool).to.equal(entry * 2n);
    });

    it("should allow 8 players to enter a match", async function () {
      const fixture = await loadFixture(deployFixture);
      const { settlement, players } = fixture;
      const entry = ethers.parseEther("100");
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("entry_8p"));

      for (const p of players) {
        await settlement.connect(p).enterMatch(matchId, entry);
      }

      const match = await settlement.getMatch(matchId);
      expect(match.players.length).to.equal(8);
      expect(match.totalPool).to.equal(entry * 8n);
    });

    it("should reject 9th player (max 8)", async function () {
      const fixture = await loadFixture(deployFixture);
      const { settlement, players, admin, pizza } = fixture;
      const entry = ethers.parseEther("100");
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("entry_9p"));

      // Enter 8 players
      for (const p of players) {
        await settlement.connect(p).enterMatch(matchId, entry);
      }

      // 9th player should fail
      await pizza.transfer(admin.address, entry);
      await pizza.connect(admin).approve(await settlement.getAddress(), ethers.MaxUint256);
      await expect(
        settlement.connect(admin).enterMatch(matchId, entry)
      ).to.be.revertedWithCustomError(settlement, "MatchFull");
    });

    it("should reject duplicate entry from same player", async function () {
      const fixture = await loadFixture(deployFixture);
      const { settlement, players } = fixture;
      const entry = ethers.parseEther("100");
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("entry_dup"));

      await settlement.connect(players[0]).enterMatch(matchId, entry);
      await expect(
        settlement.connect(players[0]).enterMatch(matchId, entry)
      ).to.be.revertedWithCustomError(settlement, "AlreadyEntered");
    });

    it("should reject mismatched entry amounts", async function () {
      const fixture = await loadFixture(deployFixture);
      const { settlement, players } = fixture;
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("entry_mismatch"));

      await settlement.connect(players[0]).enterMatch(matchId, ethers.parseEther("100"));
      await expect(
        settlement.connect(players[1]).enterMatch(matchId, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(settlement, "AmountMismatch");
    });
  });

  // ============ SETTLEMENT TESTS FOR EACH PLAYER COUNT ============

  describe("Settlement & Payout — 2 Players", function () {
    it("should settle correctly and distribute fees", async function () {
      const fixture = await loadFixture(deployFixture);
      const result = await runMatchWithPlayers(2, fixture);
      // 2 × 100 PIZZA = 200 PIZZA pool
      expect(result.totalPool).to.equal(ethers.parseEther("200"));
      expect(result.winnerAmt).to.equal(ethers.parseEther("154")); // 77% of 200
      expect(result.weeklyAmt).to.equal(ethers.parseEther("20"));  // 10%
      expect(result.burnAmt).to.equal(ethers.parseEther("14"));    // 7%
      expect(result.freeRollAmt).to.equal(ethers.parseEther("6")); // 3%
      expect(result.charityAmt).to.equal(ethers.parseEther("6"));  // 3%
    });
  });

  describe("Settlement & Payout — 3 Players", function () {
    it("should settle correctly and distribute fees", async function () {
      const fixture = await loadFixture(deployFixture);
      const result = await runMatchWithPlayers(3, fixture);
      expect(result.totalPool).to.equal(ethers.parseEther("300"));
      expect(result.winnerAmt).to.equal(ethers.parseEther("231")); // 77%
    });
  });

  describe("Settlement & Payout — 4 Players", function () {
    it("should settle correctly and distribute fees", async function () {
      const fixture = await loadFixture(deployFixture);
      const result = await runMatchWithPlayers(4, fixture);
      expect(result.totalPool).to.equal(ethers.parseEther("400"));
      expect(result.winnerAmt).to.equal(ethers.parseEther("308")); // 77%
    });
  });

  describe("Settlement & Payout — 5 Players", function () {
    it("should settle correctly and distribute fees", async function () {
      const fixture = await loadFixture(deployFixture);
      const result = await runMatchWithPlayers(5, fixture);
      expect(result.totalPool).to.equal(ethers.parseEther("500"));
      expect(result.winnerAmt).to.equal(ethers.parseEther("385")); // 77%
    });
  });

  describe("Settlement & Payout — 6 Players", function () {
    it("should settle correctly and distribute fees", async function () {
      const fixture = await loadFixture(deployFixture);
      const result = await runMatchWithPlayers(6, fixture);
      expect(result.totalPool).to.equal(ethers.parseEther("600"));
      expect(result.winnerAmt).to.equal(ethers.parseEther("462")); // 77%
    });
  });

  describe("Settlement & Payout — 7 Players", function () {
    it("should settle correctly and distribute fees", async function () {
      const fixture = await loadFixture(deployFixture);
      const result = await runMatchWithPlayers(7, fixture);
      expect(result.totalPool).to.equal(ethers.parseEther("700"));
      expect(result.winnerAmt).to.equal(ethers.parseEther("539")); // 77%
    });
  });

  describe("Settlement & Payout — 8 Players", function () {
    it("should settle correctly and distribute fees", async function () {
      const fixture = await loadFixture(deployFixture);
      const result = await runMatchWithPlayers(8, fixture);
      expect(result.totalPool).to.equal(ethers.parseEther("800"));
      expect(result.winnerAmt).to.equal(ethers.parseEther("616")); // 77%
    });
  });

  // ============ BOT SETTLEMENT TESTS ============

  describe("Bot Settlement — multiplayer", function () {
    it("should handle bot win in 2-player match", async function () {
      const fixture = await loadFixture(deployFixture);
      const { pizza, settlement, operator, freeRollVault, players } = fixture;
      const entry = ethers.parseEther("100");
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("bot_2p"));

      await settlement.connect(players[0]).enterMatch(matchId, entry);
      await settlement.connect(players[1]).enterMatch(matchId, entry);

      const totalPool = entry * 2n;
      const winnerAmt = (totalPool * 7700n) / 10000n;
      const halfWinner = winnerAmt / 2n;

      const freeRollBefore = await pizza.balanceOf(freeRollVault.address);

      // Settle as bot match
      await settlement
        .connect(operator)
        .settleBotMatch(
          matchId,
          [players[0].address, players[1].address],
          [5n, 3n]
        );

      // Free roll vault gets half of winner amount + the standard 3%
      const freeRollAfter = await pizza.balanceOf(freeRollVault.address);
      const freeRollAmt = (totalPool * 300n) / 10000n;
      expect(freeRollAfter - freeRollBefore).to.equal(halfWinner + freeRollAmt);
    });

    it("should handle bot win in 4-player match", async function () {
      const fixture = await loadFixture(deployFixture);
      const { pizza, settlement, operator, freeRollVault, players } = fixture;
      const entry = ethers.parseEther("100");
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("bot_4p"));

      for (let i = 0; i < 4; i++) {
        await settlement.connect(players[i]).enterMatch(matchId, entry);
      }

      const totalPool = entry * 4n;
      const winnerAmt = (totalPool * 7700n) / 10000n;
      const halfWinner = winnerAmt / 2n;

      const freeRollBefore = await pizza.balanceOf(freeRollVault.address);

      await settlement
        .connect(operator)
        .settleBotMatch(
          matchId,
          players.slice(0, 4).map((p) => p.address),
          [10n, 8n, 5n, 3n]
        );

      const freeRollAfter = await pizza.balanceOf(freeRollVault.address);
      const freeRollAmt = (totalPool * 300n) / 10000n;
      expect(freeRollAfter - freeRollBefore).to.equal(halfWinner + freeRollAmt);
    });

    it("should handle bot win in 8-player match", async function () {
      const fixture = await loadFixture(deployFixture);
      const { pizza, settlement, operator, freeRollVault, players } = fixture;
      const entry = ethers.parseEther("100");
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("bot_8p"));

      for (const p of players) {
        await settlement.connect(p).enterMatch(matchId, entry);
      }

      const totalPool = entry * 8n;
      const winnerAmt = (totalPool * 7700n) / 10000n;
      const halfWinner = winnerAmt / 2n;

      const freeRollBefore = await pizza.balanceOf(freeRollVault.address);

      await settlement
        .connect(operator)
        .settleBotMatch(
          matchId,
          players.map((p) => p.address),
          [20n, 15n, 12n, 10n, 8n, 5n, 3n, 1n]
        );

      const freeRollAfter = await pizza.balanceOf(freeRollVault.address);
      const freeRollAmt = (totalPool * 300n) / 10000n;
      expect(freeRollAfter - freeRollBefore).to.equal(halfWinner + freeRollAmt);
    });
  });

  // ============ STATS RECORDING TESTS ============

  describe("Stats Recording — multiplayer", function () {
    it("should record stats for all players in a 4-player match", async function () {
      const fixture = await loadFixture(deployFixture);
      const { stats, settlement, operator, players } = fixture;
      const entry = ethers.parseEther("100");
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("stats_4p"));

      for (let i = 0; i < 4; i++) {
        await settlement.connect(players[i]).enterMatch(matchId, entry);
      }

      const totalPool = entry * 4n;
      const winnerAmt = (totalPool * 7700n) / 10000n;
      const winner = players[0].address;

      await settlement
        .connect(operator)
        .settleMatch(
          matchId,
          winner,
          players.slice(0, 4).map((p) => p.address),
          [10n, 5n, 3n, 2n]
        );

      // Winner stats
      const winnerStats = await stats.getStats(winner);
      expect(winnerStats.gamesPlayed).to.equal(1n);
      expect(winnerStats.gamesWon).to.equal(1n);
      expect(winnerStats.slicesCaptured).to.equal(10n);
      expect(winnerStats.lifetimeEarnings).to.equal(winnerAmt);

      // Loser stats
      for (let i = 1; i < 4; i++) {
        const loserStats = await stats.getStats(players[i].address);
        expect(loserStats.gamesPlayed).to.equal(1n);
        expect(loserStats.gamesWon).to.equal(0n);
        expect(loserStats.lifetimeEarnings).to.equal(0n);
      }
    });

    it("should record stats for all 8 players", async function () {
      const fixture = await loadFixture(deployFixture);
      const { stats, settlement, operator, players } = fixture;
      const entry = ethers.parseEther("100");
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("stats_8p"));

      for (const p of players) {
        await settlement.connect(p).enterMatch(matchId, entry);
      }

      await settlement
        .connect(operator)
        .settleMatch(
          matchId,
          players[0].address,
          players.map((p) => p.address),
          [20n, 15n, 12n, 10n, 8n, 5n, 3n, 1n]
        );

      // Check all 8 players have stats recorded
      for (let i = 0; i < 8; i++) {
        const playerStats = await stats.getStats(players[i].address);
        expect(playerStats.gamesPlayed).to.equal(1n);
        expect(playerStats.slicesCaptured).to.equal(BigInt([20, 15, 12, 10, 8, 5, 3, 1][i]));
      }
    });
  });

  // ============ EDGE CASES ============

  describe("Edge Cases", function () {
    it("should not allow settling a match twice", async function () {
      const fixture = await loadFixture(deployFixture);
      const { settlement, operator, players } = fixture;
      const entry = ethers.parseEther("100");
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("double_settle"));

      await settlement.connect(players[0]).enterMatch(matchId, entry);
      await settlement.connect(players[1]).enterMatch(matchId, entry);

      await settlement
        .connect(operator)
        .settleMatch(matchId, players[0].address, [players[0].address, players[1].address], [5n, 3n]);

      await expect(
        settlement
          .connect(operator)
          .settleMatch(matchId, players[0].address, [players[0].address, players[1].address], [5n, 3n])
      ).to.be.revertedWithCustomError(settlement, "MatchAlreadySettled");
    });

    it("should reject mismatched players/slices arrays", async function () {
      const fixture = await loadFixture(deployFixture);
      const { settlement, operator, players } = fixture;
      const entry = ethers.parseEther("100");
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("mismatch_arrays"));

      await settlement.connect(players[0]).enterMatch(matchId, entry);
      await settlement.connect(players[1]).enterMatch(matchId, entry);

      await expect(
        settlement
          .connect(operator)
          .settleMatch(matchId, players[0].address, [players[0].address, players[1].address], [5n])
      ).to.be.revertedWithCustomError(settlement, "PlayerLengthMismatch");
    });

    it("should verify BPS sum to 100%", async function () {
      // Sanity check: 7700 + 1000 + 700 + 300 + 300 = 10000
      expect(7700 + 1000 + 700 + 300 + 300).to.equal(10000);
    });

    it("should calculate prize breakdown correctly via view function", async function () {
      const fixture = await loadFixture(deployFixture);
      const { settlement } = fixture;
      const pool = ethers.parseEther("800"); // 8 players × 100

      const breakdown = await settlement.calculatePrizeBreakdown(pool);
      expect(breakdown.winnerAmt).to.equal(ethers.parseEther("616"));
      expect(breakdown.weeklyAmt).to.equal(ethers.parseEther("80"));
      expect(breakdown.burnAmt).to.equal(ethers.parseEther("56"));
      expect(breakdown.freeRollAmt).to.equal(ethers.parseEther("24"));
      expect(breakdown.charityAmt).to.equal(ethers.parseEther("24"));

      // Verify total adds up (may have small BPS rounding dust)
      const sum =
        breakdown.winnerAmt +
        breakdown.weeklyAmt +
        breakdown.burnAmt +
        breakdown.freeRollAmt +
        breakdown.charityAmt;
      expect(sum).to.equal(pool);
    });
  });
});
