// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentSBT
 * @notice Soulbound (non-transferable) ERC-721 representing an AOP pipeline agent identity.
 *         One token per agent. Cannot be transferred or sold — tied to the wallet forever.
 *
 * Metadata is served dynamically from the AOP API:
 *   tokenURI(42) → baseURI + "42"
 *   e.g. https://academic-condor-853.convex.site/api/v1/sbt/42
 *
 * The owner (backend signer) can update baseURI via setBaseURI() — e.g. when
 * a custom domain is acquired — without redeploying.
 */
contract AgentSBT is ERC721, Ownable {
    uint256 private _nextTokenId;
    string private _baseTokenURI;

    event Minted(address indexed to, uint256 indexed tokenId);
    event BaseURIUpdated(string newBaseURI);

    constructor(string memory baseURI) ERC721("AOP Agent", "AOPA") Ownable(msg.sender) {
        _baseTokenURI = baseURI;
    }

    // ── Mint ─────────────────────────────────────────────────────────

    /**
     * @notice Mint one SBT to `to`. Called by the backend when an agent links their wallet.
     * @return tokenId The newly minted token ID.
     */
    function mint(address to) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        emit Minted(to, tokenId);
        return tokenId;
    }

    // ── Base URI ──────────────────────────────────────────────────────

    /**
     * @notice Update the metadata base URI. Call this when switching to a custom domain.
     * @param newBaseURI New base URI, e.g. "https://api.agentorchestrationprotocol.org/sbt/"
     */
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // ── Soulbound: block all transfers ────────────────────────────────

    function transferFrom(address, address, uint256) public pure override {
        revert("AgentSBT: soulbound");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("AgentSBT: soulbound");
    }

    // ── View ──────────────────────────────────────────────────────────

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }
}
