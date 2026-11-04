# Finder Architectural Decisions & Mutation Analysis

## Architectural Decisions

1. **Attribution and Self-Referral Limits**
   - Finder attributes sales to whichever address is provided in the purchase call `buy(id, finder)`.
   - The contract explicitly prevents the buyer from being their own finder (`finder != msg.sender`), the seller from claiming finder commissions on their own listing (`finder != o.seller`), and the contract itself (`finder != address(this)`).
   - **Why self-referral by another wallet cannot be prevented**: In a permissionless blockchain environment, a user can generate unlimited addresses at zero cost. If a buyer creates a secondary address and uses it as their finder link, the protocol cannot distinguish this from two separate individuals without centralized KYC or identity oracles. Finder openly acknowledges this in its limitations disclaimer ("A finder can use another wallet to buy through their own link. It does not tell people apart.").

2. **Atomic Splits and Rounding Math**
   - When a purchase occurs, the commission is calculated as `uint128((uint256(price) * finderBps) / 10_000)`.
   - The seller receives the exact difference: `toSeller = price - commission`.
   - This ensures that `toSeller + commission == price` for every single purchase (even with 1 wei or odd numbers), conserving 100% of ether in the contract balance.

3. **Re-entrancy Protection and Pull Withdrawals**
   - Both seller revenues and finder commissions accrue directly into `pending[address]`.
   - The pull pattern is enforced via `withdraw()` with zero-then-transfer and `nonReentrant` lock.

---

## Mutation Check Survivors Analysis

From `python3 scripts/mutation-check.py finder`, 23 of 25 mutants were killed. The 2 survivors are documented below:

1. **`Finder.sol:209` — `if (offset >= total || count == 0)` vs `offset > total`**
   - When `offset == total`, `offset + count > total` (line 213) immediately triggers and evaluates `count = total - offset = 0`.
   - The function then allocates `new uint256[](0)` and `new Offer[](0)` and returns, exactly mirroring the `return (new uint256[](0), new Offer[](0), total)` early return. The behavior is functionally equivalent.

2. **`Finder.sol:150` — `function withdraw() external nonReentrant` vs bare `external`**
   - The mutant removes the `nonReentrant` modifier from `withdraw()`.
   - In standard execution, `pending[msg.sender]` is set to `0` *before* the external call `(bool ok,) = msg.sender.call{value: amount}("")`. A re-entrant caller will re-enter `withdraw()` and immediately revert with `NothingToWithdraw()`. Thus, even without the boolean reentrancy guard, the function is safe against classic reentrancy due to checks-effects-interactions, which allows this mutant to survive standard reentrancy tests.
