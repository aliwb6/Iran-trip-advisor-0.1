# Stripe payment provider setup

Phase 3B uses Stripe-hosted Checkout for the booking **deposit** only. The browser never sends an authoritative amount and never writes `bookings` or `payments`. The Vercel function authenticates the Supabase session, asks the database to create a server-owned payment attempt from the immutable booking snapshot, then creates Stripe Checkout. A verified Stripe webhook is the only path that can mark the payment paid and release booking contact details.

## Required Vercel environment variables

Configure these as **server-side secrets** for Production (and Preview only if preview payments are intentionally tested):

- `SUPABASE_SERVICE_ROLE_KEY` — backend Supabase service credential. Never prefix this with `VITE_` and never expose it to browser code.
- `STRIPE_SECRET_KEY` — Stripe secret key (`sk_test_...` while testing, production key only when intentionally going live).
- `STRIPE_WEBHOOK_SECRET` — signing secret for the webhook endpoint (`whsec_...`).
- `PAYMENT_APP_URL=https://irantripadvisor.net`
- `PAYMENT_SUPPORTED_CURRENCIES=usd`

The payment functions also need the Supabase project URL and public/anon key. They reuse `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` when those already exist in Vercel. Alternatively set server aliases `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

Do not commit any secret value to GitHub.

## Stripe webhook

Create a Stripe webhook endpoint pointing to:

`https://irantripadvisor.net/api/payments/stripe-webhook`

Subscribe only to the Phase 3B events currently handled:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Copy the endpoint signing secret to `STRIPE_WEBHOOK_SECRET` in Vercel.

## Activation check

Before secrets are configured, this endpoint intentionally reports payments as disabled:

`GET /api/payments/config`

Expected disabled response:

```json
{
  "provider": "stripe",
  "enabled": false,
  "supportedCurrencies": ["usd"],
  "paymentTypes": ["deposit"],
  "contactReleaseOn": "deposit_paid"
}
```

After all required server variables are present and Vercel has redeployed, `enabled` should become `true`.

## Security contract

- Checkout creation requires a valid Supabase access token.
- The authenticated user must be the booking traveler.
- Deposit amount/currency are derived from the server-created `bookings` snapshot.
- Browser code never supplies the canonical amount, commission, payout, or deposit percentage.
- `payments` remains browser read-only.
- Provider session ids are unique and active attempts are de-duplicated.
- Webhook signatures are verified against the raw request body before database mutation.
- Provider event ids are stored uniquely for webhook idempotency.
- Stripe amount and currency are checked against the attached payment attempt before settlement.
- `contact_released=true` is set only after a verified paid Checkout event.
- The Stripe webhook payload is not stored wholesale; only minimal processing metadata is recorded.

## Test-mode rollout

1. Configure Stripe **test** secret + webhook secret in Vercel.
2. Keep `PAYMENT_SUPPORTED_CURRENCIES=usd` until additional currencies are intentionally validated.
3. Verify `/api/payments/config` returns `enabled: true`.
4. Create a fresh test booking through the real trip-request lifecycle.
5. Start the deposit checkout from the traveler UI.
6. Complete the Stripe test Checkout.
7. Verify `payments.status = paid`, `bookings.payment_status = deposit_paid` (or `paid` if deposit equals total), and `bookings.contact_released = true`.
8. Verify both booking parties can retrieve only the counterpart contact through `get_booking_contact_details`.
9. Verify webhook retries do not duplicate notifications or create duplicate settlement rows.

Do not switch to live Stripe keys until the test-mode end-to-end pass is clean.
