# Hatchin Pre-Launch Audit, Remediation Plan (GSD)

Source: the 2026-08-12/13 live audit (report artifact 30fd4404). Every item below is Problem to Fix,
with the owning file and severity. Grouped into GSD phases by launch-criticality. No em dashes per house style.

Legend: P0 = launch blocker, P1 = before scale/pitch, P2 = polish. [C] = clean file, [S] = currently
modified by the parallel session (edit surgically, re-read first).

---

## PHASE R0, Launch blockers (must fix before public launch or taking money)

R0-1 [P0] Autonomous execution ships empty output.
- Problem: a live run produced the one-word "Let's" as a finished task, marked "Done, no review needed."
- Fix: apply the DeepSeek reasoning-token floor (DEEPSEEK_MIN_MAX_TOKENS, used by chat) to the autonomy
  generation call; force peer review on any autonomously produced deliverable before status=completed.
- Files: server/autonomy/execution/taskExecutionPipeline.ts, server/ai/deliverableGenerator.ts,
  server/autonomy/peerReview/peerReviewRunner.ts.

R0-2 [P0] The paid wall is off; claims not enforced; nobody can pay.
- Problem: FEATURE_BILLING_GATES=false makes every gate pass through; UI/Terms advertise 3-projects/Pro-only;
  no Stripe keys, checkout 503s.
- Fix: decide, either turn gates on + set Stripe keys + verify the free wall fires live, or strip the
  unenforced claims from UpgradeModal, AccountPage, Terms.
- Files: server/middleware/tierGate.ts, .env, client/src/components/UpgradeModal.tsx, legal/TermsContent.tsx.

R0-3 [P0] AI finance/legal documents ship with no disclaimer.
- Problem: financial-model has no disclaimer; the scaffold disclaimer evaporates on generation; PDF is
  branded and authoritative.
- Fix: inject a mandatory "AI-generated, not professional advice, verify with a licensed professional"
  block into the generator system prompt for money/legal/tax/health types; render it in ArtifactPanel and
  the PDF footer; add to the financial-model spec.
- Files: shared/deliverableTypes.ts, server/ai/deliverableGenerator.ts, server/ai/pdfExport.ts,
  client/src/components/ArtifactPanel.tsx [S].

R0-4 [P0] Uploaded documents cannot be deleted; no account-deletion path.
- Problem: project purge skips conversation_documents/chunks (no cascade); no deleteUser anywhere.
- Fix: cascade-delete the raw-SQL doc tables in purgeProject; implement storage.deleteUser + DELETE
  /api/account behind re-auth.
- Files: server/storage.ts, scripts/setup-conversation-docs-tables.ts, server/routes (new account route).

R0-5 [P0] Privacy Policy is a stale, unreviewed draft.
- Problem: names old Neon/US database (now Supabase/Singapore), omits OpenAI + LangSmith subprocessors,
  stamped DRAFT.
- Fix: rewrite subprocessor list + residency, add missing processors, clear the draft banner with legal review.
- Files: client/src/components/legal/PrivacyContent.tsx.

R0-6 [P0] Zero product analytics.
- Problem: no PostHog/GA/custom events anywhere; cannot see signup, activation, drop-off.
- Fix: add analytics with a six-event spec (signup, project_created, first_message, deliverable_generated,
  upgrade_clicked, checkout_completed); server-side for money events.
- Files: new client/src/lib/analytics.ts, wired at key call sites; server webhook path.

R0-7 [P0] $20/day global spend ceiling + no PITR.
- Problem: COST_GUARD_GLOBAL_DAILY_CENTS=2000 will outage chat at modest traffic; Supabase PITR off.
- Fix: raise the ceiling to real burn tolerance, set OPS_ALERT_WEBHOOK_URL, enable Supabase PITR (dashboard).
- Files: server/billing/costGuard.ts, .env, Supabase dashboard.

---

## PHASE R1, Core-feature and reliability fixes (before scale / serious pitch)

R1-1 [P1] Reader test missing on structured docs + fails silently.
- Fix: extend reader test to structured pack doc types (or explain absence); add explicit reviewing /
  no-issues / could-not-complete states so it never silently no-ops.
- Files: shared/deliverableTypes.ts, server/ai/readerTestReviewer.ts, ArtifactPanel.tsx [S],
  deliverable/ReaderTestBanner.tsx.

R1-2 [P1] Pack docs have no rubric; misleading "0.0" chip.
- Fix: hide the score chip (or show "Not scored") when no rubric; add rubrics for pack doc types.
- Files: client/src/components/ArtifactPanel.tsx [S], server rubric config.

R1-3 [P1] Task creation from chat drops the assignee.
- Fix: apply the named agent to the created task (assignee), or stop claiming it in the confirmation.
- Files: server/ai/tasks/taskCreator.ts (+ lifecycle), server/routes/chat.ts.

R1-4 [P1] Two brain stores disagree; brain docs have no "what is this for."
- Fix: unify chat-attachment brain and the Brain-tab knowledge base (or surface promoted attachments in the
  KB list); on upload auto-generate a one-line summary + category and show them on the card.
