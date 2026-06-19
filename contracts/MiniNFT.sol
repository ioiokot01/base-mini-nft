// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title MiniNFT
/// @notice A small, beginner-friendly ERC-721 collection for the Base ecosystem.
///         Anyone can mint (pay the mint price), supply is capped, and there is a
///         per-wallet limit to keep it fair. The owner sets the metadata base URI
///         and can withdraw the collected funds.
/// @dev    Built on OpenZeppelin's audited ERC721 + Ownable. Token ids start at 1.
contract MiniNFT is ERC721, Ownable {
    using Strings for uint256;

    /// @notice Hard cap on how many tokens can ever exist.
    uint256 public immutable MAX_SUPPLY;
    /// @notice Price (in wei) to mint one token.
    uint256 public immutable MINT_PRICE;
    /// @notice Maximum tokens a single wallet may mint in total.
    uint256 public immutable MAX_PER_WALLET;
    /// @notice Maximum tokens that can be minted in one transaction.
    uint256 public constant MAX_PER_TX = 10;

    /// @dev The id that will be assigned to the next minted token.
    uint256 private _nextTokenId = 1;
    /// @dev Base URI for token metadata, e.g. "ipfs://CID/". Settable by owner.
    string private _baseTokenURI;

    /// @notice How many tokens each address has minted (for the per-wallet limit).
    mapping(address => uint256) public mintedBy;

    event Minted(address indexed minter, uint256 indexed tokenId);
    event BaseURIUpdated(string newBaseURI);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        uint256 maxPerWallet_,
        string memory baseURI_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        require(maxSupply_ > 0, "Max supply must be > 0");
        require(maxPerWallet_ > 0, "Per-wallet limit must be > 0");
        MAX_SUPPLY = maxSupply_;
        MINT_PRICE = mintPrice_;
        MAX_PER_WALLET = maxPerWallet_;
        _baseTokenURI = baseURI_;
    }

    /// @notice Mint `quantity` tokens to the caller.
    function mint(uint256 quantity) external payable {
        require(quantity > 0, "Quantity must be > 0");
        require(quantity <= MAX_PER_TX, "Exceeds max per tx");
        require(totalMinted() + quantity <= MAX_SUPPLY, "Exceeds max supply");
        require(
            mintedBy[msg.sender] + quantity <= MAX_PER_WALLET,
            "Exceeds per-wallet limit"
        );
        require(msg.value >= MINT_PRICE * quantity, "Insufficient payment");

        mintedBy[msg.sender] += quantity;
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(msg.sender, tokenId);
            emit Minted(msg.sender, tokenId);
        }
    }

    /// @notice Total number of tokens minted so far.
    function totalMinted() public view returns (uint256) {
        return _nextTokenId - 1;
    }

    /// @notice Tokens still available to mint.
    function remaining() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted();
    }

    /// @notice Owner: update the metadata base URI.
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /// @notice Owner: withdraw all collected funds.
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Nothing to withdraw");
        (bool ok, ) = payable(owner()).call{value: balance}("");
        require(ok, "Withdraw failed");
        emit Withdrawn(owner(), balance);
    }

    /// @notice Metadata URI for a token: baseURI + tokenId + ".json".
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        _requireOwned(tokenId); // reverts if the token doesn't exist
        string memory base = _baseTokenURI;
        return
            bytes(base).length > 0
                ? string.concat(base, tokenId.toString(), ".json")
                : "";
    }
}
