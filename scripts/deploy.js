const hre = require("hardhat");

async function main() {
  // ---- Collection settings (tweak before deploying) --------------------------
  const NAME = "Base Mini NFT";
  const SYMBOL = "BMINI";
  const MAX_SUPPLY = 100n;
  const MINT_PRICE = hre.ethers.parseEther("0.0001"); // cheap on testnet
  const MAX_PER_WALLET = 5n;
  // Placeholder metadata. Point this at your IPFS/HTTP folder later via setBaseURI.
  const BASE_URI = "ipfs://replace-with-your-cid/";
  // ---------------------------------------------------------------------------

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Factory = await hre.ethers.getContractFactory("MiniNFT");
  const nft = await Factory.deploy(
    NAME,
    SYMBOL,
    MAX_SUPPLY,
    MINT_PRICE,
    MAX_PER_WALLET,
    BASE_URI
  );
  await nft.waitForDeployment();

  const address = await nft.getAddress();
  console.log("MiniNFT deployed to:", address);
  console.log("Explorer:", `https://sepolia.basescan.org/address/${address}`);
  console.log("\nUpdate frontend/app.js -> CONTRACT_ADDRESS with this address.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
