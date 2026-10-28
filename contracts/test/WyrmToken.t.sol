// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {WyrmToken} from "../src/WyrmToken.sol";

contract WyrmTokenTest is Test {
    address internal launch = makeAddr("launch");
    address internal vault = makeAddr("vault");
    address internal team = makeAddr("team");
    WyrmToken internal token;

    function setUp() public {
        token = new WyrmToken(launch, vault, team);
    }

    function test_SupplyAndSplit() public view {
        assertEq(token.totalSupply(), 1_000_000_000e18);
        assertEq(token.balanceOf(launch), 500_000_000e18);
        assertEq(token.balanceOf(vault), 400_000_000e18);
        assertEq(token.balanceOf(team), 100_000_000e18);
        assertEq(token.decimals(), 18);
        assertEq(token.TOTAL_SUPPLY(), 1_000_000_000e18);
    }

    function test_RevertZeroAddress() public {
        vm.expectRevert(WyrmToken.ZeroAddress.selector);
        new WyrmToken(address(0), vault, team);
        vm.expectRevert(WyrmToken.ZeroAddress.selector);
        new WyrmToken(launch, address(0), team);
        vm.expectRevert(WyrmToken.ZeroAddress.selector);
        new WyrmToken(launch, vault, address(0));
    }

    function test_BurnReducesSupply() public {
        vm.prank(launch);
        token.burn(1e18);
        assertEq(token.totalSupply(), 1_000_000_000e18 - 1e18);
        assertEq(token.balanceOf(launch), 500_000_000e18 - 1e18);
    }

    function test_NoMintFunction() public {
        (bool ok,) = address(token).call(abi.encodeWithSignature("mint(address,uint256)", launch, 1));
        assertFalse(ok);
        assertEq(token.totalSupply(), 1_000_000_000e18);
    }

    function test_PermitWorks() public {
        (address owner, uint256 pk) = makeAddrAndKey("permitOwner");
        address spender = makeAddr("spender");
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                spender,
                42e18,
                token.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        token.permit(owner, spender, 42e18, deadline, v, r, s);
        assertEq(token.allowance(owner, spender), 42e18);
        assertEq(token.nonces(owner), 1);
    }

    function test_TeamVestingLinear() public {
        address beneficiary = makeAddr("teamSafe");
        VestingWallet vesting = new VestingWallet(beneficiary, uint64(block.timestamp), 365 days);
        WyrmToken vested = new WyrmToken(launch, vault, address(vesting));
        assertEq(vested.balanceOf(address(vesting)), 100_000_000e18);

        vm.warp(block.timestamp + 365 days / 2);
        vesting.release(address(vested));
        assertApproxEqAbs(vested.balanceOf(beneficiary), 50_000_000e18, 1e18);

        vm.warp(block.timestamp + 365 days);
        vesting.release(address(vested));
        assertEq(vested.balanceOf(beneficiary), 100_000_000e18);
        assertEq(vested.balanceOf(address(vesting)), 0);
    }
}
