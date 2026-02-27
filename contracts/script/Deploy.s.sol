// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentSBT.sol";
import "../src/AOPToken.sol";
import "../src/AOPRegistry.sol";

/**
 * Deploy both contracts to Base Sepolia (testnet) or Base mainnet.
 *
 * Base Sepolia:
 *   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
 *
 * Base mainnet:
 *   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
 *
 * Required env vars:
 *   PRIVATE_KEY         deployer private key (becomes contract owner / backend signer)
 *   BASE_SEPOLIA_RPC_URL or BASE_RPC_URL
 *   BASESCAN_API_KEY    for contract verification
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        string memory baseURI = "https://academic-condor-853.convex.site/api/v1/sbt/";

        AgentSBT sbt = new AgentSBT(baseURI);
        // 10,000,000 AOP per month initial cap — adjustable via setMonthlyEmissionCap()
        AOPToken token = new AOPToken(10_000_000 * 1e18);
        AOPRegistry registry = new AOPRegistry();

        vm.stopBroadcast();

        console.log("Deployer:       ", deployer);
        console.log("AgentSBT:       ", address(sbt));
        console.log("AOPToken:       ", address(token));
        console.log("AOPRegistry:    ", address(registry));
        console.log("");
        console.log("Add to Convex env vars:");
        console.log("  AGENT_SBT_ADDRESS    =", vm.toString(address(sbt)));
        console.log("  AOP_TOKEN_ADDRESS    =", vm.toString(address(token)));
        console.log("  AOP_REGISTRY_ADDRESS =", vm.toString(address(registry)));
    }
}
