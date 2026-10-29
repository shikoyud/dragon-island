// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VaultFixture} from "./helpers/VaultFixture.sol";
import {VaultHandler} from "./helpers/VaultHandler.sol";

contract DrisVaultInvariantTest is VaultFixture {
    VaultHandler internal handler;
    address[] internal actors;

    function setUp() public override {
        super.setUp();
        actors.push(alice);
        actors.push(bob);
        actors.push(makeAddr("carol"));
        actors.push(makeAddr("dave"));
        vm.startPrank(launch);
        token.transfer(actors[2], 1_000_000e18);
        token.transfer(actors[3], 1_000_000e18);
        vm.stopPrank();

        handler = new VaultHandler(token, vault, operator, SIGNER_PK, actors);
        targetContract(address(handler));
    }

    function invariant_SupplyEqualsInitialMinusBurned() public view {
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY() - handler.ghostBurned());
    }

    function invariant_TokensAreConserved() public view {
        uint256 held = token.balanceOf(address(vault)) + token.balanceOf(launch) + token.balanceOf(team);
        for (uint256 i = 0; i < actors.length; i++) {
            held += token.balanceOf(actors[i]);
        }
        assertEq(held + handler.ghostBurned(), token.TOTAL_SUPPLY());
    }

    function invariant_DailyCapsHold() public view {
        assertLe(vault.paidToday(), vault.dayCap());
        assertLe(vault.burnedToday(), vault.burnDailyLimit());
    }

    function invariant_ClaimedMatchesVouchers() public view {
        for (uint256 i = 0; i < actors.length; i++) {
            assertEq(vault.claimed(actors[i]), handler.ghostCumulative(actors[i]));
        }
    }

    function invariant_NoEthStranded() public view {
        assertEq(address(vault).balance, 0);
    }
}
