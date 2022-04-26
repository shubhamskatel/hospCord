import {
  PassStaking,
  PassStaking__factory,
  PassBonds,
  PassBonds__factory,
  SampleToken,
  SampleToken__factory,
  XFA,
  XFA__factory,
} from "../typechain";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat";
import { expect, use } from "chai";
import {
  convertWithDecimal,
  getCreate2Address,
  mineBlocks,
  PairBytecode,
  zeroAddress,
  mineBlocksWithMethod,
} from "./utilities/utilities";
import { parseBytes32String } from "ethers/lib/utils";
import { equal } from "assert";
import { loadFixture } from "ethereum-waffle";
import exp from "constants";
import { cpuUsage } from "process";

describe("Vault PASS Staking", async () => {
  let staking: PassStaking;
  let bonds: PassBonds;
  let pass: XFA;
  let vpass: XFA;
  let currency1: SampleToken;
  let currency2: SampleToken;
  let currency3: SampleToken;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    pass = await new XFA__factory(owner).deploy("PASS", "PASS", 8);
    vpass = await new XFA__factory(owner).deploy("vPASS", "vPASS", 8);

    await pass.mint(user.address, convertWithDecimal(100000, 10 ** 8));

    currency1 = await new SampleToken__factory(owner).deploy(
      "C1",
      "Currency 1",
      8
    );
    currency2 = await new SampleToken__factory(owner).deploy(
      "C2",
      "Currency 2",
      8
    );
    currency3 = await new SampleToken__factory(owner).deploy(
      "C3",
      "Currency 3",
      8
    );

    staking = await new PassStaking__factory(owner).deploy();
    await staking.initialize(owner.address, pass.address, vpass.address);

    await pass.mint(staking.address, convertWithDecimal(10000000, 10 ** 8));

    bonds = await new PassBonds__factory(owner).deploy();
    await bonds.initialize(owner.address);

    await staking.updateBondAddress(bonds.address);

    await pass
      .connect(user)
      .approve(staking.address, convertWithDecimal(100000000, 10 ** 8));
    await vpass
      .connect(user)
      .approve(staking.address, convertWithDecimal(100000000, 10 ** 8));

    await vpass.transferOwnership(staking.address);
    await pass.transferOwnership(staking.address);

    // Adding currencies
    await expect(
      staking.addBetCurrencyInfo(1, currency1.address, currency1.address)
    )
      .to.emit(staking, "CurrencyAdded")
      .withArgs(1, currency1.address, currency1.address, true);

    await expect(
      staking.addBetCurrencyInfo(1, currency2.address, currency2.address)
    )
      .to.emit(staking, "CurrencyAdded")
      .withArgs(1, currency2.address, currency2.address, true);

    await expect(
      staking.addBetCurrencyInfo(1, currency3.address, currency3.address)
    )
      .to.emit(staking, "CurrencyAdded")
      .withArgs(1, currency3.address, currency3.address, true);

    // Adding Penalty Info
    await staking.addUpdateLockup(1, 100, 100);
    await staking.addUpdateLockup(2, 200, 200);
    await staking.addUpdateLockup(3, 300, 300);
  });

  it.only("Rewards calculation", async () => {
    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Calculated Rewards: ", calculatedRewards.toString());
  });

  it("Addresses are set correctly", async () => {
    let passAddr = await staking.PASSAddress();
    console.log("PASS Address: ", passAddr);

    // Expect
    expect(passAddr).to.be.eq(pass.address);

    let vpassAddr = await staking.VPASSAddress();
    console.log("vPASS Address: ", vpassAddr);

    // Expect
    expect(passAddr).to.be.eq(pass.address);
  });

  it("Bet Currencies are added", async () => {
    let firstCurrency = await (await staking.currencyMapping(1))
      .currencyAddress;
    console.log("Retrieved first currency: ", firstCurrency.toString());

    // Expect
    expect(firstCurrency).to.be.eq(currency1.address);

    let secondCurrency = await (await staking.currencyMapping(2))
      .currencyAddress;
    console.log("Retrieved second currency: ", secondCurrency.toString());

    // Expect
    expect(secondCurrency).to.be.eq(currency2.address);

    let thirdCurrency = await (await staking.currencyMapping(3))
      .currencyAddress;
    console.log("Retrieved third currency: ", thirdCurrency.toString());

    // Expect
    expect(thirdCurrency).to.be.eq(currency3.address);
  });

  it("Lockups are added", async () => {
    let firstLockup = await staking.lockupMapping(1);
    let dailyReward1 = Math.floor((100 * 10 ** 8) / (365 * 3));
    console.log("First Lockup: ", firstLockup.toString());

    // Expect
    expect(firstLockup.toString()).to.deep.eq(
      [1, 100, dailyReward1].toString()
    );

    let secondLockup = await staking.lockupMapping(2);
    let dailyReward2 = Math.floor((200 * 10 ** 8) / (365 * 3));
    console.log("Second Lockup: ", secondLockup.toString());

    // Expect
    expect(secondLockup.toString()).to.deep.eq(
      [2, 200, dailyReward2].toString()
    );

    let thirdLockup = await staking.lockupMapping(3);
    let dailyReward3 = Math.floor((300 * 10 ** 8) / (365 * 3));
    console.log("Third Lockup: ", thirdLockup.toString());

    // Expect
    expect(thirdLockup.toString()).to.deep.eq(
      [3, 300, dailyReward3].toString()
    );
  });

  it("Cannot add a currency again", async () => {
    console.log("Adding Currency1 again..");

    await expect(
      staking.addBetCurrencyInfo(1, currency1.address, currency1.address)
    ).to.be.revertedWith("Currency already exists");
    console.log("Fails");
  });

  it("Enable or disable currencies", async () => {
    console.log(
      "Current Currency status: ",
      await (await staking.currencyMapping(1)).isActive
    );

    console.log("Disabling currency 1..");

    await expect(staking.enableOrDisableCurrency(currency1.address))
      .to.emit(staking, "CurrencyUpdated")
      .withArgs(1, currency1.address, currency1.address, false);

    console.log(
      "Current Currency status: ",
      await (await staking.currencyMapping(1)).isActive
    );

    console.log("Enabling currency 1..");

    await expect(staking.enableOrDisableCurrency(currency1.address))
      .to.emit(staking, "CurrencyUpdated")
      .withArgs(1, currency1.address, currency1.address, true);

    console.log(
      "Current Currency status: ",
      await (await staking.currencyMapping(1)).isActive
    );
  });

  it("Pass staked", async () => {
    console.log("Updating currency 1 price to 100..");
    await staking.setCurrencyPrice([currency1.address], [100]);

    console.log("Staking 10 PASS..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(10, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    let contractPassBalance = await pass.balanceOf(staking.address);
    console.log("Contract Pass Balance: ", contractPassBalance.toString());

    // Expect
    expect(contractPassBalance.toString()).to.be.eq(
      (
        Number(convertWithDecimal(10, 10 ** 8)) +
        Number(convertWithDecimal(10000000, 10 ** 8))
      ).toString()
    );

    let userVpassBal = await vpass.balanceOf(user.address);
    console.log("User VPass Balance: ", userVpassBal.toString());

    // Expect
    expect(userVpassBal.toString()).to.be.eq(
      convertWithDecimal(10, 10 ** 8).toString()
    );
  });

  it("User unstakes after first slotTime ends", async () => {
    await staking.setCurrencyPrice([currency1.address], [100]);

    console.log("Staking 10 PASS..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    await mineBlocks(ethers.provider, 125);
    console.log("Slot time ends");
    console.log("Lockup: ", await (await staking.lockupMapping(1)).toString());

    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Calculated rewards: ", calculatedRewards.toString());

    let userInitialBalance = await pass.balanceOf(user.address);
    console.log("User's initial Pass balance: ", userInitialBalance.toString());

    console.log("Unstaking..");
    await staking
      .connect(user)
      .unStakePASS(currency1.address, convertWithDecimal(100, 10 ** 8));
    console.log("PASS should be in vesting now");

    let vestedPASS = await staking.passVestingMapping(
      user.address,
      currency1.address,
      1
    );
    console.log("Vested PASS Info: ", vestedPASS.toString());

    console.log("Claiming before the lockup ends..");
    await expect(
      staking.connect(user).claimPASS(currency1.address, 1)
    ).to.be.revertedWith("PASS still in vesting");
    console.log("Failed");

    await mineBlocks(ethers.provider, 101);
    console.log("101 seconds passed. vesting over");

    await staking.connect(user).claimPASS(currency1.address, 1);
    console.log("Claimed after vesting is over");

    let expectedBalance = vestedPASS[0].add(vestedPASS[1]);

    let userFinalBalance = await pass.balanceOf(user.address);
    console.log("User's final Pass balance: ", userFinalBalance.toString());

    expect(userInitialBalance.add(expectedBalance).toString()).to.be.eq(
      userFinalBalance.toString()
    );
  });

  it("User get the bet bonus when he wins the bet (Inline)", async () => {
    await staking.setCurrencyPrice([currency1.address], [100]);

    console.log("Staking 100 PASS..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    await mineBlocks(ethers.provider, 121);
    console.log("121 seconds passed. First slot time ends");

    // Increasing prices three time (Inline)
    await staking.setCurrencyPrice([currency1.address], [200]);
    await staking.setCurrencyPrice([currency1.address], [300]);

    console.log(
      "User Bet Rewards: ",
      await (
        await staking.userBetRewards(2, 100, user.address, currency1.address)
      ).toString()
    );

    let lockUpPercentage = await (await staking.lockupMapping(1))
      .dailyRewardPercentage;

    let expectedRewards = Math.floor(
      (Number(lockUpPercentage) * convertWithDecimal(100, 10 ** 8)) /
        (10000 * 10 ** 8)
    );

    let expectedBetRewards =
      ((await staking.bonusRewardPercentage()) *
        convertWithDecimal(100, 10 ** 8)) /
      10000;

    console.log("Expected Rewards: ", expectedRewards.toString());
    console.log("Expected Bet Rewards: ", expectedBetRewards.toString());

    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Total Calculated Rewards: ", calculatedRewards.toString());

    // Expect
    expect(calculatedRewards[0].toString()).to.be.eq(
      (expectedRewards + expectedBetRewards).toString()
    );
  });

  it("User get the bet bonus when he wins the bet (Inverse)", async () => {
    await staking.setCurrencyPrice([currency1.address], [200]);

    console.log("Staking 100 PASS..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        false,
        1,
        false
      );

    await mineBlocks(ethers.provider, 121);
    console.log("121 seconds passed. First slot time ends");

    // Increasing prices three time (Inline)
    await staking.setCurrencyPrice([currency1.address], [100]);
    await staking.setCurrencyPrice([currency1.address], [90]);

    console.log(
      "User Bet Rewards: ",
      await (
        await staking.userBetRewards(1, 100, user.address, currency1.address)
      ).toString()
    );

    let lockUpPercentage = await (await staking.lockupMapping(1))
      .dailyRewardPercentage;

    let expectedRewards = Math.floor(
      (Number(lockUpPercentage) * convertWithDecimal(100, 10 ** 8)) /
        (10000 * 10 ** 8)
    );

    let expectedBetRewards =
      ((await staking.bonusRewardPercentage()) *
        convertWithDecimal(100, 10 ** 8)) /
      10000;

    console.log("Expected Rewards: ", expectedRewards.toString());
    console.log("Expected Bet Rewards: ", expectedBetRewards.toString());

    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Total Calculated Rewards: ", calculatedRewards.toString());

    // Expect
    expect(calculatedRewards[0].toString()).to.be.eq(
      (expectedRewards + expectedBetRewards).toString()
    );
  });

  it("User doesn't get the bet bonus when he loses the bet (Inline)", async () => {
    await staking.setCurrencyPrice([currency1.address], [100]);

    console.log("Staking 100 PASS..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    await mineBlocks(ethers.provider, 125);

    // Not increasing prices (Inline)
    await staking.setCurrencyPrice([currency1.address], [100]);

    let betRewards = await staking.userBetRewards(
      1,
      100,
      user.address,
      currency1.address
    );
    console.log("User Bet Rewards: ", betRewards.toString());

    // Expect
    expect(betRewards[0].toString()).to.be.eq("0");

    let lockUpPercentage = await (await staking.lockupMapping(1))
      .dailyRewardPercentage;

    let expectedRewards = Math.floor(
      (Number(lockUpPercentage) * convertWithDecimal(100, 10 ** 8)) /
        (10000 * 10 ** 8)
    );
    console.log("Expected Rewards: ", expectedRewards.toString());

    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Total Calculated Rewards: ", calculatedRewards.toString());

    // Expect
    expect(calculatedRewards[0].toString()).to.be.eq(
      expectedRewards.toString()
    );
  });

  it("User get the 2 bet bonus when he wins the bet (Inline)", async () => {
    await staking.setCurrencyPrice([currency1.address], [100]);

    console.log("Staking 100 PASS..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    // Increasing prices three time (Inline)
    await staking.setCurrencyPrice([currency1.address], [200]);
    await staking.setCurrencyPrice([currency1.address], [300]);
    await staking.setCurrencyPrice([currency1.address], [400]);

    await mineBlocks(ethers.provider, 725);
    console.log("6 slots done");

    console.log("Updated price 2 times");

    console.log(
      "User Bet Rewards: ",
      await (
        await staking.userBetRewards(1, 100, user.address, currency1.address)
      ).toString()
    );

    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Total Calculated Rewards: ", calculatedRewards.toString());

    let lockUpPercentage = await (await staking.lockupMapping(1))
      .dailyRewardPercentage;

    let expectedRewards = Math.floor(
      (6 * Number(lockUpPercentage) * convertWithDecimal(100, 10 ** 8)) /
        (10000 * 10 ** 8)
    );

    let expectedBetRewards =
      (2 *
        (await staking.bonusRewardPercentage()) *
        convertWithDecimal(100, 10 ** 8)) /
      10000;

    console.log("Expected Rewards: ", expectedRewards.toString());
    console.log("Expected Bet Rewards: ", expectedBetRewards.toString());

    // Expect
    expect(calculatedRewards[0].toString()).to.be.eq(
      (expectedRewards + expectedBetRewards).toString()
    );
  });

  it("User get the 1 bet bonus when he wins the bet (Inline) and loses the second time", async () => {
    await staking.setCurrencyPrice([currency1.address], [100]);

    console.log("Staking 100 PASS..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    // Increasing prices three time (Inline)
    await staking.setCurrencyPrice([currency1.address], [200]);
    await staking.setCurrencyPrice([currency1.address], [300]);
    await staking.setCurrencyPrice([currency1.address], [100]);
    console.log("Updated price 2 times");

    await mineBlocks(ethers.provider, 725);
    console.log("6 slots done");

    console.log(
      "User Bet Rewards: ",
      await (
        await staking.userBetRewards(1, 100, user.address, currency1.address)
      ).toString()
    );

    let lockUpPercentage = await (await staking.lockupMapping(1))
      .dailyRewardPercentage;

    let expectedRewards = Math.floor(
      (6 * Number(lockUpPercentage) * convertWithDecimal(100, 10 ** 8)) /
        (10000 * 10 ** 8)
    );

    let expectedBetRewards =
      ((await staking.bonusRewardPercentage()) *
        convertWithDecimal(100, 10 ** 8)) /
      10000;

    console.log("Expected Rewards: ", expectedRewards.toString());
    console.log("Expected Bet Rewards: ", expectedBetRewards.toString());

    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Total Calculated Rewards: ", calculatedRewards.toString());

    // Expect
    expect(calculatedRewards[0].toString()).to.be.eq(
      (expectedRewards + expectedBetRewards).toString()
    );
  });

  it("User doesn't get the bet bonus when the price increase by less than 1% (Inline)", async () => {
    await staking.setCurrencyPrice([currency1.address], [1000]);

    console.log("Staking 100 PASS..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    // Increasing prices three time (Inline)
    await staking.setCurrencyPrice([currency1.address], [1009]);

    await mineBlocks(ethers.provider, 125);
    console.log("1 slot done");

    let betRewards = await staking.userBetRewards(
      1,
      1000,
      user.address,
      currency1.address
    );
    console.log("User Bet Rewards: ", betRewards.toString());

    // Expect
    expect(betRewards[0].toString()).to.be.eq("0");

    let lockUpPercentage = await (await staking.lockupMapping(1))
      .dailyRewardPercentage;

    let expectedRewards = Math.floor(
      (Number(lockUpPercentage) * convertWithDecimal(100, 10 ** 8)) /
        (10000 * 10 ** 8)
    );

    console.log("Expected Rewards: ", expectedRewards.toString());

    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Total Calculated Rewards: ", calculatedRewards.toString());

    // Expect
    expect(calculatedRewards[0].toString()).to.be.eq(
      expectedRewards.toString()
    );
  });

  it("User doesn't get the bet bonus when the price decreases by less than 1% (Inverse)", async () => {
    await staking.setCurrencyPrice([currency1.address], [1000]);

    console.log("Staking 100 PASS..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        false,
        1,
        false
      );

    // Increasing prices three time (Inline)
    await staking.setCurrencyPrice([currency1.address], [991]);

    await mineBlocks(ethers.provider, 125);
    console.log("1 slot done");

    let betRewards = await staking.userBetRewards(
      1,
      1000,
      user.address,
      currency1.address
    );
    console.log("User Bet Rewards: ", betRewards.toString());

    // Expect
    expect(betRewards[0].toString()).to.be.eq("0");

    let lockUpPercentage = await (await staking.lockupMapping(1))
      .dailyRewardPercentage;

    let expectedRewards = Math.floor(
      (Number(lockUpPercentage) * convertWithDecimal(100, 10 ** 8)) /
        (10000 * 10 ** 8)
    );

    console.log("Expected Rewards: ", expectedRewards.toString());

    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Total Calculated Rewards: ", calculatedRewards.toString());

    // Expect
    expect(calculatedRewards[0].toString()).to.be.eq(
      expectedRewards.toString()
    );
  });

  it("User gets bet and normal bonus and then unstakes", async () => {
    await staking.setCurrencyPrice([currency1.address], [100]);

    console.log("Staking 100 PASS..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    // Increasing prices three time (Inline)
    await staking.setCurrencyPrice([currency1.address], [200]);

    await mineBlocks(ethers.provider, 125);
    console.log("1 slot done");

    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Total Calculated Rewards: ", calculatedRewards.toString());

    let userInitialPass = await pass.balanceOf(user.address);
    console.log("User's initial pass balance: ", userInitialPass.toString());

    console.log("Unstaking..");
    await staking
      .connect(user)
      .unStakePASS(currency1.address, convertWithDecimal(100, 10 ** 8));
    console.log("PASS will go into vesting");

    let vestingInfo = await staking.passVestingMapping(
      user.address,
      currency1.address,
      1
    );
    console.log("User's vesting Info: ", vestingInfo.toString());

    expect(
      vestingInfo.PASSAmount.toString(),
      vestingInfo.PASSRewards.toString()
    ).to.deep.eq(
      convertWithDecimal(100, 10 ** 8).toString(),
      calculatedRewards[0].toString()
    );

    console.log("Trying to claim before vesting ends..");
    await expect(
      staking.connect(user).claimPASS(currency1.address, 1)
    ).to.be.revertedWith("PASS still in vesting");
    console.log("Failed");

    await mineBlocks(ethers.provider, 125);
    console.log("Vesting done");

    await staking.connect(user).claimPASS(currency1.address, 1);
    console.log("Claimed after vesting is over");

    // isClaimed becomes true
    await expect(
      (await staking.passVestingMapping(user.address, currency1.address, 1))
        .isClaimed
    ).to.be.eq(true);

    let userFinalPass = await pass.balanceOf(user.address);
    console.log("User's final pass balance: ", userFinalPass.toString());

    // Expect
    expect(userFinalPass.toString()).to.be.eq(
      userInitialPass
        .add(convertWithDecimal(100, 10 ** 8))
        .add(calculatedRewards[0])
        .toString()
    );

    console.log("Trying to claim again...");
    await expect(
      staking.connect(user).claimPASS(currency1.address, 1)
    ).to.be.revertedWith("Already claimed the vested PASS");
    console.log("Failed");

    console.log("Trying to claim with different ID...");
    await expect(
      staking.connect(user).claimPASS(currency1.address, 2)
    ).to.be.revertedWith("Nothing to claim");
    console.log("Failed");
  });

  it("User gets bet and normal bonus and then unstakes, then stakes again", async () => {
    await staking.setCurrencyPrice([currency1.address], [100]);

    console.log("Staking 100 PASS..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    // Increasing prices three time (Inline)
    await staking.setCurrencyPrice([currency1.address], [200]);
    await staking.setCurrencyPrice([currency1.address], [300]);

    await mineBlocks(ethers.provider, 125);
    console.log("1 slot done");

    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Total Calculated Rewards: ", calculatedRewards.toString());

    console.log("Unstaking..");
    await staking
      .connect(user)
      .unStakePASS(currency1.address, convertWithDecimal(100, 10 ** 8));
    console.log("PASS will go into vesting");

    let vestingInfo = await staking.passVestingMapping(
      user.address,
      currency1.address,
      1
    );
    console.log("User's vesting Info: ", vestingInfo.toString());

    await mineBlocks(ethers.provider, 125);
    console.log("Vesting done");

    await staking.connect(user).claimPASS(currency1.address, 1);
    console.log("Claimed after vesting is over");

    // expect
    await expect(
      (
        await staking.userMapping(user.address, currency1.address)
      ).PASSStaked.toString()
    ).to.be.eq(
      (
        await staking.userMapping(user.address, currency1.address)
      ).PASSClaimed.toString()
    );
    console.log("All PASS Claimed");

    console.log("Staking again");

    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    // Expect
    await expect(
      (
        await staking.userMapping(user.address, currency1.address)
      ).PASSStaked.toString()
    ).to.be.eq(convertWithDecimal(100, 10 ** 8));
    console.log("100 Pass staked again");
  });

  it("User stakes, then unstakes in 2 parts", async () => {
    await staking.setCurrencyPrice([currency1.address], [100]);

    console.log("Staking 100 PASS ..");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(100, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    // Increasing prices three time (Inline)
    await staking.setCurrencyPrice([currency1.address], [200]);
    await staking.setCurrencyPrice([currency1.address], [300]);

    await mineBlocks(ethers.provider, 125);
    console.log("1 slot done");

    let calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Total Calculated Rewards: ", calculatedRewards.toString());

    let initialUserInfo = await staking.userMapping(
      user.address,
      currency1.address
    );
    console.log("Initial user info: ", initialUserInfo.toString());

    console.log("Unstaking 50 PASS..");
    await staking
      .connect(user)
      .unStakePASS(currency1.address, convertWithDecimal(50, 10 ** 8));
    console.log("PASS will go into vesting");

    let initialVestedPass = await staking.passVestingMapping(
      user.address,
      currency1.address,
      1
    );
    console.log("Initial Vested Pass: ", initialVestedPass.toString());

    let newUserInfo = await staking.userMapping(
      user.address,
      currency1.address
    );
    console.log("New user info: ", newUserInfo.toString());

    console.log("125 seconds passed. Vesting over. New rewards generated");
    await mineBlocks(ethers.provider, 125);

    console.log("Claiming..");
    await staking.connect(user).claimPASS(currency1.address, 1);
    console.log("Claimed");

    await expect(
      (await staking.passVestingMapping(user.address, currency1.address, 1))
        .isClaimed
    ).to.be.eq(true);

    console.log("Cannot claim again");
    await expect(
      staking.connect(user).claimPASS(currency1.address, 1)
    ).to.be.revertedWith("Already claimed the vested PASS");
    console.log("Failed");

    let latestUserInfo = await staking.userMapping(
      user.address,
      currency1.address
    );
    console.log("New user info: ", latestUserInfo.toString());

    calculatedRewards = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Total Calculated Rewards: ", calculatedRewards.toString());

    console.log("Unstaking 50 PASS..");
    await staking
      .connect(user)
      .unStakePASS(currency1.address, convertWithDecimal(50, 10 ** 8));
    console.log("PASS will go into vesting");

    initialVestedPass = await staking.passVestingMapping(
      user.address,
      currency1.address,
      2
    );
    console.log("Initial Vested Pass: ", initialVestedPass.toString());

    console.log("100 seconds passed. Vesting over.");
    await mineBlocks(ethers.provider, 101);

    console.log("Claiming..");
    await staking.connect(user).claimPASS(currency1.address, 2);
    console.log("Claimed");

    latestUserInfo = await staking.userMapping(user.address, currency1.address);
    console.log("New user info: ", latestUserInfo.toString());

    console.log("250 seconds passed. Testing.");
    await mineBlocks(ethers.provider, 250);

    console.log("Trying to unstake 1 PASS..");
    await expect(
      staking
        .connect(user)
        .unStakePASS(currency1.address, convertWithDecimal(1, 10 ** 8))
    ).to.be.revertedWith("Amount cannot be more than the PASS available");
    console.log("Failed");

    console.log("Staking again...");
    await staking
      .connect(user)
      .stakePASS(
        convertWithDecimal(123, 10 ** 8),
        user.address,
        currency1.address,
        true,
        1,
        false
      );

    latestUserInfo = await staking.userMapping(user.address, currency1.address);
    console.log("New user info: ", latestUserInfo.toString());
  });
});
