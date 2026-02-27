// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AOPToken.sol";

contract AOPTokenTest is Test {
    AOPToken token;
    address alice = makeAddr("alice");

    uint256 constant MONTHLY_CAP = 10_000_000 * 1e18;

    function setUp() public {
        token = new AOPToken(MONTHLY_CAP);
    }

    function test_mint() public {
        token.mint(alice, 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
    }

    function test_mint_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        token.mint(alice, 100 ether);
    }

    function test_metadata() public view {
        assertEq(token.name(), "AOP Token");
        assertEq(token.symbol(), "AOP");
    }

    function test_emission_cap() public {
        // Mint up to the cap
        token.mint(alice, MONTHLY_CAP);
        assertEq(token.remainingThisWindow(), 0);

        // Exceeding cap reverts
        vm.expectRevert("AOPToken: monthly emission cap exceeded");
        token.mint(alice, 1);
    }

    function test_window_resets_after_30_days() public {
        token.mint(alice, MONTHLY_CAP);

        // Advance 30 days
        vm.warp(block.timestamp + 30 days);

        // Cap resets — can mint again
        token.mint(alice, MONTHLY_CAP);
        assertEq(token.balanceOf(alice), MONTHLY_CAP * 2);
    }

    function test_set_emission_cap() public {
        uint256 newCap = 50_000_000 * 1e18;
        token.setMonthlyEmissionCap(newCap);
        assertEq(token.monthlyEmissionCap(), newCap);
    }

    function test_set_emission_cap_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        token.setMonthlyEmissionCap(1);
    }
}
