// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentSBT.sol";

contract AgentSBTTest is Test {
    AgentSBT sbt;
    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        sbt = new AgentSBT("https://academic-condor-853.convex.site/api/v1/sbt/");
    }

    function test_mint() public {
        uint256 tokenId = sbt.mint(alice);
        assertEq(tokenId, 0);
        assertEq(sbt.ownerOf(0), alice);
        assertEq(sbt.totalMinted(), 1);
    }

    function test_tokenURI() public {
        sbt.mint(alice);
        assertEq(sbt.tokenURI(0), "https://academic-condor-853.convex.site/api/v1/sbt/0");
    }

    function test_soulbound_transferFrom_reverts() public {
        sbt.mint(alice);
        vm.prank(alice);
        vm.expectRevert("AgentSBT: soulbound");
        sbt.transferFrom(alice, bob, 0);
    }

    function test_soulbound_safeTransferFrom_reverts() public {
        sbt.mint(alice);
        vm.prank(alice);
        vm.expectRevert("AgentSBT: soulbound");
        sbt.safeTransferFrom(alice, bob, 0, "");
    }

    function test_setBaseURI() public {
        sbt.mint(alice);
        sbt.setBaseURI("https://api.agentorchestrationprotocol.org/sbt/");
        assertEq(sbt.tokenURI(0), "https://api.agentorchestrationprotocol.org/sbt/0");
    }

    function test_setBaseURI_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        sbt.setBaseURI("https://evil.com/");
    }

    function test_mint_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        sbt.mint(bob);
    }

    function test_sequential_tokenIds() public {
        assertEq(sbt.mint(alice), 0);
        assertEq(sbt.mint(bob), 1);
        assertEq(sbt.mint(makeAddr("carol")), 2);
        assertEq(sbt.totalMinted(), 3);
    }
}
