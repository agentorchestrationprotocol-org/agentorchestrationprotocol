// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AOPToken
 * @notice ERC-20 rewards token for the AOP deliberation pipeline.
 *
 * Agents earn tokens off-chain (tracked in Convex DB) by completing pipeline slots.
 * When they claim, the backend calls mint() to issue tokens on-chain.
 *
 * Emission schedule: a monthly cap limits how many tokens can be minted per 30-day
 * window, preventing hyperinflation regardless of activity volume. The owner can
 * adjust the cap as the network grows. There is no hard total supply ceiling.
 *
 * Default: 10,000,000 AOP per month.
 */
contract AOPToken is ERC20, Ownable {
    // ── Emission schedule ─────────────────────────────────────────────

    /// @notice Max tokens (in wei) that can be minted in any 30-day window.
    uint256 public monthlyEmissionCap;

    /// @notice How many tokens have been minted in the current window.
    uint256 public currentWindowMinted;

    /// @notice Timestamp when the current 30-day window started.
    uint256 public windowStart;

    uint256 private constant WINDOW = 30 days;

    event Claimed(address indexed to, uint256 amount);
    event EmissionCapUpdated(uint256 newCap);

    constructor(uint256 initialMonthlyCap)
        ERC20("AOP Token", "AOP")
        Ownable(msg.sender)
    {
        monthlyEmissionCap = initialMonthlyCap;
        windowStart = block.timestamp;
    }

    // ── Mint ──────────────────────────────────────────────────────────

    /**
     * @notice Mint `amount` tokens to `to`. Called by the backend signer when
     *         an agent claims their accumulated off-chain balance.
     * @dev    Reverts if this mint would exceed the current monthly emission cap.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _rollWindowIfNeeded();

        require(
            currentWindowMinted + amount <= monthlyEmissionCap,
            "AOPToken: monthly emission cap exceeded"
        );

        currentWindowMinted += amount;
        _mint(to, amount);
        emit Claimed(to, amount);
    }

    // ── Owner controls ────────────────────────────────────────────────

    /**
     * @notice Update the monthly emission cap. Use this to scale up as the
     *         network grows.
     * @param newCap New cap in token wei (e.g. 50_000_000 * 1e18 for 50M/month).
     */
    function setMonthlyEmissionCap(uint256 newCap) external onlyOwner {
        monthlyEmissionCap = newCap;
        emit EmissionCapUpdated(newCap);
    }

    // ── View ──────────────────────────────────────────────────────────

    /// @notice How many tokens remain mintable in the current window.
    function remainingThisWindow() external view returns (uint256) {
        if (block.timestamp >= windowStart + WINDOW) {
            return monthlyEmissionCap; // window would reset
        }
        uint256 minted = currentWindowMinted;
        return minted >= monthlyEmissionCap ? 0 : monthlyEmissionCap - minted;
    }

    // ── Internal ──────────────────────────────────────────────────────

    function _rollWindowIfNeeded() internal {
        if (block.timestamp >= windowStart + WINDOW) {
            windowStart = block.timestamp;
            currentWindowMinted = 0;
        }
    }
}
