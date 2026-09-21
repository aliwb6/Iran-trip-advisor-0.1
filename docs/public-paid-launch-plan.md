# Public Paid Launch Plan

Updated: 2026-09-21

## Goal

Launch `irantripadvisor.net` publicly with real payments only after the security,
database, payment, legal, quality, and operational gates below are complete.

Estimates are focused engineering time, not calendar guarantees. External review,
provider activation, and production approvals can add waiting time.

## Ownership legend

- **Codex**: can be implemented and verified in the repository or connected services.
- **Owner**: requires the account owner, business decision, legal approval, secret rotation,
  or authorization for a production-impacting action.
- **Joint**: Codex prepares and verifies; the owner approves the final external action.

## Launch gates

### Gate 0 — Immediate exposure containment (P0)

Target: complete before driving any additional traffic.

- [ ] **Owner — Revoke the exposed OpenRouter key** (10–20 minutes)
  - Create a replacement key only for server-side use.
  - Do not put the replacement in a `VITE_` variable.
- [ ] **Codex — Move AI requests behind a Vercel server endpoint** (4–7 hours)
  - Add request validation, payload limits, safe error handling, timeouts, and provider isolation.
  - Remove direct OpenRouter calls and the browser-visible key.
  - Keep image/file behavior within explicit size and MIME limits.
- [ ] **Codex — Add AI abuse controls** (3–6 hours)
  - Per-IP and per-user rate limits.
  - Anonymous usage cap and authenticated quota policy.
  - Server-side model/token limits and cost-safe defaults.
  - Avoid logging message bodies or uploaded personal data.
- [ ] **Joint — Configure the replacement server-only secret and deploy** (30–60 minutes)
- [ ] **Codex — Verify public bundles contain no provider secret** (30–60 minutes)

Gate estimate: **8–15 engineering hours**, plus the owner's 10–20 minute key rotation.

### Gate 1 — Supabase schema and migration reconciliation (P0)

Target: one reproducible schema, one trusted migration history.

- [ ] **Codex — Capture a schema and migration baseline** (2–3 hours)
  - Compare the live schema, migration ledger, and 72 repository migrations.
  - Classify timestamp-renamed migrations separately from genuinely unapplied changes.
- [ ] **Codex — Produce a clean reconciliation migration** (4–7 hours)
  - Add the missing package `request_kind` behavior.
  - Add `messages.cards` persistence or deliberately remove the migration and fallback.
  - Confirm pricing/proposal moderation changes already present in live schema.
  - Preserve existing production data and idempotency.
- [ ] **Codex — Audit grants, RLS, triggers, functions, cron jobs, and storage policies** (6–10 hours)
  - Review every client-callable `SECURITY DEFINER` function.
  - Keep `search_path` locked and revoke unintended `PUBLIC`, `anon`, or `authenticated` execution.
  - Verify ownership checks for requests, proposals, chats, contacts, payments, and admin actions.
- [ ] **Owner — Approve a production backup and migration window** (10 minutes)
- [ ] **Joint — Apply to staging/branch, run database tests, then apply to production** (3–5 hours)
- [ ] **Codex — Re-run Supabase security/performance advisors** (1 hour)
- [ ] **Owner — Enable leaked-password protection in Supabase Auth** (5 minutes)

Gate estimate: **16–26 engineering hours**. This is the largest technical risk and must not
be compressed into an unreviewed direct production migration.

### Gate 2 — Green quality pipeline and protected deployment flow (P0/P1)

Target: broken code cannot deploy to production.

- [ ] **Codex — Classify and fix the nine failing test files** (5–10 hours)
  - Separate stale text/implementation assertions from real regressions.
  - Add behavior-level tests where current tests only inspect source text.
- [ ] **Codex — Fix the TypeScript/checkJs configuration** (1–2 hours)
- [ ] **Codex — Resolve actionable type errors** (8–14 hours)
  - Proposal editing, tour form props/state, payment errors, profile/trip forms, and UI primitives.
