# Seed: v4.0 — Hatches That Act ("Hatchin Desktop")

> **Status:** forward-planted seed. Do not promote to active milestone until v3.0 ships.
> **Created:** 2026-04-28
> **Trigger to activate:** v3.0 (Mental Models) shipped + persistent memory infrastructure stable for ≥30 days.

---

## Why this is its own document

v4.0 is not a refinement of the v2.x roadmap. It's a **paradigm shift** — Hatches transition from "AI team that produces content" to "AI team that takes action in your software." That's a different product category and a different pricing tier. It deserves its own seed file so it isn't lost in the larger roadmap and so the dependencies/constraints are explicit.

---

## The thesis

Today's Hatchin (and every milestone v2.1 → v3.0) makes Hatches **better at producing artifacts**. Rubrics, research, file formats, task graphs, marketing depth, persistent memory — all of these make outputs richer. **None of them let a Hatch act in the user's world.** Robin can write a perfect SEO audit; Robin cannot fix the meta tags. Drew can write the perfect cold email; Drew cannot send it.

v4.0 closes that gap. With Ghost OS as the substrate, Hatches gain eyes and hands on the user's macOS — they read the accessibility tree, click buttons, fill forms, send messages, post to Slack/LinkedIn, edit Webflow titles, file Linear tickets. With one-click human approval and recipe-based reuse, this is safe and scalable.

---

## Architectural change required

| Layer | Today | v4.0 |
|---|---|---|
| Frontend | Web app only | Web + Mac desktop companion ("Hatchin Desktop") |
| Hatch outputs | Markdown / files | Markdown / files **+ executable recipes** |
| Permissions | OAuth only | macOS Accessibility + Input Monitoring (user-granted) |
| Trust model | "Hatch produces, user reviews" | "Hatch proposes action, user approves, Hatch executes" |
| Audit trail | Conversation log | **Per-action recipe log** (JSON, replayable, auditable) |

This is a major-version bump because the data model and trust model both change.

---

## Pillars

1. **Hatchin Desktop (macOS)** — Electron + native bridge wrapping Ghost OS as MCP. Local agent ↔ Hatchin Cloud via WebSocket. Cross-platform deferred to v4.1+.
2. **Recipe library per Hatch** — Robin learns SEO recipes (CMS edits, schema updates), Drew learns email recipes (Gmail/Outlook send), Pixel learns social recipes (LinkedIn/X post), Quinn learns ops recipes (Linear/Notion ticket). Recipes are project-portable JSON.
3. **Approval gating** — every action proposed in chat with a one-click Approve button. v2.1 frozen rubric becomes the safety check. v2.6 red-team scans gate every recipe before execution.
4. **Recipe marketplace** — users share/sell recipes. *"Best Webflow SEO updater for 2026"* — community asset that creates a network-effect moat.

---

## Hard dependencies

- **v3.0 (Hatch Mental Models) must ship first.** A Hatch that drives your CMS but forgets your brand decision from last week is more dangerous than helpful. Persistent memory is the prerequisite for trustworthy action.
- **v2.1 frozen rubric must be production-tested.** The auto-revert pattern is what makes failed actions recoverable.
- **v2.6 (Trust & Safety) ideally shipped first.** Red-team scans gate recipes before they execute on the user's apps.

Cannot reorder. v3.0 → v4.0 is a hard chain.

---

## Constraints to design through

| Constraint | Mitigation |
|---|---|
| **macOS-only initially** (Ghost OS limitation) | Launch Mac-first; expand later. Most power users are on Mac. Cross-platform = Selenium/Playwright for browser-only fallback in v4.1. |
| **HIPAA/GDPR-sensitive** — Hatch has effective access to user's email, Slack, browser sessions | Lawyer review before launch. Likely Enterprise-only or strong opt-in disclaimer. Audit log is non-negotiable. |
| **Reliability** — computer-use is brittle; apps update, AX trees shift | v2.1 frozen-rubric pattern (auto-revert on failure). Recipe versioning. Graceful degradation to "couldn't complete — please review." |
| **Onboarding complexity** — from "sign up and chat" to "sign up + install desktop app + grant permissions + train recipes" | Guided onboarding flow with a small-stakes practice recipe ("I'll send a test email to yourself"). Don't ship "drive my whole CRM" as the first run. |
| **Cost** — recipe execution is cheaper than chat (no LLM call), but recipe authoring is expensive (frontier model) | Frontier model authors recipe once → small model (Haiku) runs it forever. This is Ghost OS's core architectural insight; preserve it. |

---

## Pricing implication

This is the feature that justifies a **$500 - $2,000/month Enterprise tier**. Computer-use that actually works at scale is the kind of capability companies pay real money for. Today's $19 Pro tier is *not* the right pricing for v4.0. Plan for tier expansion alongside.

Concrete proposed structure when v4.0 ships:
- **Free** — chat only, 3 projects (unchanged)
- **Pro** ($19/mo) — full chat capabilities, deliverables, all v2.x features (unchanged)
- **Pro+ Desktop** ($49-$99/mo) — adds Hatchin Desktop with single-user computer-use, basic recipe library
- **Enterprise** ($500+/mo, custom) — multi-seat Desktop, recipe marketplace privileges, compliance reports, custom recipes

---

## Strategic positioning

v4.0 redefines Hatchin's competitive category:

- Today: "ChatGPT competitor" — wins on team-style multi-agent UX
- Post-v3.0: "ChatGPT with persistent memory" — wins on continuity
- Post-v4.0: "AI employee that ships work" — different category entirely. Competitors are no longer chat tools; they are RPA tools (UiPath, Automation Anywhere) and AI workflow tools (Zapier AI, Make.com).

The moat thickens with each layer:
- v2.x: deliverable artifact quality
- v3.0: persistent project memory (switching cost = remembered context)
- v4.0: trained recipe library (switching cost = 6+ months of recipe authoring)

---

## What to do now (before v4.0 starts)

Nothing in code. But:

- Architectural decisions for v3.0 should not preclude v4.0. Specifically: the memory-system choice (Mem0 / Zep / Letta) should be one that supports per-Hatch action history, not just dialogue history.
- v2.1's frozen-rubric design should accommodate a future "action-rubric" mode where the rubric scores executed-action outcomes, not just artifact quality.
- v2.6's red-team patterns should accommodate a future "recipe red-team" mode where attack vectors target *executed actions* (e.g., "did this recipe accidentally email confidential data?").

These are *non-restrictions* on the v2.x design — keep options open, don't lock in.

---

## When to revisit this seed

- After v3.0 ships and stabilizes for ≥30 days
- After v2.6 (Trust & Safety) is implemented or explicitly deferred
- If a customer ask explicitly names computer-use ("can your Hatch actually post to LinkedIn?") with willingness to pay 5x current pricing
- If a competitor ships a similar capability and you need to match

At any of those triggers: revisit this file, validate constraints still hold, scope a real milestone, run `/gsd-new-milestone v4.0`.

---

## Source repo

ghost-os: <https://github.com/ghostwright/ghost-os>

Companion projects worth tracking:
- shadow: 14-modality capture, on-device LLM
- specter: deploy persistent agents to dedicated VMs
