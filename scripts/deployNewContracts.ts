import { ethers } from "hardhat";
import {
  OwnedUpgradeabilityProxy__factory,
  OwnedUpgradeabilityProxy,
  PassBonds,
  PassBonds__factory,
  PassStaking,
  PassStaking__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
let bonds: PassBonds;
let staking: PassStaking;
let proxyForBonds: PassBonds;
let proxyForStaking: PassStaking;
let proxyBonds: OwnedUpgradeabilityProxy;
let proxyStaking: OwnedUpgradeabilityProxy;
let owner: SignerWithAddress;
let signers: SignerWithAddress[];

async function main() {
  signers = await ethers.getSigners();
  owner = signers[0];

  // ======================== FOR BONDS ========================
  console.log("Deployement started");

  // bonds = await new PassBonds__factory(owner).deploy();
  // console.log("Bonds deployed");

  // proxyBonds = await new OwnedUpgradeabilityProxy__factory(owner).attach(
  //   "0xBC38A06aA04E4C0a9c163593dfE54492c860c73a"
  // );

  // await proxyBonds.upgradeTo(bonds.address);

  // // proxyForBonds = await new PassBonds__factory(owner).attach(
  // //   proxyBonds.address
  // // );
  // // await proxyForBonds.setInitialValues();
  // console.log("Bonds updated");

  // ======================== FOR STAKING ========================
  console.log("Staking started");

  staking = await new PassStaking__factory(owner).deploy();
  console.log("Staking deployed");

  proxyStaking = await new OwnedUpgradeabilityProxy__factory(owner).attach(
    "0xEc6ed3301B5Cdd7774DF4E2681EE5Ffb64a2084F"
  );
  console.log("Attached");

  let abc = await proxyStaking.upgradeTo(staking.address);
  console.log("-----------------------abc-------------------------", abc);

  // proxyForStaking = await new PassStaking__factory(owner).attach(
  //   proxyStaking.address
  // );
  // await proxyForStaking.setInitialValues();
  console.log(`Staking updated`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
//npx hardhat run --network testnet scripts/deployNewContracts.ts
