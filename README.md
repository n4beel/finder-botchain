# Finder (`finder-botchain`)

Pay whoever brought the buyer.

Finder is a decentralized referral and commission marketplace. Sellers list offers with an item price, stock limit, duration, and a finder's commission cut (1%–30%). Anyone can generate and share an affiliate link containing their address; when a purchase occurs through that link, the buyer pays the price, and the contract splits the payment atomically between the finder and the seller.

---

## Design System & Theme

- **Archetype**: BF — Relay (3-node transaction flow diagram and horizontal finder leaderboard)
- **Palette**:
  - Ground: `#E9C46A` (Warm golden mustard)
  - Ink: `#2B1D00` (Deep brown)
  - Accent: `#264653` (Deep teal button accent)
  - Accent Ink: `#FFFFFF`
  - Surface: `#FFF8E0`
- **Typography**:
  - Headings / Display: Righteous
  - Body / UI: Be Vietnam Pro
- **Measured WCAG Contrast Ratios**:
  - Ink (`#2B1D00`) on Ground (`#E9C46A`): **9.83:1** (AAA)
  - Ink (`#2B1D00`) on Surface (`#FFF8E0`): **15.45:1** (AAA)
  - Muted Text (`#644F20`) on Surface (`#FFF8E0`): **7.37:1** (AAA)
  - Accent-Ink (`#FFFFFF`) on Accent (`#264653`): **10.08:1** (AAA)
  - Menu Text (`#2B1D00`) on Menu Bg (`#FFFFFF`): **16.43:1** (AAA)
  - Menu Muted (`#7C7361`) on Menu Bg (`#FFFFFF`): **4.69:1** (AA)

---

## Key Features

- **3-Node Payment Relay Diagram**: Visual breakdown of Finder → Buyer → Seller payment flow with dynamic real-time split bar.
- **Finder Attribution Engine**: Generates unique shareable links (`/offer/[id]?f=[address]`) with live QR codes that decode to the exact link.
- **Per-Offer Finder Leaderboard**: Real-time ranking of top affiliate referrers with buyer counts and cumulative commission bars.
- **Accredited History & Dashboard**: Participant dashboard tracking lifetime commissions and hosted sales.
- **Non-Reentrant Pull Withdrawals**: Pull payment mechanism allowing both sellers and referrers to withdraw accumulated balances safely.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start local dev stack (Anvil on port 8757 + contract deployment + seeded offers)
node scripts/local-stack.mjs

# Run Next.js web application
npm run dev
```

---

## Testing & Verification

```bash
# Foundry unit, fuzz, and invariant tests
cd contracts && forge test

# TypeScript typecheck
npm run typecheck

# Unit tests
npm test

# Integration tests (against isolated Anvil on port 8657)
npm run test:integration

# Next.js production build
npm run build
```
