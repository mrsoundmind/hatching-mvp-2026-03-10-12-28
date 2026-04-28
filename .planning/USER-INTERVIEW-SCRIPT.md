# User Validation Interview Script

> **Purpose:** validate `ROADMAP-V2.md` against real user signal before committing 12-15 months of execution.
> **Target:** 8-12 active Pro users (interaction in last 30 days).
> **Time:** 25 minutes per call. 30 if conversation flows.
> **Format:** voice/video, recorded with permission, take notes during not after.
> **Goal:** find which milestones users actually want, in what order. Validate or invalidate the synthesis.

---

## Pre-call (5 min before each)

Open the user's account in admin view. Note:
- Active project count, primary Hatch usage, last 5 sessions' rough topic
- Tier (Free / Pro / grace), signup date
- Any tickets/feedback they've sent

Lets you anchor questions in their actual behavior, not abstractions.

---

## Opening (2 min)

> "Thanks for hopping on. I'm working on what to build next in Hatchin and want your honest read on where it falls short today and what would make it actually load-bearing for you. I'd rather hear what's broken than what's good. About 25 minutes. Cool to record so I can re-listen?"

If they hesitate on recording: take handwritten notes only, that's fine.

---

## Question 1 — Pain (5 min)

> "Walk me through the last time you used Hatchin and felt frustrated. What were you trying to do? What did the Hatch do or not do?"

**Listen for:** specific stories, not generalities. Get them naming actual Hatches, actual outputs, actual moments.

**Follow-ups (use 1-2):**
- "What did you do instead — did you abandon, switch to ChatGPT, do it manually?"
- "Was that the first time, or does that happen often?"

**Why it matters:** anchors the conversation in real behavior. Pain stories surface latent feature requests they wouldn't articulate when asked directly.

---

## Question 2 — Trust (5 min)

> "When a Hatch refines a deliverable for you, do you trust the new version is better than the old one? How do you check?"

**Listen for:** whether they verify or just hope. Whether they've ever caught a refinement making things worse.

**Follow-ups (use 1-2):**
- "If a refinement made the deliverable worse and you didn't notice — would that bother you, or is good-enough good enough?"
- "Have you ever wished the system told you 'this version isn't actually better, want to revert?'"

**Why it matters:** validates v2.1 (frozen rubrics, auto-revert). If users say "I don't really verify, I just trust," v2.1 might be over-engineering. If they say "yes, this happens to me," v2.1 is the right priority.

---

## Question 3 — Memory (5 min)

> "When you come back to Hatchin after a few days, does the Hatch remember the relevant context from before, or do you find yourself re-explaining things?"

**Listen for:** explicit memory complaints. "Maya forgot we decided X" is a classic v3.0 signal.

**Follow-ups (use 1-2):**
- "Tell me about the last time you had to re-explain something to a Hatch."
- "If a Hatch said 'I remember you decided X on Apr 12 — does that still hold?' would that feel useful or creepy?"

**Why it matters:** validates v3.0 (mental models). High-frequency complaints here mean v3.0 should be earlier in the roadmap.

---

## Question 4 — Output format (5 min)

> "When a Hatch finishes a deliverable, what do you do with it? Walk me through what happens next."

**Listen for:** do they hand it to a human? Build it themselves? Translate it to another format? If they say "I rebuild it in Excel" or "I redo it in Keynote," that's v2.5 signal.

**Follow-ups (use 1-2):**
- "Has there been a deliverable you wished came in a different format?"
- "If a Hatch could give you the exact file format you need (Excel, PowerPoint, working prototype), how often would that save you real time?"

**Why it matters:** validates v2.5 (file formats). If users mostly consume in-product or paste into Slack, v2.5 is over-engineering. If they're constantly rebuilding outputs, v2.5 is critical.

---

## Question 5 — The dream (3 min)

> "Forget what Hatchin does today. If a Hatch could literally do anything for you — even things that sound impossible — what would you most want? Don't filter."

**Listen for:** *agency-level* requests ("send the email," "post to Slack," "fill out the form") = v4.0 signal. *Strategy-level* requests ("plan my whole launch," "decide my pricing") = v2.3/v2.4 signal. *Memory-level* requests ("remember everything about my project") = v3.0 signal.

**Follow-ups (use 1):**
- "If we built that tomorrow, would you pay 2x what you pay now? 5x?"

**Why it matters:** willingness-to-pay test for the most ambitious milestones (v3.0, v4.0). If they say "yes I'd pay 5x for that," it's worth the long road. If they shrug, the dream isn't load-bearing.

---

## Closing (2 min)

> "Last thing — anything I didn't ask about that's been bugging you, or that you wish I'd known to ask?"

**Listen for:** anything off-roadmap entirely. New axis, new feature category we haven't considered.

> "Really helpful. I'll send a note in a few weeks when we've shipped what came out of these calls."

---

## Per-call note format

Save each call as `.planning/user-interviews/USER-<id>-<date>.md`:

```markdown
# Interview: <user-id> on <date>

**Tier:** Pro / Free / grace
**Signup:** <date>
**Active:** <last 30d project + Hatch usage summary>

## Q1 — Pain
- <specific story 1>
- <specific story 2>

## Q2 — Trust
<paraphrase>

## Q3 — Memory
<paraphrase>

## Q4 — Output format
<paraphrase>

## Q5 — Dream
<paraphrase>

## WTP signal
<exact words on willingness to pay>

## Surprises / off-roadmap
<anything that didn't fit the script>

## Direct quotes (verbatim)
- "<best quote 1>"
- "<best quote 2>"
```

---

## Synthesis after all calls

Save as `.planning/USER-VALIDATION.md`:

1. **Pain heatmap** — frequency of each pain by category (trust / memory / format / agency / other)
2. **Top 3 milestones by validated demand** — ordered by user signal
3. **Milestones with weak/absent signal** — candidates to deprioritize or cut
4. **Off-roadmap categories users named** — new axes worth considering
5. **WTP confidence** — for each milestone, low/med/high willingness to pay

**Decision rule (from ROADMAP-V2.md):**
- 5+ users name same gap → that becomes v2.1 regardless of synthesis
- User signal points to gaps not in roadmap → add them, deprioritize unbacked
- User signal validates current v2.1 (autonomy trust) → proceed as written

---

## Anti-patterns to avoid in interviews

- **Don't pitch features.** Listening, not selling. If you describe v2.1 to them and ask "would you want this?", they'll say yes to be polite. Bias destroyed.
- **Don't ask hypothetical questions.** "Would you use X if it existed?" produces noise. Ground every question in actual past behavior.
- **Don't average across users.** One user with a sharp specific story beats five users with vague generalizations. Look for *intensity*, not consensus.
- **Don't skip the boring users.** Power users will praise you. Boring/lapsed users will tell you what's actually broken.
