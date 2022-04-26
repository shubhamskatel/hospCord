const hre = require("hardhat");

async function main() {
  await hre.run("verify:verify", {
    //Deployed contract address
    address: "0x09fD07f659cBf7465D3bE14A241A42658696c65b",
    //Pass arguments as string and comma seprated values
    constructorArguments: ["KYSO", "KYSO", "18", "0x2336dC01dd61e53371c79F88D697efBEC2c56B1A"],
    //Path of your main contract.
    contract: "contracts/KYSO.sol:KYSO",
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
//npx hardhat run --network rinkeby  scripts/verify.ts
