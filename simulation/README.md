# GymKit Simulation Platform

Drives the real GymKit app in a browser as **six different user personas** and detects
anything broken: crashes, console errors, failed requests, blank screens, and broken flows.

**Completely isolated** — a Playwright network layer intercepts every request to Supabase and
the payments API and serves a faithful in-memory mock (same PostgREST semantics, same
endpoints). No production data is ever read or written, and Stripe is never charged.

## Run it

```bash
cd simulation
npm install          # once
npx playwright test  # runs everything; starts the dev server automatically on :3100
node lib/report.js   # summarize findings into report/SUMMARY.md
```

## Personas / scenarios

| Spec | Persona | What it does |
|------|---------|--------------|
| 00-signup | Prospect | Landing → register → 4-step signup → verifies the new admin can log in from a fresh device |
| 01-superadmin | Super admin | Logs in → creates a demo-seeded gym through the panel → verifies registry + demo data |
| 10-admin | Gym admin | Logs in → renders all 35 staff routes → adds a member → creates a coach account |
| 20-coach | Coach | Logs in → coach routes → builds a workout with an exercise and saves it |
| 30-client | Client (mobile) | Logs in with email + PIN → walks portal tabs → books a session |
| 40-station | Station tablet | Opens `/station/:id` cold (no localStorage) via the `?gym=` URL |
| 50-multiuser | Coach + client live | Client chat message reaches staff inbox **without reload**; client booking appears on staff schedule |

Scenarios share one in-memory backend per run (fixtures persist in `fixtures/`), so later
personas operate on the gym the super admin created. Findings accumulate in
`report/bugs.json`; each spec also asserts flow outcomes directly against the mock store.

## Structure

- `lib/mockBackend.js` — in-memory `data_store` (PostgREST GET/POST/PATCH/DELETE) + payments/email/SMS API mock + email/SMS outbox
- `lib/collector.js` — page-level error collectors and the bug log
- `lib/helpers.js` — personas, login, route crawling, tour dismissal
- `lib/seed.js` — direct-seed fallback (app-authored shapes)
- `lib/report.js` — bug log → `report/SUMMARY.md`

Status 2026-07-17: **all 11 scenarios pass clean** after the full audit + fix wave
(see `../audit/FINDINGS.md` for the complete catalog).
