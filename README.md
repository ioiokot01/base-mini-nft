# MiniNFT

A minimal **ERC-721** NFT collection + mint dApp for the [Base](https://base.org)
ecosystem. Anyone can mint (paying the mint price), supply is capped, and a
per-wallet limit keeps it fair. The owner manages metadata and withdraws funds.

Project 3 in a learning series (after the Onchain Guestbook and TipJar). New
concepts: the **ERC-721 standard**, building on **OpenZeppelin's** audited
contracts, on-chain **supply caps & per-wallet limits**, and **token metadata**
(`tokenURI` / `baseURI`).

## Stack

- [Hardhat 2](https://hardhat.org) — compile, test, deploy
- [OpenZeppelin Contracts 5](https://docs.openzeppelin.com/contracts/5.x/) — ERC721, Ownable
- Solidity `0.8.24`
- Target chain: Base Sepolia (testnet)

## Getting started

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Contract

`contracts/MiniNFT.sol`

| Function | Description |
| --- | --- |
| `mint(uint256 quantity)` *(payable)* | Mint `quantity` tokens to the caller |
| `totalMinted()` | How many tokens minted so far |
| `remaining()` | Tokens still available |
| `mintedBy(address)` | Tokens minted by an address (per-wallet limit) |
| `tokenURI(uint256)` | Metadata URI: `baseURI + id + .json` |
| `setBaseURI(string)` *(owner)* | Update the metadata base URI |
| `withdraw()` *(owner)* | Withdraw collected funds |

Config is set at deploy time: `MAX_SUPPLY`, `MINT_PRICE`, `MAX_PER_WALLET`
(plus `MAX_PER_TX = 10`). Emits `Minted`, `BaseURIUpdated`, `Withdrawn`.

## Deploy

```bash
cp .env.example .env   # then fill in PRIVATE_KEY (testnet wallet only)
npm run deploy
```

## Roadmap

- [x] MiniNFT contract + tests
- [x] Deploy to Base Sepolia
- [x] Frontend (connect, mint, live supply)

## Deployments

| Network | Address |
| --- | --- |
| Base Sepolia | [`0xA17CEfaa527aAd9FAe10012D2457200BD4832079`](https://sepolia.basescan.org/address/0xA17CEfaa527aAd9FAe10012D2457200BD4832079) |

## Security notes

- Built on OpenZeppelin's audited ERC721 + Ownable — no hand-rolled token logic.
- Withdrawal uses the recommended `call` pattern with a success check.
- Secrets (`.env`, private keys) are git-ignored and never committed.
- All development targets a **testnet** — no real funds.

## License

MIT