- Files: server/routes/projects.ts, server/knowledge/rag/conversationDocs.ts,
  client/src/components/sidebar/BrainDocsTab.tsx [S], sidebar/DocumentCard.tsx [C].

R1-5 [P1] Payments not launch-complete.
- Fix: enable Stripe Tax + address collection (EU VAT/UK/India GST); handle invoice.paid/charge.refunded;
  make webhook idempotency atomic.
- Files: server/billing/checkoutService.ts, webhookHandler.ts.

R1-6 [P1] Autonomy double gate + cost tracked as $0.
- Fix: one source of truth for the trigger gate and the budget ledger; guard the ledger INSERT at limit 0;
  thread real token usage + model into recordUsage on the autonomy path.
- Files: server/middleware/tierGate.ts, server/autonomy/config/policies.ts,
  server/autonomy/execution/taskExecutionPipeline.ts, budgetLedger.ts.

R1-7 [P1] Ops: Sentry not installed, migrations drift, no socket heartbeat.
- Fix: npm i @sentry/node + SENTRY_DSN; baseline migrations + switch to migrate; add a ws ping/pong heartbeat.
- Files: package.json, migrations/, server/routes/chat.ts.

R1-8 [P1] Security: cross-tenant reaction write; WS no Origin check; brain-upload no magic-byte sniff; dep vulns.
- Fix: ownership-check the reaction agentId (or ignore it); add Origin allowlist to the socket upgrade; call
  sniffUpload in brain upload; bump ws/multer/drizzle.
- Files: server/routes/messages.ts, server/routes/chat.ts, server/routes/projects.ts, package.json.

R1-9 [P1] Peer-review judge fail-opens when Groq is rate-limited.
- Fix: calibrate on a paid Groq tier; consider a fallback judge model family; alarm on judge unavailability.
- Files: server/autonomy/peerReview/llmJudge.ts.

---

## PHASE R2, UI/UX polish (start here per user, browser-first each fix)

Ordered by value-to-effort. [C] first to avoid parallel-session collisions.

R2-1 [P2][C] Brain document card is not self-documenting.
- Problem: shows only filename + file-type chip + date; no sense of what the doc is or how the team uses it.
- Fix: fix the forwardRef console warning; add a one-line content preview (from stored content) + a plain
  "Your team reads this when they work" purpose line + a human doc-type label. (Auto-summary is R1-4.)
- File: client/src/components/sidebar/DocumentCard.tsx [C].

R2-2 [P2][C] Sidebar tabs are keyboard-unreachable.
- Fix: add ArrowLeft/ArrowRight/Home/End handling (or set all tabs tabIndex 0).
- File: client/src/components/sidebar/SidebarTabBar.tsx [C].

R2-3 [P2][C] Retry on a failed message is a dead stub.
- Fix: wire it to re-send, or remove it.
- Files: client/src/components/MessageBubble.tsx [C], CenterPanel.tsx [C].

R2-4 [P2][S] Silent-failure toasts.
- Fix: add onError toasts to restore/iterate/reader-test/delete mutations and the autonomy-settings save;
  distinguish error from empty in sidebar fetches.
- Files: ArtifactPanel.tsx [S], AutonomySettingsPanel.tsx [S], ActivityTab.tsx, RightSidebar.tsx.

R2-5 [P2][S] Misleading "0.0" score chip.
- Fix: show "Not scored" (or hide) when no rubric.
- File: ArtifactPanel.tsx [S].

R2-6 [P2][S] Copy gives no confirmation.
- Fix: add a "Copied" toast.
- File: ArtifactPanel.tsx [S].

R2-7 [P2] Empty Activity tab for ordinary use.
- Fix: surface ordinary team activity (messages/tasks/deliverables), or hide the tab until autonomy is on.
- Files: sidebar/ActivityTab.tsx, hooks/useAutonomyFeed.ts.

R2-8 [P2] Mid-word truncation of names ("Membershi...").
- Fix: wrap to two lines instead of ellipsis (self-documenting rule).
- Files: ArtifactPanel.tsx [S] (DeliverableList), ProjectTree.tsx [S].

R2-9 [P2] Accessibility: aria-labels on ArtifactPanel icon buttons; global reduced-motion guard; contrast on
  11px muted text; ProjectNameModal focus trap.
- Files: ArtifactPanel.tsx [S], client/src/index.css, ProjectNameModal.tsx [S].

R2-10 [P2] Design-system + weight cleanup (large, non-blocking): consolidate ~1,300 hardcoded colors to
  tokens, standardize on the shared Button, one type scale, one card radius; shrink the 1.9MB bundle and the
  1MB logo; delete the 10 orphaned files.
- Files: many (tracked as a separate cleanup pass).

---

## Execution order for UI/UX (this session)
1. R2-1 DocumentCard (clean, high value, user's flagged concern), browser-first.
2. R2-2 SidebarTabBar keyboard nav (clean).
3. R2-3 Retry stub (clean).
4. Then the [S] items (0.0 chip, copy toast, silent-failure toasts), re-reading each file fresh + surgical.
Each fix: show current state in the browser, apply the fix, show the result, verify no regressions.
