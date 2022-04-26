import { ethers } from "hardhat";
import {
  OwnedUpgradeabilityProxy__factory,
  OwnedUpgradeabilityProxy,
  PassBonds,
  PassBonds__factory,
  PassStaking,
  PassStaking__factory,
  XFA,
  XFA__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { convertWithDecimal, zeroAddress } from "../test/utilities/utilities";
let bonds: PassBonds;
let proxyBonds: PassBonds;
let staking: PassStaking;
let proxyStaking: PassStaking;
let proxyForBonds: OwnedUpgradeabilityProxy;
let proxyForStaking: OwnedUpgradeabilityProxy;
let pass: XFA;
let vPass: XFA;
let owner: SignerWithAddress;
let signers: SignerWithAddress[];

async function main() {
  signers = await ethers.getSigners();
  owner = signers[0];

  // ========================= FOR BONDS =========================
  console.log("Bond started..");

  bonds = await new PassBonds__factory(owner).deploy();
  await bonds.deployed();
  console.log("Bonds deployed: ", bonds.address);

  await bonds.initialize(owner.address);
  console.log("Initialized");

  pass = await new XFA__factory(owner).attach(
    "0x35306a5b9E4bd42b4CFeb35a69b6F0cE9d5De46c"
  );

  await pass.mint(bonds.address, convertWithDecimal(100000, 10 ** 8));

  let wbnb = await bonds.WBNB();
  console.log("WBNB: ", wbnb);

  console.log("LPs adding started..");

  // Updating LPs and Token addresses
  // XIV-BNB LP
  await bonds.addNewLP(
    "0x4dacB13d2AC5043868760e52E883cb0b1C5fB9E0",
    "0x77EA6eCe622b06Eab706A2653e6A21a72C21Ecf0",
    wbnb
  );

  // XIV Token
  await bonds.addNewLP(
    "0x77EA6eCe622b06Eab706A2653e6A21a72C21Ecf0",
    zeroAddress,
    zeroAddress
  );

  // BUSD Token
  await bonds.addNewLP(
    "0xb57481AB82CF558b411dA2Aa60D9d5C2E93181D6",
    zeroAddress,
    zeroAddress
  );

  // PASS-BNB LP
  await bonds.addNewLP(
    "0xbB0520DD885aA13D5391b55b19120446c00249EB",
    "0x35306a5b9E4bd42b4CFeb35a69b6F0cE9d5De46c",
    wbnb
  );

  // WBNB
  await bonds.addNewLP(wbnb, zeroAddress, zeroAddress);

  console.log("LPs added");
  console.log("Bonds Deployed");

  // ========================= FOR STAKING =========================

  console.log("Staking started..");

  staking = await new PassStaking__factory(owner).deploy();
  await staking.deployed();
  console.log("Staking Deployed: ", staking.address);

  vPass = await new XFA__factory(owner).deploy("vPASS", "vPASS", 8);
  await vPass.deployed();
  console.log("vPASS Deployed: ", vPass.address);

  await staking.initialize(
    owner.address,
    "0x35306a5b9E4bd42b4CFeb35a69b6F0cE9d5De46c",
    vPass.address
  );
  console.log("Initialized");

  await pass.mint(staking.address, convertWithDecimal(100000, 10 ** 8));

  await vPass.transferOwnership(staking.address);

  await staking.updateBondAddress(bonds.address);

  console.log("Penalty Info started..");
  await staking.addUpdateLockup(1, 100, 100);
  await staking.addUpdateLockup(2, 200, 200);
  await staking.addUpdateLockup(3, 300, 300);

  console.log("Currency Addition started");
  // ETH
  await staking.addBetCurrencyInfo(
    1,
    "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7",
    "0xF1aCA00483afAe744C52A7a9b91e0e684703FdcC"
  );

  // SOL
  await staking.addBetCurrencyInfo(
    1,
    "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7",
    "0xD27CcAF18b39Edcda76c70974253b19aD1Fb787F"
  );

  // AVAX
  await staking.addBetCurrencyInfo(
    1,
    "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7",
    "0x09FE9f8384D9Dd02ee6599E2C7c94611eA2E266b"
  );

  // MATIC
  await staking.addBetCurrencyInfo(
    1,
    "0x957Eb0316f02ba4a9De3D308742eefd44a3c1719",
    "0x065c937061B694E6e7d786f92cd6933f5F7CD245"
  );

  // BNB
  await staking.addBetCurrencyInfo(
    1,
    "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526",
    "0x9273142D77B202d07af28099D94D17aEfD8c1357"
  );

  console.log("Staking deployed");

  console.log(`PASS Contract deployed at : ${pass.address} `);
  console.log(`Proxy Pass Bonds Contract deployed at : ${bonds.address} `);
  console.log(`Proxy Pass Staking Contract deployed at : ${staking.address} `);
  console.log(`vPASS Contract deployed at : ${vPass.address} `);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
//npx hardhat run --network testnet scripts/deploy.ts

// import { ethers } from "hardhat";
// import {
//   OwnedUpgradeabilityProxy__factory,
//   OwnedUpgradeabilityProxy,
//   PassBonds,
//   PassBonds__factory,
//   PassStaking,
//   PassStaking__factory,
//   XFA,
//   XFA__factory,
// } from "../typechain";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { convertWithDecimal, zeroAddress } from "../test/utilities/utilities";
// let bonds: PassBonds;
// let proxyBonds: PassBonds;
// let staking: PassStaking;
// let proxyStaking: PassStaking;
// let proxyForBonds: OwnedUpgradeabilityProxy;
// let proxyForStaking: OwnedUpgradeabilityProxy;
// let pass: XFA;
// let vPass: XFA;
// let owner: SignerWithAddress;
// let signers: SignerWithAddress[];

// async function main() {
//   signers = await ethers.getSigners();
//   owner = signers[0];

//   // // ========================= FOR BONDS =========================
//   console.log("Bond started..");

//   bonds = await new PassBonds__factory(owner).deploy();
//   console.log("Bonds deployed: ", bonds.address);

//   proxyForBonds = await new OwnedUpgradeabilityProxy__factory(owner).deploy();
//   console.log("Proxy deployed: ", proxyForBonds.address);

//   const initializeDataBonds = await bonds.interface.encodeFunctionData(
//     "initialize",
//     [owner.address]
//   );

//   await proxyForBonds.upgradeToAndCall(bonds.address, initializeDataBonds);
//   console.log("Proxy updated");

//   proxyBonds = await new PassBonds__factory(owner).attach(
//     proxyForBonds.address
//   );
//   console.log("Address attached");

//   let token = await proxyBonds.PASSToken();
//   console.log("PASS: ", token);

//   pass = await new XFA__factory(owner).attach(token);
//   await pass.mint(proxyBonds.address, convertWithDecimal(100000, 10 ** 8));

//   let wbnb = await proxyBonds.WBNB();
//   console.log("WBNB: ", wbnb);

//   console.log("LPs adding started..");

//   // Updating LPs and Token addresses
//   // XIV-BNB LP
//   await proxyBonds.addNewLP(
//     "0x4dacB13d2AC5043868760e52E883cb0b1C5fB9E0",
//     "0x77EA6eCe622b06Eab706A2653e6A21a72C21Ecf0",
//     wbnb
//   );

//   // XIV Token
//   await proxyBonds.addNewLP(
//     "0x77EA6eCe622b06Eab706A2653e6A21a72C21Ecf0",
//     zeroAddress,
//     zeroAddress
//   );

//   // BUSD Token
//   await proxyBonds.addNewLP(
//     "0xb57481AB82CF558b411dA2Aa60D9d5C2E93181D6",
//     zeroAddress,
//     zeroAddress
//   );

//   // PASS-BNB LP
//   await proxyBonds.addNewLP(
//     "0xbB0520DD885aA13D5391b55b19120446c00249EB",
//     "0x35306a5b9E4bd42b4CFeb35a69b6F0cE9d5De46c",
//     wbnb
//   );

//   // WBNB
//   await proxyBonds.addNewLP(wbnb, zeroAddress, zeroAddress);

//   console.log("LPs added");
//   console.log("Bonds Deployed");

//   // ========================= FOR STAKING =========================

//   console.log("Staking started..");

//   staking = await new PassStaking__factory(owner).deploy();
//   await staking.deployed();
//   console.log("Staking Deployed: ", staking.address);

//   proxyForStaking = await new OwnedUpgradeabilityProxy__factory(owner).deploy();
//   await proxyForStaking.deployed();
//   console.log("Proxy for staking Deployed: ", proxyForStaking.address);

//   vPass = await new XFA__factory(owner).deploy("vPASS", "vPASS", 8);
//   await vPass.deployed();
//   console.log("vPASS Deployed: ", vPass.address);

//   const initializeDataStaking = await staking.interface.encodeFunctionData(
//     "initialize",
//     [owner.address, "0x35306a5b9E4bd42b4CFeb35a69b6F0cE9d5De46c", vPass.address]
//   );

//   await proxyForStaking.upgradeToAndCall(
//     staking.address,
//     initializeDataStaking
//   );
//   console.log("Upgraded");

//   proxyStaking = await new PassStaking__factory(owner).attach(
//     proxyForStaking.address
//   );
//   console.log("Attached");

//   await pass.mint(proxyStaking.address, convertWithDecimal(100000, 10 ** 8));

//   await vPass.transferOwnership(proxyStaking.address);

//   console.log("Penalty Info started..");
//   await proxyStaking.addUpdateLockup(1, 100, 100);
//   await proxyStaking.addUpdateLockup(2, 200, 200);
//   await proxyStaking.addUpdateLockup(3, 300, 300);

//   console.log("Currency Addition started");
//   // ETH
//   await proxyStaking.addBetCurrencyInfo(
//     1,
//     "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7",
//     "0xF1aCA00483afAe744C52A7a9b91e0e684703FdcC"
//   );

//   // SOL
//   await proxyStaking.addBetCurrencyInfo(
//     1,
//     "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7",
//     "0xD27CcAF18b39Edcda76c70974253b19aD1Fb787F"
//   );

//   // AVAX
//   await proxyStaking.addBetCurrencyInfo(
//     1,
//     "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7",
//     "0x09FE9f8384D9Dd02ee6599E2C7c94611eA2E266b"
//   );

//   // MATIC
//   await proxyStaking.addBetCurrencyInfo(
//     1,
//     "0x957Eb0316f02ba4a9De3D308742eefd44a3c1719",
//     "0x065c937061B694E6e7d786f92cd6933f5F7CD245"
//   );

//   // BNB
//   await proxyStaking.addBetCurrencyInfo(
//     1,
//     "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526",
//     "0x9273142D77B202d07af28099D94D17aEfD8c1357"
//   );

//   console.log("Staking deployed");

//   console.log(`PASS Contract deployed at : ${token} `);
//   console.log(`Proxy Pass Bonds Contract deployed at : ${proxyBonds.address} `);
//   console.log(
//     `Proxy Pass Staking Contract deployed at : ${proxyStaking.address} `
//   );
//   console.log(`vPASS Contract deployed at : ${vPass.address} `);
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
// //npx hardhat run --network testnet scripts/deploy.ts
