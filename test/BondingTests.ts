import {
  XFA,
  XFA__factory,
  PassBonds,
  PassBonds__factory,
  PassStaking,
  PassStaking__factory,
  UniswapV2Factory,
  UniswapV2Factory__factory,
  WETH9,
  WETH9__factory,
  UniswapV2Router02,
  UniswapV2Router02__factory,
  UniswapV2Pair,
  UniswapV2Pair__factory,
  SampleToken,
  SampleToken__factory,
} from "../typechain";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat";
import { expect } from "chai";
import {
  convertWithDecimal,
  getCreate2Address,
  mineBlocks,
  PairBytecode,
  zeroAddress,
} from "./utilities/utilities";
import { parseBytes32String } from "ethers/lib/utils";
import { equal } from "assert";
import { loadFixture } from "ethereum-waffle";

describe("VAULT PASS Bonding Contract", async () => {
  let pass: XFA;
  let bonds: PassBonds;
  let staking: PassStaking;
  let factory: UniswapV2Factory;
  let weth: WETH9;
  let router: UniswapV2Router02;
  let pair: UniswapV2Pair;
  let token0: SampleToken;
  let token1: SampleToken;
  let token2: SampleToken;
  let vpass: XFA;
  let currency1: SampleToken;
  let currency2: SampleToken;
  let currency3: SampleToken;
  let busd: SampleToken;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let receiver: SignerWithAddress;
  let feeToAddress: SignerWithAddress;

  beforeEach(async () => {
    [owner, user, receiver, feeToAddress] = await ethers.getSigners();

    // Deploying Factory, weth and router contracts
    factory = await new UniswapV2Factory__factory(owner).deploy(
      feeToAddress.address
    );
    weth = await new WETH9__factory(owner).deploy();
    router = await new UniswapV2Router02__factory(owner).deploy(
      factory.address,
      weth.address
    );

    // Deploying tokens
    token0 = await new SampleToken__factory(owner).deploy(
      "Token0",
      "Token0",
      8
    );
    token1 = await new SampleToken__factory(owner).deploy(
      "Token1",
      "Token1",
      8
    );
    token2 = await new SampleToken__factory(owner).deploy(
      "Token2",
      "Token2",
      8
    );
    busd = await new SampleToken__factory(owner).deploy("BUSD", "BUSD", 8);

    // Minting Tokens
    await token0.mint(user.address, convertWithDecimal(100000, 10 ** 8));
    await token1.mint(user.address, convertWithDecimal(100000, 10 ** 8));
    await token2.mint(user.address, convertWithDecimal(100000, 10 ** 8));
    await busd.mint(user.address, convertWithDecimal(100000, 10 ** 8));

    // Approvals
    await token0
      .connect(user)
      .approve(router.address, convertWithDecimal(100000, 10 ** 8));
    await token1
      .connect(user)
      .approve(router.address, convertWithDecimal(100000, 10 ** 8));
    await token2
      .connect(user)
      .approve(router.address, convertWithDecimal(100000, 10 ** 8));
    await busd
      .connect(user)
      .approve(router.address, convertWithDecimal(100000, 10 ** 8));

    // Adding liquidity for token0
    await router
      .connect(user)
      .addLiquidity(
        token0.address,
        busd.address,
        convertWithDecimal(1000, 10 ** 8),
        convertWithDecimal(10000, 10 ** 8),
        convertWithDecimal(1000, 10 ** 8),
        convertWithDecimal(10000, 10 ** 8),
        user.address,
        10000000000000
      );
    console.log("First liquidity added");

    await router
      .connect(user)
      .addLiquidity(
        token1.address,
        token2.address,
        convertWithDecimal(10000, 10 ** 8),
        convertWithDecimal(10000, 10 ** 8),
        convertWithDecimal(10000, 10 ** 8),
        convertWithDecimal(10000, 10 ** 8),
        user.address,
        10000000000000
      );
    console.log("Second liquidity added");

    let pairAddress = await getCreate2Address(
      factory.address,
      [token1.address, token2.address],
      PairBytecode
    );
    pair = await new UniswapV2Pair__factory(owner).attach(pairAddress);
    let lpBalance = await pair.balanceOf(user.address);
    console.log("User LP Balance: ", lpBalance.toString());

    // PASS token
    pass = await new XFA__factory(owner).deploy("PASS", "PASS", 8);

    // Bonds
    bonds = await new PassBonds__factory(owner).deploy();

    await pass.mint(bonds.address, convertWithDecimal(10000000, 10 ** 8));

    // Initializing
    await bonds.updateReceiverAddress(receiver.address);
    await bonds.updateBUSDToken(busd.address);
    await bonds.updatePASSAddress(pass.address);
    await bonds.updateUniswapV2RouterAddress(router.address);
    await bonds.initialize(owner.address);

    // Adding new LPs (1 Token and 1 LP)
    await expect(bonds.addNewLP(token0.address, zeroAddress, zeroAddress))
      .to.emit(bonds, "LPAdded")
      .withArgs(token0.address, zeroAddress, zeroAddress, true, true, 1000);
    await expect(bonds.addNewLP(pair.address, token1.address, token2.address))
      .to.emit(bonds, "LPAdded")
      .withArgs(pair.address, token1.address, token2.address, true, true, 1000);
  });

  it("LPs are added successfully", async () => {
    let lpAddressReturned1 = await (await bonds.LPMapping(1)).lpAddress;
    console.log("First Expected LP Address: ", lpAddressReturned1);

    // Expect
    expect(lpAddressReturned1).to.be.eq(token0.address);
    console.log("Passed");

    let lpAddressReturned2 = await await bonds.LPMapping(2);
    console.log("Second Expected LP Address: ", lpAddressReturned2.lpAddress);

    // Expect
    expect(
      lpAddressReturned2.lpAddress,
      lpAddressReturned2.tokenAAddress
    ).to.deep.eq(pair.address, token1.address);
    console.log("Passed");
  });

  it("Third LP doesn't exist", async () => {
    let lpAddressReturned = await (await bonds.LPMapping(3)).lpAddress;
    console.log("LP Address returned: ", lpAddressReturned);

    // Expect
    expect(lpAddressReturned).to.be.eq(
      "0x0000000000000000000000000000000000000000"
    );
  });

  it("Enable or disable LP working", async () => {
    let initialStatus = await (await bonds.LPMapping(1)).isActive;
    console.log("Initial first LP status: ", initialStatus);

    console.log("Changing..");

    await bonds.enableOrDisableLP(await (await bonds.LPMapping(1)).lpAddress);
    // Expect
    await expect((await bonds.LPMapping(1)).isActive).to.be.eq(false);

    let newStatus = await (await bonds.LPMapping(1)).isActive;
    console.log("New first LP status: ", newStatus);

    console.log("Changing again..");

    await bonds.enableOrDisableLP(await (await bonds.LPMapping(1)).lpAddress);
    // Expect
    await expect((await bonds.LPMapping(1)).isActive).to.be.eq(true);

    let finalStatus = await (await bonds.LPMapping(1)).isActive;
    console.log("Final first LP status: ", finalStatus);
  });

  it("Buying PASS Bonds", async () => {
    // Adding LP for busd
    await bonds.addNewLP(busd.address, zeroAddress, zeroAddress);
    console.log("BUSD LP added");

    let calculatedPass = await bonds.calculateDiscountedPASS(
      busd.address,
      convertWithDecimal(10, 10 ** 8)
    );
    console.log("Calculated PASS: ", calculatedPass.toString());

    await busd
      .connect(user)
      .approve(bonds.address, convertWithDecimal(10, 10 ** 8));

    console.log("Buying PASS tokens..");
    await bonds
      .connect(user)
      .buyPASSBonds(busd.address, convertWithDecimal(10, 10 ** 8));

    let userPassTokens = await (
      await bonds.exchangePASSMapping(user.address, busd.address)
    ).PASSTokenAmount;
    console.log("Final user's PASS tokens: ", userPassTokens.toString());

    // Expect
    expect(userPassTokens.toString()).to.be.eq(calculatedPass.toString());

    console.log(
      "Timestamp: ",
      await (await bonds.exchangePASSMapping(user.address, busd.address))
        .timeStamp
    );

    console.log(
      "PASS Bakance: ",
      (
        await (await bonds.exchangePASSMapping(user.address, busd.address))
          .PASSTokenAmount
      ).toString()
    );
  });

  it("Buying PASS Bonds the second time", async () => {
    // Adding LP for busd
    await bonds.addNewLP(busd.address, zeroAddress, zeroAddress);
    console.log("BUSD LP added");

    let calculatedPass1 = await bonds.calculateDiscountedPASS(
      busd.address,
      convertWithDecimal(10, 10 ** 8)
    );
    console.log("Calculated PASS 1: ", calculatedPass1.toString());

    await busd
      .connect(user)
      .approve(bonds.address, convertWithDecimal(100, 10 ** 8));

    console.log("Buying PASS tokens..");
    await bonds
      .connect(user)
      .buyPASSBonds(busd.address, convertWithDecimal(10, 10 ** 8));

    let calculatedPass2 = await bonds.calculateDiscountedPASS(
      busd.address,
      convertWithDecimal(10, 10 ** 8)
    );
    console.log("Calculated PASS 2: ", calculatedPass2.toString());

    console.log("Buying PASS tokens again..");
    await bonds
      .connect(user)
      .buyPASSBonds(busd.address, convertWithDecimal(10, 10 ** 8));

    let userFinalBalance = await (
      await bonds.exchangePASSMapping(user.address, busd.address)
    ).PASSTokenAmount;
    console.log("User's final PASS Balance: ", userFinalBalance.toString());

    // Expect
    expect(userFinalBalance.toString()).to.be.eq(
      calculatedPass1.add(calculatedPass2).toString()
    );
  });

  it("User can claim PASS after 1st interval ends", async () => {
    // Adding LP for busd
    await bonds.addNewLP(busd.address, zeroAddress, zeroAddress);
    console.log("BUSD LP added");

    await busd
      .connect(user)
      .approve(bonds.address, convertWithDecimal(100, 10 ** 8));

    console.log("Buying PASS tokens..");
    await bonds
      .connect(user)
      .buyPASSBonds(busd.address, convertWithDecimal(10, 10 ** 8));
    console.log("Bought");
    console.log("Since it is not autostake, vesting period should be doubled");

    let newVesting = await (
      await bonds.exchangePASSMapping(user.address, busd.address)
    ).vestingPeriod;
    console.log("New Vesting: ", newVesting.toString());

    // Expect
    expect(newVesting.toString()).to.be.eq("720");

    console.log("Trying to claim before the 1st interval..");
    await expect(
      bonds.connect(user).claimPASSTokens(busd.address)
    ).to.be.revertedWith("No tokens to claim");
    console.log("Failed");

    await mineBlocks(ethers.provider, 245);
    console.log("4 minutes passes. So 1st claim is available");

    let userTotalTokens = await (
      await bonds.exchangePASSMapping(user.address, busd.address)
    ).PASSTokenAmount;
    console.log("Total PASS to be claimed: ", userTotalTokens.toString());

    let calculatedTokens = await bonds.claimPASSAvailable(
      0,
      userTotalTokens,
      user.address,
      busd.address
    );
    console.log("Available PASS: ", calculatedTokens.toString());

    console.log("Claiming..");
    await expect(bonds.connect(user).claimPASSTokens(busd.address))
      .to.emit(bonds, "PASSBondClaimed")
      .withArgs(user.address, calculatedTokens[0], calculatedTokens[1], false);
    console.log("Claim Successful");
  });

  it("User can claim all PASS after vesting ends", async () => {
    // Adding LP for busd
    await bonds.addNewLP(busd.address, zeroAddress, zeroAddress);
    console.log("BUSD LP added");

    await busd
      .connect(user)
      .approve(bonds.address, convertWithDecimal(100, 10 ** 8));

    console.log("Buying PASS tokens..");
    await bonds
      .connect(user)
      .buyPASSBonds(busd.address, convertWithDecimal(10, 10 ** 8));
    console.log("Bought");

    await mineBlocks(ethers.provider, 725);
    console.log(
      "12 minutes passed (Double vetsing). So total claim is available"
    );

    let userTotalTokens = await (
      await bonds.exchangePASSMapping(user.address, busd.address)
    ).PASSTokenAmount;
    console.log("Total PASS to be claimed: ", userTotalTokens.toString());

    let calculatedTokens = await bonds.claimPASSAvailable(
      0,
      userTotalTokens,
      user.address,
      busd.address
    );
    console.log("Available PASS: ", calculatedTokens.toString());

    console.log("Claiming..");
    await expect(bonds.connect(user).claimPASSTokens(busd.address))
      .to.emit(bonds, "PASSBondClaimed")
      .withArgs(user.address, calculatedTokens[0], calculatedTokens[1], true);
    console.log("Claim Successful");

    let userPassBalance = await pass.balanceOf(user.address);
    console.log("User Pass Balance: ", userPassBalance.toString());

    // Expect
    expect(userPassBalance.toString()).to.be.eq(calculatedTokens[0].toString());
  });

  it("User can claim PASS after 1st interval ends, and then claim all after total time ends", async () => {
    // Adding LP for busd
    await bonds.addNewLP(busd.address, zeroAddress, zeroAddress);
    console.log("BUSD LP added");

    await busd
      .connect(user)
      .approve(bonds.address, convertWithDecimal(100, 10 ** 8));

    console.log("Buying PASS tokens..");
    await bonds
      .connect(user)
      .buyPASSBonds(busd.address, convertWithDecimal(10, 10 ** 8));
    console.log("Bought");

    await mineBlocks(ethers.provider, 245);
    console.log("4 minutes passes. So 1st claim is available");

    let userTotalTokens = await (
      await bonds.exchangePASSMapping(user.address, busd.address)
    ).PASSTokenAmount;
    console.log("Total PASS to be claimed: ", userTotalTokens.toString());

    let calculatedTokens1 = await bonds.claimPASSAvailable(
      0,
      userTotalTokens,
      user.address,
      busd.address
    );
    console.log("Available PASS: ", calculatedTokens1.toString());

    console.log("Claiming..");
    await expect(bonds.connect(user).claimPASSTokens(busd.address))
      .to.emit(bonds, "PASSBondClaimed")
      .withArgs(
        user.address,
        calculatedTokens1[0],
        calculatedTokens1[1],
        false
      );
    console.log("Claim Successful");

    await mineBlocks(ethers.provider, 485);
    console.log("8 minutes ended. So total claims are available");

    let calculatedTokens2 = await bonds.claimPASSAvailable(
      calculatedTokens1[1],
      userTotalTokens.sub(calculatedTokens1[0]),
      user.address,
      busd.address
    );
    console.log("Available PASS: ", calculatedTokens2.toString());

    console.log("Claiming..");
    await expect(bonds.connect(user).claimPASSTokens(busd.address))
      .to.emit(bonds, "PASSBondClaimed")
      .withArgs(user.address, userTotalTokens, calculatedTokens2[1], true);
    console.log("Claim Successful");

    let userPassBalance = await pass.balanceOf(user.address);
    console.log("User Pass Balance: ", userPassBalance.toString());

    // Expect
    expect(userPassBalance.toString()).to.be.eq(userTotalTokens.toString());
  });

  it("Buying another pass bond after 1 claim becomes available", async () => {
    // Adding LP for busd
    await bonds.addNewLP(busd.address, zeroAddress, zeroAddress);
    console.log("BUSD LP added");

    await busd
      .connect(user)
      .approve(bonds.address, convertWithDecimal(100, 10 ** 8));

    console.log("Buying PASS tokens..");
    await bonds
      .connect(user)
      .buyPASSBonds(busd.address, convertWithDecimal(10, 10 ** 8));
    console.log("Bought");

    await mineBlocks(ethers.provider, 125);
    console.log("2 minutes passes. So 1st claim is available");

    let userTotalTokens = await (
      await bonds.exchangePASSMapping(user.address, busd.address)
    ).PASSTokenAmount;
    console.log("Total PASS to be claimed: ", userTotalTokens.toString());

    let calculatedTokens1 = await bonds.claimPASSAvailable(
      0,
      userTotalTokens,
      user.address,
      busd.address
    );
    console.log("Available PASS: ", calculatedTokens1.toString());

    let userInitialPassBal = await pass.balanceOf(user.address);
    console.log("User's initial balance: ", userInitialPassBal.toString());

    console.log("Buying some more bonds..");
    await bonds
      .connect(user)
      .buyPASSBonds(busd.address, convertWithDecimal(10, 10 ** 8));
    console.log("Bought");

    let totalPassInVesting = await (
      await bonds.exchangePASSMapping(user.address, busd.address)
    ).PASSTokenAmount;
    console.log("Total PASS: ", totalPassInVesting.toString());

    let userFinalPassBal = await pass.balanceOf(user.address);
    console.log(
      "User's final balance (Automatic claim): ",
      userFinalPassBal.toString()
    );

    let totalPassLeftToClaim = (
      await (await bonds.exchangePASSMapping(user.address, busd.address))
        .PASSTokenAmount
    ).sub(
      await (await bonds.exchangePASSMapping(user.address, busd.address))
        .PASSTokenClaimed
    );
    console.log("Total PASS left to claim: ", totalPassLeftToClaim.toString());

    // Expect
    expect(totalPassLeftToClaim.toString()).to.be.eq(
      userTotalTokens.add(userTotalTokens).sub(userFinalPassBal).toString()
    );
  });

  it("Autostake functionality", async () => {
    vpass = await new XFA__factory(owner).deploy("vPASS", "vPASS", 8);

    await pass.mint(user.address, convertWithDecimal(100000, 10 ** 8));

    currency1 = await new SampleToken__factory(owner).deploy(
      "C1",
      "Currency 1",
      8
    );

    staking = await new PassStaking__factory(owner).deploy();
    await staking.initialize(owner.address, pass.address, vpass.address);

    await staking.updateBondAddress(bonds.address);
    await bonds.updatePassStakingAddress(staking.address);

    // Adding currencies
    await expect(
      staking.addBetCurrencyInfo(1, currency1.address, currency1.address)
    )
      .to.emit(staking, "CurrencyAdded")
      .withArgs(1, currency1.address, currency1.address, true);

    await pass
      .connect(user)
      .approve(staking.address, convertWithDecimal(100000000, 10 ** 8));
    await vpass
      .connect(user)
      .approve(staking.address, convertWithDecimal(100000000, 10 ** 8));

    await vpass.transferOwnership(staking.address);

    // Adding Penalty Info
    await staking.addUpdateLockup(1, 100, 100);
    await staking.addUpdateLockup(2, 200, 200);
    await staking.addUpdateLockup(3, 300, 300);

    // Adding LP for busd
    await bonds.addNewLP(busd.address, zeroAddress, zeroAddress);
    console.log("BUSD LP added");

    await busd
      .connect(user)
      .approve(bonds.address, convertWithDecimal(100, 10 ** 8));

    let discountedPass = await bonds.calculateDiscountedPASS(
      busd.address,
      convertWithDecimal(100, 10 ** 8)
    );

    console.log("Autostaking..");
    await bonds
      .connect(user)
      .buyPASSBondsAutoStake(
        busd.address,
        convertWithDecimal(100, 10 ** 8),
        currency1.address,
        1,
        true
      );

    let userStakeInfo = await staking.userMapping(
      user.address,
      currency1.address
    );
    console.log("User Stake Info: ", userStakeInfo.toString());

    let availableTokens1 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available Token 1: ", availableTokens1.toString());

    // Expect
    expect(availableTokens1).to.be.eq(0);

    await mineBlocks(ethers.provider, 122);
    console.log("1st slot time ends");

    let availableTokens2 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available Token 2: ", availableTokens2.toString());

    //Expect
    expect(availableTokens2.toString()).to.be.eq(
      (Number(discountedPass) / 3).toString()
    );

    await mineBlocks(ethers.provider, 122);
    console.log("2nd slot time ends");

    let availableTokens3 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available Token 3: ", availableTokens3.toString());

    //Expect
    expect(availableTokens3.toString()).to.be.eq(
      (Number(discountedPass.mul(2)) / 3).toString()
    );

    await mineBlocks(ethers.provider, 122);
    console.log("3rd slot time ends");

    let availableTokens4 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available Token 4: ", availableTokens4.toString());
    //Expect
    expect(availableTokens4.toString()).to.be.eq(discountedPass.toString());
  });

  it("Autostake Rewards", async () => {
    vpass = await new XFA__factory(owner).deploy("vPASS", "vPASS", 8);

    await pass.mint(user.address, convertWithDecimal(100000, 10 ** 8));

    currency1 = await new SampleToken__factory(owner).deploy(
      "C1",
      "Currency 1",
      8
    );

    staking = await new PassStaking__factory(owner).deploy();
    await staking.initialize(owner.address, pass.address, vpass.address);

    await staking.updateBondAddress(bonds.address);
    await bonds.updatePassStakingAddress(staking.address);

    // Adding currencies
    await expect(
      staking.addBetCurrencyInfo(1, currency1.address, currency1.address)
    )
      .to.emit(staking, "CurrencyAdded")
      .withArgs(1, currency1.address, currency1.address, true);

    await pass
      .connect(user)
      .approve(staking.address, convertWithDecimal(100000000, 10 ** 8));
    await vpass
      .connect(user)
      .approve(staking.address, convertWithDecimal(100000000, 10 ** 8));

    await vpass.transferOwnership(staking.address);

    // Adding Penalty Info
    await staking.addUpdateLockup(1, 100, 100);
    await staking.addUpdateLockup(2, 200, 200);
    await staking.addUpdateLockup(3, 300, 300);

    // Adding LP for busd
    await bonds.addNewLP(busd.address, zeroAddress, zeroAddress);
    console.log("BUSD LP added");

    await busd
      .connect(user)
      .approve(bonds.address, convertWithDecimal(100, 10 ** 8));

    console.log("Autostaking..");
    await bonds
      .connect(user)
      .buyPASSBondsAutoStake(
        busd.address,
        convertWithDecimal(100, 10 ** 8),
        currency1.address,
        1,
        true
      );

    let userStakeInfo = await staking.userMapping(
      user.address,
      currency1.address
    );
    console.log("User Stake Info: ", userStakeInfo.toString());

    let discountedPass = await bonds.calculateDiscountedPASS(
      busd.address,
      convertWithDecimal(100, 10 ** 8)
    );

    let calculatedRewards1 = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Calculated Rewards 1: ", calculatedRewards1.toString());

    // Expect
    expect(calculatedRewards1[0]).to.be.eq(0);

    await mineBlocks(ethers.provider, 125);

    let expectedRewards2 = Math.floor(
      ((Number(discountedPass) / 3) *
        Number(await (await staking.lockupMapping(1)).dailyRewardPercentage)) /
        10 ** 12
    );

    let calculatedRewards2 = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Calculated Rewards 2: ", calculatedRewards2.toString());

    // Expect
    expect(calculatedRewards2[0].toString()).to.be.eq(
      expectedRewards2.toString()
    );

    await mineBlocks(ethers.provider, 125);

    let expectedRewards3 = Math.floor(
      (2 *
        ((Number(discountedPass) * 2) / 3) *
        Number(await (await staking.lockupMapping(1)).dailyRewardPercentage)) /
        10 ** 12
    );

    let calculatedRewards3 = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Calculated Rewards 3: ", calculatedRewards3.toString());

    // Expect
    expect(calculatedRewards3[0].toString()).to.be.eq(
      expectedRewards3.toString()
    );

    await mineBlocks(ethers.provider, 125);

    let expectedRewards4 = Math.floor(
      (3 *
        (Number(discountedPass) *
          Number(
            await (await staking.lockupMapping(1)).dailyRewardPercentage
          ))) /
        10 ** 12
    );

    let calculatedRewards4 = await staking.calculateRewards(
      user.address,
      currency1.address
    );
    console.log("Calculated Rewards 4: ", calculatedRewards4.toString());

    // Expect
    expect(calculatedRewards4[0].toString()).to.be.eq(
      expectedRewards4.toString()
    );
  });

  it("Autostake unstakes amount", async () => {
    vpass = await new XFA__factory(owner).deploy("vPASS", "vPASS", 8);

    await pass.mint(user.address, convertWithDecimal(100000, 10 ** 8));

    currency1 = await new SampleToken__factory(owner).deploy(
      "C1",
      "Currency 1",
      8
    );

    staking = await new PassStaking__factory(owner).deploy();
    await staking.initialize(owner.address, pass.address, vpass.address);

    await staking.updateBondAddress(bonds.address);
    await bonds.updatePassStakingAddress(staking.address);

    // Adding currencies
    await expect(
      staking.addBetCurrencyInfo(1, currency1.address, currency1.address)
    )
      .to.emit(staking, "CurrencyAdded")
      .withArgs(1, currency1.address, currency1.address, true);

    await pass
      .connect(user)
      .approve(staking.address, convertWithDecimal(100000000, 10 ** 8));
    await vpass
      .connect(user)
      .approve(staking.address, convertWithDecimal(100000000, 10 ** 8));

    await vpass.transferOwnership(staking.address);

    // Adding Penalty Info
    await staking.addUpdateLockup(1, 100, 100);
    await staking.addUpdateLockup(2, 200, 200);
    await staking.addUpdateLockup(3, 300, 300);

    // Adding LP for busd
    await bonds.addNewLP(busd.address, zeroAddress, zeroAddress);
    console.log("BUSD LP added");

    await busd
      .connect(user)
      .approve(bonds.address, convertWithDecimal(100, 10 ** 8));

    console.log("Autostaking..");
    await bonds
      .connect(user)
      .buyPASSBondsAutoStake(
        busd.address,
        convertWithDecimal(100, 10 ** 8),
        currency1.address,
        1,
        true
      );

    let userStakeInfo = await staking.userMapping(
      user.address,
      currency1.address
    );
    console.log("User Stake Info: ", userStakeInfo.toString());

    console.log(
      "Available PASS to unstake: ",
      (
        await staking.availableStake(user.address, currency1.address, 1)
      ).toString()
    );

    console.log("Trying to Unstake.. (Expected to fail)");
    // Expect
    await expect(
      staking.connect(user).unStakePASS(currency1.address, 123)
    ).to.be.revertedWith("Amount cannot be more than the PASS available");
    console.log("Fails");

    await mineBlocks(ethers.provider, 125);
    console.log("125 seconds passed. Some amount should be available");

    let availableStake1 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake1.toString());

    console.log("Trying to Unstake..");
    await staking.connect(user).unStakePASS(currency1.address, availableStake1);
    console.log("Unstaked");

    let availableStake2 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake2.toString());

    console.log(
      "User Stake info: ",
      (await staking.userMapping(user.address, currency1.address)).toString()
    );

    await mineBlocks(ethers.provider, 125);
    console.log("125 seconds passed. Some amount should be available");

    let availableStake3 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake3.toString());

    console.log("Trying to Unstake..");
    await staking.connect(user).unStakePASS(currency1.address, availableStake1);
    console.log("Unstaked");

    let availableStake4 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake4.toString());

    await mineBlocks(ethers.provider, 125);
    console.log("125 seconds passed. Some amount should be available");

    let availableStake5 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake5.toString());

    console.log("Trying to Unstake..");
    await staking.connect(user).unStakePASS(currency1.address, availableStake1);
    console.log("Unstaked");

    let availableStake6 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake6.toString());

    await mineBlocks(ethers.provider, 125);
    console.log("125 seconds passed. Amount should remain zero");

    let availableStake7 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake7.toString());

    // Expect
    expect(availableStake7).to.be.eq(0);

    let userStakeInfo1 = await staking.userMapping(
      user.address,
      currency1.address
    );
    console.log("User Stake Info: ", userStakeInfo1.toString());
  });

  it("Autostakes and then unstakes partial amount", async () => {
    vpass = await new XFA__factory(owner).deploy("vPASS", "vPASS", 8);

    await pass.mint(user.address, convertWithDecimal(100000, 10 ** 8));

    currency1 = await new SampleToken__factory(owner).deploy(
      "C1",
      "Currency 1",
      8
    );

    staking = await new PassStaking__factory(owner).deploy();
    await staking.initialize(owner.address, pass.address, vpass.address);

    await staking.updateBondAddress(bonds.address);
    await bonds.updatePassStakingAddress(staking.address);

    // Adding currencies
    await expect(
      staking.addBetCurrencyInfo(1, currency1.address, currency1.address)
    )
      .to.emit(staking, "CurrencyAdded")
      .withArgs(1, currency1.address, currency1.address, true);

    await pass
      .connect(user)
      .approve(staking.address, convertWithDecimal(100000000, 10 ** 8));
    await vpass
      .connect(user)
      .approve(staking.address, convertWithDecimal(100000000, 10 ** 8));

    await vpass.transferOwnership(staking.address);

    // Adding Penalty Info
    await staking.addUpdateLockup(1, 100, 100);
    await staking.addUpdateLockup(2, 200, 200);
    await staking.addUpdateLockup(3, 300, 300);

    // Adding LP for busd
    await bonds.addNewLP(busd.address, zeroAddress, zeroAddress);
    console.log("BUSD LP added");

    await busd
      .connect(user)
      .approve(bonds.address, convertWithDecimal(100, 10 ** 8));

    console.log("Autostaking..");
    await bonds
      .connect(user)
      .buyPASSBondsAutoStake(
        busd.address,
        convertWithDecimal(100, 10 ** 8),
        currency1.address,
        1,
        true
      );

    let userStakeInfo = await staking.userMapping(
      user.address,
      currency1.address
    );
    console.log("User Stake Info: ", userStakeInfo.toString());

    console.log(
      "Available PASS to unstake: ",
      (
        await staking.availableStake(user.address, currency1.address, 1)
      ).toString()
    );

    await mineBlocks(ethers.provider, 125);
    console.log("125 seconds passed. Some amount should be available");

    let availableStake1 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake1.toString());

    console.log("Trying to Unstake half of the amount..");
    await staking
      .connect(user)
      .unStakePASS(currency1.address, availableStake1.div(2));
    console.log("Unstaked");

    let availableStake2 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake2.toString());

    console.log(
      "User Stake info: ",
      (await staking.userMapping(user.address, currency1.address)).toString()
    );

    console.log(
      "Rewards: ",
      (
        await staking.calculateRewards(user.address, currency1.address)
      )[0].toString()
    );

    await mineBlocks(ethers.provider, 125);
    console.log("125 seconds passed. Some amount should be available");

    let availableStake3 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake3.toString());

    let newUnstake = availableStake3.div(2);

    console.log("Unstaking 1/2 of available tokens..");

    await staking.connect(user).unStakePASS(currency1.address, newUnstake);
    console.log("Unstaked");

    let userStakeInfoNew = await staking.userMapping(
      user.address,
      currency1.address
    );
    console.log("User Stake Info: ", userStakeInfoNew.toString());

    let availableStake4 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake4.toString());

    await mineBlocks(ethers.provider, 125);
    console.log("125 seconds passed. Some amount should be available");

    let availableStake5 = await staking.availableStake(
      user.address,
      currency1.address,
      1
    );
    console.log("Available PASS to unstake: ", availableStake5.toString());
  });
});
