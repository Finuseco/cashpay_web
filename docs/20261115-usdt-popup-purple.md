# USDT activation, dashboard geometry and current brand

## Address activation

No production seed or keys were changed. TRON derivation now normalizes whitespace and converts library failures to a sanitized INVALID_KEY_CUSTODY_CONFIGURATION error. Missing custody remains a separate error. The authenticated activation API returns this diagnostic with HTTP 503 and a customer-readable message. The dashboard shows failures, an activation loading state and requires a returned address before marking the wallet active.

The dashboard address action now checks the authenticated owner and takes the same per-user transaction lock as ensureUserUsdtAddress, preventing concurrent dashboard/activation inserts. An existing valid address also ensures the zero-initialized ledger row exists without changing an existing balance. No fake USDT address is generated.

Run `npm run crypto:usdt:check` on the VPS for a read-only local custody/network configuration check. It prints no key, seed or address, makes no database writes and performs no fund movement. It does not establish that deposits/network confirmations work. An invalid seed must be resolved by its custodian; never invent a replacement for a funded wallet.

## Interface

USDT now uses the existing fiat/Bitcoin card dimensions: 19.2rem by 10rem. USDT has one row of four compact actions contained inside the card. The shared ActionPanel uses the existing Radix Popover dependency and a portal, with collision bounds, Escape/outside close and focus restoration; it no longer inserts menu content into document flow.

Brand values come from cashpay-main origin/main 3831815: #7A22D4 / #190A28 / #2A0E42 / #59158D / #A66BE0. Shared CSS tokens, prior brown OnChat values and USDT use the current purple theme. Semantic transaction/status colors remain.

## Validation

Real TronWeb derivation tested with a public test mnemonic: deterministic user addresses, distinct derivation indices, whitespace normalization, missing/invalid configuration and fake-address refusal. Mocked database address-service checks cover locking, existing ledger row repair and rollback. Browser checks at 360/1440px verify card dimensions, action bounds and popup opening without dashboard layout changes. No production activation or on-chain transfer was tested.
