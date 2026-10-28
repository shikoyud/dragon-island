// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WyrmToken} from "../../src/WyrmToken.sol";
import {WyrmVault} from "../../src/WyrmVault.sol";

/// @dev Deploys the token with the (precomputed) vault as the 40% recipient, plus the roles tests need.
abstract contract VaultFixture is Test {
    uint256 internal constant SIGNER_PK = 0xA11CE;
    uint256 internal constant ENTRY_FEE = 0.0005 ether;
    uint256 internal constant BURN_LIMIT = 1_000_000e18;

    address internal launch = makeAddr("launch");
    address internal team = makeAddr("team");
    address internal owner = makeAddr("ownerSafe");
    address payable internal treasury = payable(makeAddr("treasury"));
    address internal operator = makeAddr("operator");
    address internal signer = vm.addr(SIGNER_PK);
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    WyrmToken internal token;
    WyrmVault internal vault;

    function setUp() public virtual {
        address predictedVault = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        token = new WyrmToken(launch, predictedVault, team);
        vault = new WyrmVault(token, owner, treasury, operator, signer, ENTRY_FEE);
        assertEq(address(vault), predictedVault, "fixture: vault address prediction");
        vm.prank(owner);
        vault.setBurnDailyLimit(BURN_LIMIT);

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.startPrank(launch);
        token.transfer(alice, 1_000_000e18);
        token.transfer(bob, 1_000_000e18);
        vm.stopPrank();
    }

    function sign(uint256 pk, address player, uint256 cumulative, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        return signFor(pk, vault, player, cumulative, deadline);
    }

    function signFor(uint256 pk, WyrmVault target, address player, uint256 cumulative, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        (, string memory name, string memory version, uint256 chainId, address verifying,,) = target.eip712Domain();
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifying
            )
        );
        bytes32 structHash = keccak256(abi.encode(target.CLAIM_TYPEHASH(), player, cumulative, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}

/// @dev A treasury that refuses ETH, to exercise TreasuryTransferFailed.
contract RejectingTreasury {
    receive() external payable {
        revert("no");
    }
}
