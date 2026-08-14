# Landing v2: how the ClickUp components were ported

**Source:** `website-clones/clickup.com/brain-agents` (mirrored 2026-08-02)
**Target:** `client/src/components/landing-v2/`
**Route:** `/v2`. `/landing` is untouched.

---

## What "port" means here

Not a rewrite from scratch, and not a byte copy either.

- **Markup structure** is theirs, read out of `docs/research/hydrated-dom.html` and reproduced
  element for element.
- **CSS** is theirs, extracted from their compiled stylesheet by
  `scripts/port-clickup-css.py`, with every ClickUp class renamed to an `lv2-` equivalent and every
  rule scoped under `.lv2` on the page root.
- **Content** is ours. Roles, colours and thinking phrases come from `shared/roleRegistry.ts`.

Result: identical geometry and motion, no ClickUp class name in our markup, and nothing that can
reach `/landing` or the app.

## Why not paste their stylesheet verbatim

It is ClickUp's compiled production CSS. Structure, layout and motion are fair to learn from;
shipping their stylesheet under their class names is a different thing. The rename plus the `.lv2`
scope gets the identical component without carrying their code as-is.

---

## Regenerating

```bash
python3 scripts/port-clickup-css.py
```

Writes `client/src/components/landing-v2/clickup-ported.css`. That file is generated; do not hand
edit it. Anything we add lives in `landing-v2.css` instead.

The script:

1. concatenates every stylesheet under the mirror's `_next/static/css/`
2. keeps only rules whose selector touches a component in the allowlist
3. renames `Module_camelCase__hash` to `.lv2-kebab-case`, and the clean twins to `.lv2-*`
4. prefixes every rule with `.lv2 `, including inside `@media`
5. rewrites `url()` references to their CDN or the mirror as `none`
6. pulls in only the `@keyframes` the kept rules actually reference

## Verified values

Measured in a real browser at `/v2` against the reference stylesheet:

| Property | Reference | Ours |
|---|---|---|
| Carousel card, desktop | 320 x 480, radius 24 | 320 x 480, radius 24 |
| Carousel card, mobile | 230 x 380 | 230 x 380 |
| Even-card lift | `margin-block-start: -60px` | -60px desktop, 0 mobile |
| Section title | `clamp(42px, 5vw, 56px)` | 56px at 1440, 42px at 390 |
| CTA card height | 800px, 600px under 768 | 800 / 600 |
| `character-center` | 718px, 400px on mobile | 718 / 400 |
| Marquee rows | alternate `marquee-left` / `marquee-right` | alternating, 4 rows |
| CTA button swap | at 990px | correct button visible each side |

---

## Deliberate deviations

Each of these is a place the port could not be literal.

**Their GSAP was not ported.** Their cards ship `opacity: 0` and are faded in by ScrollTrigger.
Without their JS the rail renders blank, so `useReveal` (an IntersectionObserver) drives it instead.
The override is in the fixups block at the foot of the generated file.

**Their per-card decoration is excluded.** Purple cube, ascii agent, mystery mask, lightbox,
contact-sales card. All bound to ClickUp artwork we do not have, so porting them would add only dead
CSS. See `DENY` in the script.

**Their assets are substituted.** `cta-final/gradient-bg.webp` becomes a CSS gradient,
`noise.webp` becomes an inline SVG turbulence filter. Both in `landing-v2.css`.

**Colour and type are ours.** Their page is white and set in Plus Jakarta Sans. Ours is `#0a0c13`
and set in Poppins. Only colour and font-family are overridden; no dimension, gap or duration from
the port is touched.

**Reduced motion added.** Their page has no `prefers-reduced-motion` handling. Ours does.

---

## Gotchas found while porting

Worth knowing before touching any of this.

**Their button naming is inverted.** Above 990px the class called `ctaMobileButton` is the one
displayed, sitting inside `.btn-container`, absolutely positioned at `bottom: 64px` with
`z-index: 3` so it floats over the centre character's chest. Below 990px they swap to the in-flow
`ctaDesktopButton`. Both carry `!important`, so adding our own display rules only fights them.

**Triple-underscore module names.** `CUSectionHeader_headerDescription___GBZv` has three
underscores, and a naive `__` split produces `header-description_`, silently dropping the rule.
The script's regex captures the camelCase identifier only. If a component renders unstyled, check
this first.

**`.pills-row:nth-child(2n)` counts the character.** Their `pill-guy` image is the first child of
`.pills-wall`, so the first visible row is `:nth-child(2)` and scrolls right, not left. Ours does
the same because we kept their DOM order. This is faithful, not a bug.

**The base `.character` rule is easy to lose.** `.character-1` and friends set size and offsets,
but `position: absolute; inset-block-end: 0` lives on plain `.character`. Drop it and all five
figures stack at the top-left.

---

## Files

| File | Generated? | Purpose |
|---|---|---|
| `scripts/port-clickup-css.py` | no | the extractor |
| `clickup-ported.css` | **yes** | their rules, renamed and scoped |
| `landing-v2.css` | no | reveal, our own classes, asset substitutes, colour and type |
| `ExistingHero.tsx` | no | our current hero, copied verbatim from `LandingPage.tsx` |
| `CuSectionHeader.tsx` | no | their `cu-section-header` markup |
| `AgentCarousel.tsx` | no | their `AgentCarousel` markup |
| `PillsMarquee.tsx` | no | their `marquee-section` markup |
| `CtaFinal.tsx` | no | their `cta-final` markup |
| `CharacterSlot.tsx` | no | placeholder until the art exists |
| `characterAssets.ts` | no | the one file to edit when art lands |

`ExistingHero.tsx` is a copy, not an import, so `/landing` and `/v2` cannot break each other.
The cost is that a hero change has to be made in both places.

---

## Not ported yet

`human-skills-section` (the panel with the character standing in its corner) and the
`si-tabs` capability morph. Both need more of their JS than the others did. Say the word and
they are next.
