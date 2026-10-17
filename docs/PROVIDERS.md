# Provider setup

Every external service is called through an adapter in `server/adapters.mjs`. Until an adapter is configured, the related action fails with **HTTP 503** and code `…_NOT_CONFIGURED`, and it leaves no state behind (`tests/server/api.test.mjs`, "providers that are not configured …"). `GET /api/health` reports the state of every provider.

Configuration goes in environment variables only, never in code or chat. The template is `.env.example`. A value named `test` works only when `NODE_ENV=test`, which is how the automated tests run.

## Payments (`PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`)

Status: **BLOCKED** until there is a contract with a UAE-licensed payment gateway.

To integrate a gateway:

1. Implement `createPayment(payment)` in `paymentsAdapter`. It should create the provider charge or hosted payment page for exactly `payment.amount.total` fils in AED, and use `payment.id` as the provider idempotency key. It returns `{ providerRef, nextAction }`, where `nextAction` is usually a redirect URL.
2. Make the provider (or a relay you control) send events to `POST /api/webhooks/payments`.
   - Body: JSON `{ id, type, paymentId, amount }`, where `type` is `payment.succeeded` or `payment.failed`.
   - Header: `X-CON-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.<raw body>" with PAYMENT_WEBHOOK_SECRET>`.
   - Signatures older than 5 minutes are refused. Events are de-duplicated by `id`. `amount` must equal the payment total.
   - If the gateway signs differently, replace `verifyWebhook`. Never accept unsigned events.
3. Refunds: an approved refund stays *approved* until the provider confirms it. Record that confirmation through `Domain.refundProcessed` from a signed provider event.
4. Test in the provider's sandbox before any live key is set.

## Payouts (`PAYOUT_PROVIDER`)

Status: **BLOCKED** until a payout or escrow provider is chosen and the licensing question about holding customer funds is answered (L3 in `docs/ISSUES.md`).

- Implement `transfer(payout, { idempotencyKey })`. The key is `payout_<id>` and must be passed to the provider so a retry can never pay twice.
- Release is only attempted after all five guards pass, and it is claimed first (status `releasing`).
- If the server stops after the provider accepted a transfer but before the release was recorded, the payout stays `releasing`. Reconcile it with the provider's report using the idempotency key, then record the outcome. Do not retry blindly.

## Notifications (`NOTIFICATIONS_PROVIDER`)

Status: **BLOCKED** until there is an email or SMS account. `send()` currently returns `{ sent: false, reason: 'not_configured' }`. Nothing in the platform claims a message was sent.

## Malware scanning (`CLAMAV_HOST`, `CLAMAV_PORT`)

Status: **IMPLEMENTED — EXTERNAL VERIFICATION REQUIRED**.

- Run `clamd` and point the server at it.
- Uploads are streamed over INSTREAM and marked `clean`, `infected` or `error`.
- Without a scanner, documents stay `pending` and cannot be approved. This is deliberate.

To verify, upload the EICAR test file in a staging environment and confirm it is marked `infected`.

## Private document storage (`PRIVATE_STORAGE_DIR`)

- A directory outside the public site, created with mode 700. Files are mode 600, named by a random id, with a SHA-256 hash recorded.
- Allowed types are PDF, PNG and JPEG, checked by content signature and not by file name. The size limit is 10 MB.
- Only operations users can download a document (`GET /api/ops/documents/:id`), and every download is audited.
- On a multi-server deployment, replace the adapter with object storage using private buckets and short-lived signed URLs.

## Database (`DATABASE_URL`, `DATABASE_SSL`)

Tested with PostgreSQL 16. Migrations in `server/migrations/` run at start-up. Without `DATABASE_URL`, the server uses the in-memory store, which is for development only and loses data on restart unless `DATA_FILE` is set. Backups are covered in `docs/BACKUP_RESTORE.md`.
