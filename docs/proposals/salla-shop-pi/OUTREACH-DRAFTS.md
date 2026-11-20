# Outreach Drafts (English) — Salla Shop / Pi Ecosystem

**Purpose:** Ready-to-edit message drafts for Eslam/CoreGuard to send personally.  
**Important:** Review and personalize before sending. Only state what is true and currently evidenced (no unconfirmed partnerships, endorsements, user counts, funding, or results).

---

## 1) Primary outreach — Moaz / Salla Shop (technical pilot)

**Subject options:**
- `Pilot idea: independent price & payment verification layer for Salla Shop (Pi flows)`
- `CoreGuard × Salla Shop — sandbox pilot proposal for Pi payment integrity`

**Draft:**

Hi Moaz,

I’ve been looking at Salla Shop on `https://mall.salla-shop.com`, and what stood out to me is how broad the platform is — not just a storefront, but a full commerce and services flow with Pi payments, escrow/hold-until-delivery behavior, refunds, and disputes.

I’m building **CoreGuard**, an independent verification and evidence layer. The idea is simple: help confirm that the **price a customer approved**, the **payment actually observed**, and the **order/execution context** all match — with clear, reason-coded outcomes (verified, mismatch, expired, replay detected, pending, unknown) and an audit-friendly report. CoreGuard is designed to sit **alongside** your existing payment, wallet, escrow, and dispute systems, not replace them.

I’d love to explore a small **sandbox pilot** focused on **Price + Payment Integrity** first (for example, a 100 EGP item quoted in Pi), including cases like quote expiry, amount/recipient mismatch, duplicate webhooks, and transaction reuse. My goal is to prove measurable value quickly and keep the integration lightweight.

If this is relevant, could we set up a short technical discovery call? On my side, I only need sanitized sandbox materials to start (API/webhook docs, server-side payment status/query flow, order↔payment mapping, and how Pi pricing/conversion is calculated and expired). No production secrets or real user data needed.

I’ve prepared a short technical pilot proposal and test plan I can share.

Best regards,  
Eslam Kora  
CoreGuard  
https://github.com/coreguard-global/CoreGuard

---

## 2) Short follow-up (if no response)

**Subject:** `Quick follow-up — CoreGuard sandbox pilot for Salla Shop`

Hi Moaz,

Just following up on my note about a small CoreGuard sandbox pilot for **price + payment verification** in Salla Shop’s Pi flows. I can keep the first scope very narrow (approved quote/consent ↔ server-observed payment checks, including replay/duplicate cases) and share a results report from sandbox tests.

If helpful, I can send over the pilot proposal and a one-page integration checklist, and we can decide from there whether a 30-minute technical chat makes sense.

Best,  
Eslam

---

## 3) Message for Pi ecosystem builders / community (feedback & pilot interest)

**Subject/options:** `Exploring a verification layer for Pi commerce flows (price/payment integrity) — looking for feedback`

Hi everyone,

I’m working on **CoreGuard**, an independent verification and evidence layer for commerce flows where price conversion, user approval, payment execution, and settlement need to stay consistent.

I’m currently exploring a **sandbox-first pilot** focused on Pi-priced commerce (starting with quote/consent binding, server-side payment matching, and replay/idempotency checks) with clear, reason-coded outcomes rather than black-box risk scores. The intent is to complement existing app/payment/escrow systems and produce evidence that’s useful for operations and dispute review.

I’m looking for:
- feedback from builders handling Pi payments, dynamic pricing, webhooks, or escrow/dispute flows,
- pointers to common failure modes you’ve seen in practice,
- and potential design-partner conversations for a narrow, measurable pilot.

If this is relevant to what you’re building, I’d really appreciate a quick chat or any feedback on the approach.

Thanks,  
Eslam Kora  
CoreGuard — https://github.com/coreguard-global/CoreGuard

---

## 4) Note to share with Pi core/ecosystem stakeholders (careful, non-promotional)

**Subject:** `CoreGuard — verification & evidence layer for Pi commerce integrity (pilot-stage)`

Hi [Name],

I’m Eslam, building **CoreGuard**. I’m exploring a pilot-stage verification layer for Pi commerce applications focused on a specific problem: ensuring the **approved price/intent**, **server-confirmed payment**, and **execution context** match, with named failure reasons (mismatch, expiry, replay, pending, insufficient evidence) and auditable reports.

The approach is designed to integrate alongside existing app and payment infrastructure (not replace wallets, payment processing, or escrow decision systems). I’m prioritizing a narrow sandbox pilot with reproducible tests and measurable outcomes before making broader claims.

If there’s interest, I’d value feedback on where this kind of verification/evidence primitive would be most useful in the Pi app ecosystem and what technical expectations matter most for integrations.

Best regards,  
Eslam Kora  
CoreGuard  
https://github.com/coreguard-global/CoreGuard

---

## 5) Positioning & claims checklist (use before sending)

- [ ] State only what is built/tested today vs. proposed for the pilot.
- [ ] Do not claim partnership, endorsement, listing, funding, user counts, or "first client" unless formally confirmed.
- [ ] Describe CoreGuard as a verification/evidence layer; do not claim it prevents all fraud or replaces payment/escrow/dispute authority.
- [ ] Emphasize sandbox-first, server-side truth sources, and explicit limitations (`PENDING`/`UNKNOWN`).
- [ ] Keep pricing/commercials collaborative and transparent; avoid structures that surprise or pressure end users.
- [ ] Focus on durable value (reliability, clarity, evidence quality) rather than dependency or lock-in.
