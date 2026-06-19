const hre = require("hardhat");

// Deployed MiniNFT on Base Sepolia.
const ADDRESS = "0xA17CEfaa527aAd9FAe10012D2457200BD4832079";

async function main() {
  const nft = await hre.ethers.getContractAt("MiniNFT", ADDRESS);

  console.log("MiniNFT:", ADDRESS);
  console.log("Name:", await nft.name());
  console.log("Symbol:", await nft.symbol());
  console.log("Owner:", await nft.owner());
  console.log("Mint price:", hre.ethers.formatEther(await nft.MINT_PRICE()), "ETH");
  console.log("Max per wallet:", (await nft.MAX_PER_WALLET()).toString());
  console.log(
    "Minted:",
    `${await nft.totalMinted()} / ${await nft.MAX_SUPPLY()}`
  );
  console.log("Remaining:", (await nft.remaining()).toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
