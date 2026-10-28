# OnChat meetings and event access — 28 October 2026

## Delivered changes

The OnChat web screens use the Android navy, violet and cyan palette. The meeting hub creates audio/video meetings with optional tariffs and schedules. Admission displays the actual currency, fee, wallet balance and maximum debit before explicit PIN consent. The organizer panel manages tariffs, stage permissions, hand requests, actual completed transaction revenue and ending the meeting.

New online events use native OnChat meetings and account-bound participation codes; physical tickets remain supported. Existing Zoom records are preserved, but new Zoom creation/sales are rejected. Ticket purchases validate event binding, stock, PIN and debit limits. Tickets issued for a paid event are required for meeting admission. Reconnection does not charge admission again. Events with issued tickets cannot be deleted without a separate refund process.

Group audio/video invitations and chat cards use the actual meeting state through WebSocket notifications with HTTP fallback. Group messages and private attachments enforce membership. Organizer controls require server-side ownership. Financial operations, participant admission and ticket issuance share a database transaction and ordered wallet locks.

Android opens the authenticated shared meeting interface for admission and organizer controls, including group invitations. Direct person-to-person calls retain their existing native implementation.

## Database rollout

`migrations/20261028_onchat_meeting_access.sql` is prepared and tested against an isolated PostgreSQL 16 fixture. It adds explicit group/meeting and event/meeting relationships and participation fields. It permits a null financial transaction on free tickets. It has NOT been applied to production. Review schema compatibility, existing ticket-code uniqueness and backup/rollback procedures in staging before rollout. Deploy the web API and WebSocket server together after this migration.

## Validation

- 17 backend tests pass, including PostgreSQL integration using the actual transaction engine: concurrent paid admission charges once, failed participant insertion rolls back the ledger and balances, and competing last-ticket purchases issue one ticket.
- Fee configuration and unused external notification providers are isolated in integration tests; no production account or database is used.
- All 50 changed/new TypeScript files parse, and the WebSocket server passes `node --check`.
- Next.js production build passed. Its existing configuration skips type/lint validation. The targeted semantic check reports only the existing missing processMaxiCashPayout export. Android debug build/unit test results are recorded in the delivery report.

## Limits requiring staging verification

No authenticated multi-device, camera/microphone, push notification, real currency-provider or end-to-end production payment tests were performed. Meetings retain the existing peer-to-peer architecture (default server limit: eight peers), rather than an SFU conference infrastructure. UI media permissions are not an SFU-grade security boundary against modified clients. Refunds and organizer settlements are not newly automated.

The repository has existing unrelated TypeScript parse failures in paypal.ts, bitcoin-balance-card.tsx and events/layout.tsx, and a missing processMaxiCashPayout export used by group.actions.ts. Next.js is configured to skip type/lint validation; a successful build does not imply a clean whole-project typecheck. Lint setup is interactive. These pre-existing issues are outside this phase.
