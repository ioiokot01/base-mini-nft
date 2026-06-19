const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("MiniNFT", function () {
  const NAME = "Base Mini NFT";
  const SYMBOL = "BMINI";
  const MAX_SUPPLY = 100n;
  const MINT_PRICE = ethers.parseEther("0.001");
  const MAX_PER_WALLET = 5n;
  const BASE_URI = "ipfs://demo/";

  async function deploy() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MiniNFT");
    const nft = await Factory.deploy(
      NAME,
      SYMBOL,
      MAX_SUPPLY,
      MINT_PRICE,
      MAX_PER_WALLET,
      BASE_URI
    );
    await nft.waitForDeployment();
    return { nft, owner, alice, bob };
  }

  describe("Deployment", function () {
    it("sets name, symbol and config", async function () {
      const { nft, owner } = await deploy();
      expect(await nft.name()).to.equal(NAME);
      expect(await nft.symbol()).to.equal(SYMBOL);
      expect(await nft.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
      expect(await nft.MINT_PRICE()).to.equal(MINT_PRICE);
      expect(await nft.MAX_PER_WALLET()).to.equal(MAX_PER_WALLET);
      expect(await nft.owner()).to.equal(owner.address);
      expect(await nft.totalMinted()).to.equal(0n);
      expect(await nft.remaining()).to.equal(MAX_SUPPLY);
    });

    it("rejects a zero max supply", async function () {
      const Factory = await ethers.getContractFactory("MiniNFT");
      await expect(
        Factory.deploy(NAME, SYMBOL, 0, MINT_PRICE, MAX_PER_WALLET, BASE_URI)
      ).to.be.revertedWith("Max supply must be > 0");
    });
  });

  describe("Minting", function () {
    it("mints a token to the caller and emits Minted", async function () {
      const { nft, alice } = await deploy();
      await expect(nft.connect(alice).mint(1, { value: MINT_PRICE }))
        .to.emit(nft, "Minted")
        .withArgs(alice.address, 1);

      expect(await nft.ownerOf(1)).to.equal(alice.address);
      expect(await nft.balanceOf(alice.address)).to.equal(1n);
      expect(await nft.totalMinted()).to.equal(1n);
      expect(await nft.mintedBy(alice.address)).to.equal(1n);
    });

    it("mints multiple in one tx with sequential ids", async function () {
      const { nft, alice } = await deploy();
      await nft.connect(alice).mint(3, { value: MINT_PRICE * 3n });
      expect(await nft.totalMinted()).to.equal(3n);
      expect(await nft.ownerOf(1)).to.equal(alice.address);
      expect(await nft.ownerOf(2)).to.equal(alice.address);
      expect(await nft.ownerOf(3)).to.equal(alice.address);
    });

    it("accepts overpayment", async function () {
      const { nft, alice } = await deploy();
      await expect(
        nft.connect(alice).mint(1, { value: MINT_PRICE * 2n })
      ).to.emit(nft, "Minted");
    });

    it("rejects zero quantity", async function () {
      const { nft, alice } = await deploy();
      await expect(
        nft.connect(alice).mint(0, { value: 0 })
      ).to.be.revertedWith("Quantity must be > 0");
    });

    it("rejects more than max per tx", async function () {
      const { nft, alice } = await deploy();
      await expect(
        nft.connect(alice).mint(11, { value: MINT_PRICE * 11n })
      ).to.be.revertedWith("Exceeds max per tx");
    });

    it("rejects insufficient payment", async function () {
      const { nft, alice } = await deploy();
      await expect(
        nft.connect(alice).mint(2, { value: MINT_PRICE })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("enforces the per-wallet limit across txs", async function () {
      const { nft, alice } = await deploy();
      await nft.connect(alice).mint(5, { value: MINT_PRICE * 5n });
      await expect(
        nft.connect(alice).mint(1, { value: MINT_PRICE })
      ).to.be.revertedWith("Exceeds per-wallet limit");
    });

    it("enforces the max supply", async function () {
      // Deploy a tiny collection so we can hit the cap cheaply.
      const Factory = await ethers.getContractFactory("MiniNFT");
      const [, alice, bob] = await ethers.getSigners();
      const small = await Factory.deploy(NAME, SYMBOL, 3, MINT_PRICE, 10, BASE_URI);
      await small.waitForDeployment();

      await small.connect(alice).mint(3, { value: MINT_PRICE * 3n });
      expect(await small.remaining()).to.equal(0n);
      await expect(
        small.connect(bob).mint(1, { value: MINT_PRICE })
      ).to.be.revertedWith("Exceeds max supply");
    });
  });

  describe("Token metadata", function () {
    it("returns baseURI + id + .json", async function () {
      const { nft, alice } = await deploy();
      await nft.connect(alice).mint(1, { value: MINT_PRICE });
      expect(await nft.tokenURI(1)).to.equal("ipfs://demo/1.json");
    });

    it("reverts tokenURI for a non-existent token", async function () {
      const { nft } = await deploy();
      await expect(nft.tokenURI(999)).to.be.reverted;
    });

    it("lets the owner update the base URI", async function () {
      const { nft, owner, alice } = await deploy();
      await nft.connect(alice).mint(1, { value: MINT_PRICE });
      await expect(nft.connect(owner).setBaseURI("ipfs://new/"))
        .to.emit(nft, "BaseURIUpdated")
        .withArgs("ipfs://new/");
      expect(await nft.tokenURI(1)).to.equal("ipfs://new/1.json");
    });

    it("blocks non-owners from updating the base URI", async function () {
      const { nft, alice } = await deploy();
      await expect(nft.connect(alice).setBaseURI("ipfs://hack/")).to.be.reverted;
    });
  });

  describe("Withdraw", function () {
    it("lets the owner withdraw collected funds", async function () {
      const { nft, owner, alice } = await deploy();
      await nft.connect(alice).mint(3, { value: MINT_PRICE * 3n });
      // changeEtherBalance can't be chained after emit, so assert separately.
      await expect(nft.connect(owner).withdraw()).to.changeEtherBalance(
        owner,
        MINT_PRICE * 3n
      );
    });

    it("blocks non-owners from withdrawing", async function () {
      const { nft, alice } = await deploy();
      await nft.connect(alice).mint(1, { value: MINT_PRICE });
      await expect(nft.connect(alice).withdraw()).to.be.reverted;
    });

    it("reverts when there is nothing to withdraw", async function () {
      const { nft, owner } = await deploy();
      await expect(nft.connect(owner).withdraw()).to.be.revertedWith(
        "Nothing to withdraw"
      );
    });
  });
});