- [ ] **Codex — Add GitHub Actions** (2–4 hours)
  - Clean install, lint, typecheck, tests, production build, and dependency audit.
- [ ] **Codex — Add migration drift detection to CI** (2–4 hours)
- [ ] **Joint — Change release flow to preview → verification → production promotion** (2–4 hours)
- [ ] **Owner — Enable branch protection/required checks on `main`** (10–20 minutes)

Gate estimate: **20–36 engineering hours**.

### Gate 3 — Real payment readiness (P0)

Target: one fully verified low-value live transaction and refund, with no manual database repair.

- [ ] **Owner — Activate/verify the Stripe live account and business profile** (30–120 minutes,
  excluding Stripe review time)
- [ ] **Owner — Add live Stripe secret and webhook secret to Vercel** (15–30 minutes)
- [ ] **Codex — Verify production payment configuration without exposing keys** (1 hour)
- [ ] **Codex — Test checkout ownership, amount, currency, idempotency, replay, and webhook signature handling** (4–7 hours)
- [ ] **Codex — Add webhook failure visibility and reconciliation tooling** (3–6 hours)
- [ ] **Codex — Verify success, cancel, expiration, duplicate event, and async failure paths** (4–6 hours)
- [ ] **Joint — Run one low-value live charge and one refund** (1–2 hours)
- [ ] **Owner — Approve settlement currency, deposit percentage, refund, cancellation, and dispute rules** (30–60 minutes)

Gate estimate: **13–23 engineering hours**, plus possible Stripe verification waiting time.

### Gate 4 — Legal, trust, and truthful commercial content (P0/P1)

Target: users can understand who operates the service, how their data is used, and what happens
to their money and uploads.

- [ ] **Owner — Provide legal entity/contact details and approve policy decisions** (1–3 hours)
- [ ] **Codex — Add real Privacy Policy, Terms of Service, Refund/Cancellation, and Contact pages** (5–9 hours)
- [ ] **Codex — Add explicit consent around account creation and sensitive document uploads** (2–4 hours)
- [ ] **Codex — Add AI limitation and travel-information disclaimers where appropriate** (1–2 hours)
- [ ] **Joint — Obtain legal review for the target customer/payment jurisdictions** (external time)
- [ ] **Owner — Confirm evidence for marketing numbers or approve corrected values** (15–30 minutes)
- [ ] **Codex — Replace unsupported `500+` and `40+` claims** (30–60 minutes)
- [ ] **Codex — Replace placeholder social links or remove them** (30–60 minutes)

Gate estimate: **9–17 engineering hours**, plus external legal review. Legal text can be drafted
by Codex but must be approved by the business owner and qualified counsel.

### Gate 5 — Application and supply-chain security (P1)

- [ ] **Codex — Remove the unnecessary direct `npm` runtime dependency** (1–2 hours)
- [ ] **Codex — Upgrade React Router and other fixable vulnerable packages** (3–6 hours)
- [ ] **Codex — Replace or isolate the vulnerable Quill/react-quill path** (3–6 hours)
- [ ] **Codex — Review DOMPurify/jsPDF exposure and user-controlled HTML paths** (2–4 hours)
- [ ] **Codex — Add CSP, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, and frame protection** (3–6 hours)
- [ ] **Codex — Audit file upload MIME, size, filename, and storage policies** (3–5 hours)
- [ ] **Codex — Add automated secret scanning and dependency update checks** (2–3 hours)
- [ ] **Codex — Re-run dependency audit and browser regression tests** (2–3 hours)

Gate estimate: **19–35 engineering hours**.

### Gate 6 — End-to-end business-flow verification (P1)

Required roles: traveler, guide, agency, and admin test accounts.

