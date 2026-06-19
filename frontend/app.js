// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Deployed MiniNFT on Base Sepolia (chainId 84532).
// https://sepolia.basescan.org/address/0xA17CEfaa527aAd9FAe10012D2457200BD4832079
const CONTRACT_ADDRESS = "0xA17CEfaa527aAd9FAe10012D2457200BD4832079";

const ABI = [
  "function mint(uint256 quantity) external payable",
  "function withdraw() external",
  "function setBaseURI(string newBaseURI) external",
  "function owner() view returns (address)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function MINT_PRICE() view returns (uint256)",
  "function MAX_PER_WALLET() view returns (uint256)",
  "function MAX_PER_TX() view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  "function remaining() view returns (uint256)",
  "function mintedBy(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "event Minted(address indexed minter, uint256 indexed tokenId)",
];

// ---------------------------------------------------------------------------
// State + refs
// ---------------------------------------------------------------------------

let provider, signer, contract, account;
let cfg = { price: 0n, maxSupply: 0n, maxPerWallet: 0n, maxPerTx: 10n };

const els = {
  connectBtn: document.getElementById("connectBtn"),
  account: document.getElementById("account"),
  mintedLabel: document.getElementById("mintedLabel"),
  barFill: document.getElementById("barFill"),
  price: document.getElementById("price"),
  owned: document.getElementById("owned"),
  perWallet: document.getElementById("perWallet"),
  minusBtn: document.getElementById("minusBtn"),
  plusBtn: document.getElementById("plusBtn"),
  qtyInput: document.getElementById("qtyInput"),
  mintBtn: document.getElementById("mintBtn"),
  costHint: document.getElementById("costHint"),
  status: document.getElementById("status"),
  refreshBtn: document.getElementById("refreshBtn"),
  feed: document.getElementById("feed"),
  emptyFeed: document.getElementById("emptyFeed"),
  ownerPanel: document.getElementById("ownerPanel"),
  baseUriInput: document.getElementById("baseUriInput"),
  setUriBtn: document.getElementById("setUriBtn"),
  withdrawBtn: document.getElementById("withdrawBtn"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setStatus(text, kind = "") {
  els.status.textContent = text;
  els.status.className = "status" + (kind ? " " + kind : "");
}

function short(a) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function fmtEth(wei) {
  return parseFloat(ethers.formatEther(wei)).toString();
}

function qty() {
  const n = parseInt(els.qtyInput.value, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function updateCostHint() {
  if (!cfg.price) return;
  const total = cfg.price * BigInt(qty());
  els.costHint.textContent = `Total: ${fmtEth(total)} ETH`;
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

async function connect() {
  if (!window.ethereum) {
    setStatus("No wallet found. Install MetaMask or Coinbase Wallet.", "error");
    return;
  }
  if (!CONTRACT_ADDRESS) {
    setStatus("Set CONTRACT_ADDRESS in app.js after deploying.", "error");
    return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = (await signer.getAddress()).toLowerCase();

    els.account.textContent = "Connected: " + short(account);
    els.account.classList.remove("hidden");
    els.connectBtn.textContent = "Connected";

    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

    [els.minusBtn, els.plusBtn, els.qtyInput, els.mintBtn, els.refreshBtn].forEach(
      (el) => (el.disabled = false)
    );

    await loadConfig();
    await refresh();
    contract.on("Minted", () => refresh());
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Failed to connect.", "error");
  }
}

// ---------------------------------------------------------------------------
// Read + render
// ---------------------------------------------------------------------------

async function loadConfig() {
  const [price, maxSupply, maxPerWallet, maxPerTx] = await Promise.all([
    contract.MINT_PRICE(),
    contract.MAX_SUPPLY(),
    contract.MAX_PER_WALLET(),
    contract.MAX_PER_TX(),
  ]);
  cfg = { price, maxSupply, maxPerWallet, maxPerTx };
  els.price.textContent = fmtEth(price) + " ETH";
  els.perWallet.textContent = maxPerWallet.toString();
  els.qtyInput.max = maxPerTx.toString();
  updateCostHint();
}

async function refresh() {
  if (!contract) return;
  setStatus("Loading…");
  try {
    const [minted, owned, mine, owner] = await Promise.all([
      contract.totalMinted(),
      contract.balanceOf(account),
      contract.mintedBy(account),
      contract.owner(),
    ]);

    els.mintedLabel.textContent = `${minted} / ${cfg.maxSupply}`;
    const pct = cfg.maxSupply > 0n ? Number((minted * 100n) / cfg.maxSupply) : 0;
    els.barFill.style.width = pct + "%";
    els.owned.textContent = owned.toString();
    els.perWallet.textContent = `${mine} / ${cfg.maxPerWallet}`;

    const soldOut = minted >= cfg.maxSupply;
    const reachedLimit = mine >= cfg.maxPerWallet;
    els.mintBtn.disabled = soldOut || reachedLimit;
    if (soldOut) els.mintBtn.textContent = "Sold out";
    else if (reachedLimit) els.mintBtn.textContent = "Wallet limit reached";
    else els.mintBtn.textContent = "Mint 🎨";

    if (owner.toLowerCase() === account) {
      els.ownerPanel.classList.remove("hidden");
    } else {
      els.ownerPanel.classList.add("hidden");
    }

    await renderFeed();
    setStatus("");
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Failed to load.", "error");
  }
}

async function renderFeed() {
  // Pull recent Minted events from the chain.
  try {
    const events = await contract.queryFilter("Minted", -5000);
    els.feed.innerHTML = "";
    if (events.length === 0) {
      els.emptyFeed.classList.remove("hidden");
      return;
    }
    els.emptyFeed.classList.add("hidden");
    events
      .slice(-15)
      .reverse()
      .forEach((ev) => {
        const li = document.createElement("li");
        const id = document.createElement("span");
        id.className = "mint-id";
        id.textContent = "#" + ev.args.tokenId.toString();
        const addr = document.createElement("span");
        addr.className = "mint-addr";
        addr.textContent = "by " + short(ev.args.minter);
        li.append(id, addr);
        els.feed.appendChild(li);
      });
  } catch {
    // Some RPCs limit log ranges; the feed is best-effort.
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

async function mint() {
  const quantity = qty();
  els.mintBtn.disabled = true;
  try {
    const value = cfg.price * BigInt(quantity);
    setStatus("Confirm the transaction in your wallet…");
    const tx = await contract.mint(quantity, { value });
    setStatus("Minting…");
    await tx.wait();
    setStatus("Minted! 🎉", "ok");
    await refresh();
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Mint failed.", "error");
  } finally {
    els.mintBtn.disabled = false;
  }
}

async function setBaseURI() {
  const uri = els.baseUriInput.value.trim();
  if (!uri) return;
  els.setUriBtn.disabled = true;
  try {
    setStatus("Confirm in your wallet…");
    const tx = await contract.setBaseURI(uri);
    await tx.wait();
    setStatus("Base URI updated.", "ok");
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Update failed.", "error");
  } finally {
    els.setUriBtn.disabled = false;
  }
}

async function withdraw() {
  els.withdrawBtn.disabled = true;
  try {
    setStatus("Confirm withdrawal in your wallet…");
    const tx = await contract.withdraw();
    await tx.wait();
    setStatus("Withdrawn! 💰", "ok");
    await refresh();
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Withdraw failed.", "error");
  } finally {
    els.withdrawBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------

function clampQty(delta) {
  const max = Number(cfg.maxPerTx || 10n);
  let n = qty() + delta;
  n = Math.max(1, Math.min(max, n));
  els.qtyInput.value = n;
  updateCostHint();
}

els.connectBtn.addEventListener("click", connect);
els.mintBtn.addEventListener("click", mint);
els.refreshBtn.addEventListener("click", refresh);
els.minusBtn.addEventListener("click", () => clampQty(-1));
els.plusBtn.addEventListener("click", () => clampQty(1));
els.qtyInput.addEventListener("input", updateCostHint);
els.setUriBtn.addEventListener("click", setBaseURI);
els.withdrawBtn.addEventListener("click", withdraw);

if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", () => window.location.reload());
  window.ethereum.on?.("chainChanged", () => window.location.reload());
}
