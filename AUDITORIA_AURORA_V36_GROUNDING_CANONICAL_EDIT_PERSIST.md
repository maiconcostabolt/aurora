# AURORA V36 — Grounding canonical edit persistence

Base: V35 diagnostic.

## Root cause confirmed
AUR-2026-0004 is backed by legacy recovered case `GND-RECOVER-AUR-2026-0004`. Its original snapshot contains stale customer data and timestamp. Editing must replace the same report record canonically instead of allowing legacy values to win.

## Changes
- Grounding edit session captures existing report `id`, `public_id`, and `created_at`.
- Finalization calls shared Report Engine preserving those identifiers, replacing the existing report record rather than creating a parallel revision identity.
- Customer payload is authoritative and explicit, including empty strings for phone/email/address/document. Empty means delete/clear, never fallback.
- Before final report creation, live customer is copied as an exact canonical object rather than merged over stale recovery data.
- Existing Report Engine V33 updated_at law remains active.
- Existing preview-close auto refresh remains active.
- Report visual renderer untouched.

## Expected test
Edit AUR-2026-0004, clear phone/email, generate, close preview. Recent card must show current edit time automatically. Reopen same report: phone/email remain empty.
