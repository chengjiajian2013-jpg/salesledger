# Implementation Plan: SalesLedger Frontend Refactor

## Overview

Reduce the coupling in `public/app.js` without changing the existing transaction, AI, authentication, or Fenghua behavior. The refactor is staged so each slice leaves the browser entry point working and can be reverted independently.

## Architecture Decisions

- `public/modules/state.js` remains the only business state source.
- `dom.js` owns DOM lookup only; it has no state or event listeners.
- `app-bootstrap.js` owns the authenticated startup contract and runs it once.
- `view-router.js` owns view visibility and delegates data loading through callbacks, avoiding module cycles.
- AI parsing remains in `app.js` until the transaction and event boundaries are stable.

## Task List

### Phase 1: Foundation

- [x] Extract DOM lookup into `dom.js` and cover it with a root-injection test.
- [x] Replace the nested `DOMContentLoaded` registration with a single authenticated bootstrap.
- [x] Extract view switching behind a callback-based router.

### Phase 2: Core Boundaries

- [x] Move transaction data loading/submission behind a transaction module facade.
- [x] Move monthly statistics loading/rendering behind a monthly-stats facade.
- [x] Protect event binding behind one idempotent events facade.

### Phase 3: AI Boundary

- [x] Separate pure AI response parsing from DOM mutations.
- [x] Keep `openTransactionModal` owned by the transaction boundary and pass it a draft.

## Verification

- Run `npm test` after every slice.
- Run static surface checks for the main and Fenghua entry points.
- Perform a browser smoke check for login, transaction create/edit, monthly view, AI view, and `/fenghua` direct entry after the final slice. (Not run: Chrome DevTools MCP is unavailable in this environment.)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Duplicate startup listeners | Repeated API requests and handlers | Bootstrap guard plus one startup callback |
| Split state sources | Stale seller/filter values | Keep `state.js` authoritative and pass dependencies explicitly |
| Router/module cycle | Runtime import failure | Callback registration instead of cross-imports |
| AI/transaction coupling | Broken AI-to-form flow | Defer AI extraction until transaction facade is stable |