- [ ] Signup, verification, login, logout, reset password (2–3 hours)
- [ ] Traveler profile completion and privacy boundaries (2–3 hours)
- [ ] Guide/agency onboarding, license upload, approval/rejection (3–5 hours)
- [ ] Tour creation, moderation, publication, filters, and package details (3–5 hours)
- [ ] General, direct, package-booking, and package-private requests (4–7 hours)
- [ ] Dispatch, decline, expiry, rebroadcast, and proposal capacity (3–5 hours)
- [ ] Proposal submit/edit/moderate/reject/select (3–5 hours)
- [ ] Booking creation, 15% deposit, contact release, cancellation, and completion (4–7 hours)
- [ ] Chat permissions, pre-payment contact filtering, attachments, and notifications (3–5 hours)
- [ ] Email delivery and deep links in all three languages (3–5 hours)
- [ ] Mobile verification for the complete paid path (3–5 hours)

Owner dependency: approve or provide disposable test identities and authorize the final real-payment test.

Gate estimate: **33–55 engineering hours**. Some work overlaps earlier gates and will shrink after
automation is added.

### Gate 7 — Monitoring, recovery, and operations (P1)

- [ ] **Codex — Add structured server logs with request IDs and redaction** (3–5 hours)
- [ ] **Codex — Configure alerts for payment/webhook, email worker, auth, and database errors** (3–5 hours)
- [ ] **Codex — Add health checks and a release smoke test** (2–4 hours)
- [ ] **Codex — Write rollback, incident, secret-rotation, and payment-reconciliation runbooks** (3–5 hours)
- [ ] **Joint — Verify database backup/restore procedure** (2–4 hours)
- [ ] **Codex — Establish basic product and conversion metrics without collecting unnecessary PII** (3–5 hours)

Gate estimate: **16–28 engineering hours**.

### Gate 8 — SEO, identity, accessibility, and performance polish (P2)

- [ ] Replace the Vite favicon and complete the brand icon set (1–2 hours)
- [ ] Add canonical URL, OG/Twitter images, robots.txt, and sitemap.xml (2–4 hours)
- [ ] Add route-level titles/descriptions and structured data (3–6 hours)
- [ ] Review keyboard navigation, labels, focus states, contrast, and screen-reader landmarks (4–8 hours)
- [ ] Reduce the 698 KB main chunk and 498 KB dashboard chunk (4–8 hours)
- [ ] Remove empty/placeholder content surfaces or publish minimum viable content (2–5 hours)
- [ ] Run desktop/mobile performance checks and fix launch-critical regressions (3–6 hours)

Gate estimate: **19–39 engineering hours**. P2 items do not all block the first paid customer, but
canonical/robots/social metadata, brand favicon, and severe accessibility issues should be completed.

## Critical path and realistic calendar

Some tasks run in parallel, so the total is not the sum of every estimate.

### Minimum safe paid launch

Includes Gates 0–4, the launch-critical portion of Gate 5, one full paid E2E path from Gate 6,
and basic alerting from Gate 7.

- Codex engineering: **55–85 focused hours**
- Owner actions: **2–5 hours**
- Realistic calendar with quick approvals: **8–12 working days**
- With Stripe/legal/provider review delays: **2–4 calendar weeks**

### Fully hardened public launch

Includes every gate and the full role/flow matrix.

- Codex engineering: **110–170 focused hours**
- Owner actions: **4–8 hours**, plus legal/provider waiting time
- Realistic calendar: **3–5 working weeks**

## Recommended execution order

1. Revoke exposed AI key and ship the server proxy.
2. Reconcile Supabase schema/migrations and validate security.
3. Make tests/typecheck green and gate production deployment.
4. Prepare legal pages and truthful commercial content in parallel.
5. Complete Stripe live-mode verification.
6. Run the complete E2E role and payment matrix.
7. Add monitoring/recovery controls.
8. Finish SEO, accessibility, performance, and content polish.

## Go/no-go checklist

Production is **NO-GO** while any item below is true:

- A provider secret is present in a public bundle.
- Repository migrations cannot reproduce the live schema.
- Required CI checks are red or bypassed.
- No successful low-value live charge and refund has been verified.
- Privacy, terms, refund/cancellation, or operator contact pages are missing.
- Critical authorization/RLS findings remain unresolved or undocumented.
- Payment and webhook failures do not alert an operator.
- There is no tested rollback and database recovery path.

