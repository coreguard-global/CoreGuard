// CoreGuard EvidenceRegistry deployment script.
//
// Usage (Core Mainnet, chain ID 1116):
//   forge script script/Deploy.s.sol:DeployEvidenceRegistry \
//     --rpc-url https://rpc.coredao.org \
//     --private-key ${PRIVATE_KEY} \
//     --legacy \
//     --broadcast
//
// Usage (Core Testnet2, chain ID 1114):
//   forge script script/Deploy.s.sol:DeployEvidenceRegistry \
//     --rpc-url ${RPC_TESTNET2} \
//     --private-key ${PRIVATE_KEY} \
//     --legacy \
//     --broadcast
//
// Verify on CoreScan:
//   forge verify-contract \
//     --chain 1114 \
//     --rpc-url ${RPC_TESTNET2} \
//     --compiler-version 0.8.24 \
//     <DEPLOYED_ADDRESS> \
//     contracts/EvidenceRegistry.sol:EvidenceRegistry
//
// The broadcast wrapper is required: without vm.startBroadcast() forge runs the
// deployment as a local simulation only ("No transactions to broadcast").
// Vm is declared inline (canonical hevm cheatcode address) so the script needs
// no forge-std dependency.

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EvidenceRegistry} from "../contracts/EvidenceRegistry.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployEvidenceRegistry {
    Vm private constant VM = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function run() external returns (EvidenceRegistry registry) {
        VM.startBroadcast();
        registry = new EvidenceRegistry();
        VM.stopBroadcast();
    }
}
