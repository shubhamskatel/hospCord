import { CalHash, CalHash__factory } from "../typechain";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat";

describe("CalHash", async () => {
  let calHash: CalHash;
  let owner: SignerWithAddress;
  let signers: SignerWithAddress[];

  it("Returns CalHash Value", async () => {
    signers = await ethers.getSigners();
    owner = signers[0];

    calHash = await new CalHash__factory(owner).deploy();
    let value = await calHash.getInitHash();
    console.log("Cal Hash: ", value);
  });
});
