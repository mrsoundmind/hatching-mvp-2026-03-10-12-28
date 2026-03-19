---
phase: "02"
phase-slug: "user-journey-fixes"
date: "2026-03-17"
---

# Phase 02: User Journey Fixes — Validation Strategy

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript scripts (scripts/test-*.ts) + manual browser |
| Quick run | `npm run typecheck` |
| Full suite | `npm run typecheck && npm run test:integrity && npm run test:dto` |

### Per-Task Gates
- **After every task commit:** `npm run typecheck` must pass with zero errors
- **After every wave:** `npm run typecheck && npm run test:integrity && npm run test:dto`
- **Phase gate:** All 9 success criteria manually verified in browser before `/gsd:verify-work`

### Requirements → Validation Map

| Req ID | Behavior | Test Type | Command |
|--------|----------|-----------|---------|
| UX-01 | Create Project → project created, chat ready | manual | Browser: click "+ New Project", enter name, submit |
| UX-02 | Onboarding → first project welcome | manual | Browser: new account flow |
| UX-03 | `/` unauthenticated → LandingPage | manual | Browser: logged out, visit `/` |
| UX-04 | Project click → expand, others collapse | manual | Browser: click project in sidebar |
| UX-05 | Team click → expand agents; click again → collapse | manual | Browser: click team in sidebar |
| UX-06 | Textarea enabled during streaming | manual | Browser: send message, type during response |
| UX-07 | Agent color consistent on navigation | manual | Browser: send message, navigate away, return |
| UX-08 | One typing indicator at a time | manual | Browser: send message, observe indicator locations |
| DATA-04 | Old messages show correct agent role color | manual + typecheck | Browser: load old conversation; `npm run typecheck` |

### Wave 0 Gaps
None — all UX requirements require manual browser testing. The TypeScript compiler gate covers structural correctness.

### Automated Safety Nets
All task changes verified with:
```bash
npm run typecheck       # zero TS errors
npm run test:integrity  # message ordering intact
npm run test:dto        # DTO contracts valid
```
