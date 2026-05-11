---
phase: 35-production-hotfix-pass
plan: 04
status: complete
completed: 2026-05-11
verification: visual-approved-by-user-via-playwright-screenshots
requirements-closed:
  - LEGAL-01
---

# 35-04 SUMMARY — Legal pages hybrid (modal default + deep-link fallback)

## What shipped

7 commits, hybrid rendering architecture:

| Commit | Task | Files |
|---|---|---|
| `f24e127` | LegalPageLayout — page-mode chrome | `client/src/components/legal/LegalPageLayout.tsx` (NEW, 65 lines) |
| `3140e32` | PrivacyContent — shared legal copy with DeepSeek/China disclosure | `client/src/components/legal/PrivacyContent.tsx` (NEW, 231 lines) |
| `8a94789` | TermsContent — shared terms copy | `client/src/components/legal/TermsContent.tsx` (NEW, 214 lines) |
| `f350823` | LegalModal — shadcn Dialog wrapper | `client/src/components/legal/LegalModal.tsx` (NEW, 56 lines) |
| `9056a78` | PrivacyPage + TermsPage + App.tsx routes | `client/src/pages/legal/PrivacyPage.tsx` + `TermsPage.tsx` (NEW, 15 lines each), `client/src/App.tsx` (+4 lines) |
| `b3483f6` | Wire LandingPage + login footer anchors to LegalModal | `client/src/pages/LandingPage.tsx` (+28/-2), `client/src/pages/login.tsx` (+30/-2) |
| `40c0d43` | Fix LegalModal contrast — force light-mode rendering on dark host | `client/src/components/legal/LegalModal.tsx` (+15/-5) |

## Architecture

```
Footer Privacy/Terms anchor (LandingPage / login)
  │
  ├─ left-click (e.preventDefault) ──→ LegalModal opens
  │                                        │
  │                                        └─ shadcn Dialog
  │                                            ├─ forced bg-white text-slate-900
  │                                            ├─ DRAFT amber in DialogDescription
  │                                            └─ {type==='privacy' ? PrivacyContent : TermsContent}
  │
  └─ middle-click / right-click → href fallback ──→ /legal/privacy or /legal/terms
                                                       │
                                                       └─ PrivacyPage / TermsPage (App.tsx route)
                                                           └─ LegalPageLayout
                                                               ├─ Hatchin brand mark + Back to home
                                                               ├─ DRAFT banner (amber)
                                                               └─ Same PrivacyContent / TermsContent
```

**Single source of legal copy**: PrivacyContent and TermsContent are imported by both LegalModal AND the page wrappers. A future copy fix lands once, updates both surfaces.

## Visual verification — APPROVED

User reviewed via Playwright screenshot capture session (2026-05-11):

**4 paths verified end-to-end:**
1. Standalone `/legal/privacy` deep-link → clean light page, brand chrome, all 8 sections readable
2. Standalone `/legal/terms` deep-link → 11 sections, governing-law placeholder visible
3. LegalModal from landing footer Privacy click → opens overlay, URL unchanged, escape dismisses
4. LegalModal from login footer Privacy click → same modal experience in dark login context

**One contrast issue caught + fixed live:**
- Initial modal render inherited dark theme tokens from host page, washing out body text
- Fixed via explicit `bg-white text-slate-900 border-slate-200` on DialogContent + slate-700 body text + slate-200 borders + slate-500/700 on DialogClose X button
- Verified post-fix: modal is now a crisp white card over the dark landing/login backgrounds
- Commit `40c0d43`

**Copy approved as DRAFT** per D-04 — lawyer review happens out of band before final publication. Future edits land in PrivacyContent.tsx / TermsContent.tsx and update both modal and page automatically.

## Decisions adhered to

- **D-01 (revised per Phase A DeepSeek migration)** ✓ Privacy explicitly discloses: Google OAuth scope, Neon Postgres (US), Stripe billing PII, DeepSeek (primary, China-hosted), Gemini (hot fallback US), Groq (free-tier US), httpOnly+7-day session cookies, retention, deletion path. OpenAI explicitly NOT in default list (escape-hatch only). Per-customer routing override path documented (`hello@hatchin.ai`).
- **D-02 (revised 2026-05-04 + refined 2026-05-05)** ✓ Hybrid render — modal default on click, deep-link page for crawlers/share/middle-click. Both routes public, no AuthGuard.
- **D-03 (revised 2026-05-05)** ✓ Single source of legal copy via shared content components. Plain JSX (h2/p/ul), no markdown parser, no CMS.
- **D-04** ✓ DRAFT marker prominent in both modal (DialogDescription amber) and page (LegalPageLayout amber banner). Last-updated date 2026-05-04 visible everywhere.

## Files modified (final)

```
client/src/App.tsx                                | +4
client/src/components/legal/LegalModal.tsx        | +71 (new + contrast fix)
client/src/components/legal/LegalPageLayout.tsx   | +65 (new)
client/src/components/legal/PrivacyContent.tsx    | +231 (new)
client/src/components/legal/TermsContent.tsx      | +214 (new)
client/src/pages/LandingPage.tsx                  | +33/-2
client/src/pages/legal/PrivacyPage.tsx            | +15 (new)
client/src/pages/legal/TermsPage.tsx              | +15 (new)
client/src/pages/login.tsx                        | +36/-2
```

## Handoff to 35-05

- 35-05 Playwright spec cases 1a/1b/2a/2b/2c verify the hybrid in CI:
  - 1a/2a — deep-link standalone pages load (non-404, expected headings)
  - 1b/2b — modal opens from landing footer without navigation; escape dismisses
  - 2c — same modal behavior from login footer
- All selectors should target `a[href="/legal/privacy"]` (not `footer a[...]`) since not all footers are inside `<footer>` semantic tags.

## Known limitations / lawyer-review TODOs

- Governing Law placeholder reads "State of California, USA" — lawyer should confirm or adjust per Hatchin's actual incorporation jurisdiction
- Per-customer routing override path is mentioned but the operational process (how support handles a request to switch from DeepSeek to Gemini-only) is not yet documented internally — handle when first request comes in
- Copy is AI-drafted, not lawyer-reviewed — DRAFT marker stays until final review pass
