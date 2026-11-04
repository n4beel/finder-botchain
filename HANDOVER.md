# Finder Handover Document

**Project**: 57 — Finder (`finder-botchain`)  
**Archetype**: BF — Relay (`#E9C46A` ground, `#2B1D00` ink, `#264653` accent)  
**Contract**: `contracts/src/Finder.sol`  
**Deploy Script**: `contracts/script/Deploy.s.sol`

---

## 1. Milestones Completed

- **Milestone 1 (Scaffold)**:
  - Repository scaffolded with `new-project.sh`. Dependencies installed (including `qrcode` package).
- **Milestone 2 (Contract & Invariants)**:
  - `Finder.sol` with `list`, `buy`, `withdraw`, and rich views (`offerOf`, `foundOn`, `quoteSplit`, `latest`, `earned`, `found`, `pending`).
  - 17 unit & fuzz tests + 2 invariant suites (`invariant_BalanceEqualsPending`, `invariant_SoldLessThanOrEqualToStock`) running 256 runs and 32,768 calls with 0 reverts.
- **Milestone 3 (ABI & Library)**:
  - Typed ABI (`lib/botchain/abi.ts` with 35 entries) and utilities in `lib/finder.ts`, `lib/errors.ts`.
  - Comprehensive unit test suites passing in `lib/__tests__/`.
- **Milestone 4 (Integration & Local Stack)**:
  - Integration suite `test/integration/finder.test.ts` running against Anvil on port `8657`.
  - Standalone seeding script `scripts/local-stack.mjs` serving local dev chain on port `8757`.
- **Milestone 5 (Design System & Shell)**:
  - Theme styling in `app/globals.css`, `app/layout.tsx`, `components/layout/PageShell.tsx`, `components/ui/Button.tsx`, and `components/ui/Panel.tsx`.
  - Fonts configured: Righteous and Be Vietnam Pro.
- **Milestone 6 (Screens & User Workflows)**:
  - Implemented `/` (Explore offers as relay strips), `/list` (List an offer with description and finder cut), `/offer/[id]` (3-node relay diagram, buy box, live finder leaderboard, referral link generator with QR code), `/me` (Dashboard with lifetime finder commissions and hosted offers).
- **Milestone 7 (Verification, Mutation Check & Handover)**:
  - Mutation check killed 23/25 mutants; all 2 survivors documented in `contracts/DECISIONS.md`.
  - Full verification gates passing: `check-ui-contract.py`, `check-tokens.py`, `check-distinct.py`, `check-honesty.py`, `typecheck`, `test`, `test:integration`, and `build`.

---

## 2. Verification Gate Results

- **`check-ui-contract.py finder`**: PASSED (0 errors)
- **`check-tokens.py finder`**: PASSED (0 errors)
- **`check-distinct.py finder`**: PASSED (0 errors)
- **`check-honesty.py finder`**: PASSED (0 errors)
- **`npm run typecheck`**: PASSED (0 errors)
- **`npm test`**: PASSED (10 test suites, 48 tests)
- **`npm run test:integration`**: PASSED (2 test suites, 5 tests)
- **`npm run build`**: PASSED (Compiled all static and dynamic routes)

---

## 3. Ports & Environment

- **Integration Port**: `8657`
- **Local Dev Port**: `8757`
- **Network**: BotChain / Anvil (Chain ID `31337`)
