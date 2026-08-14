# Hatchin Character System: Generation Brief

**Reference:** `website-clones/clickup.com/brain-agents` (ClickUp Super Agents page, mirrored 2026-08-02)
**Written:** 2026-08-02
**Status:** brief only. No `client/src` files touched. Nothing approved yet.

---

## 1. What the reference actually does

I served the clone and walked the whole page (13,918px desktop). Six distinct patterns, each named
by its production class so you can find it in the mirror.

| # | Pattern | Class in the clone | What it does | Verdict |
|---|---|---|---|---|
| A | **Character-as-hero** | `AgentHeroPin_heroContainer__tLYIb` | One cut-out character, huge, dead-centre. Giant wordmark sits *behind* them; the character occludes the type. Radial glow behind the head in the character's own colour. Headline + 2 buttons sit low, overlapping the chest. | **Steal the composition, not the layout**, you already like your video hero |
| B | **Role carousel** | `AgentCarousel_carouselHeader__NaNiH` | Horizontal cards, one per role (PM / Sales / Coding / Designer). Card background tinted to that character's colour at ~8% . Character photo bleeds past the card edge. Cards sit at staggered vertical offsets. `+` affordance bottom-right. | **Steal outright**, this is the fix for our dead bento |
| C | **Character as demo companion** | `human-skills-section` | Product mock on the right; the character stands in the bottom-right corner *overlapping* it, with a coloured speech pill ("I'll write an email to our vendor…") in their hue. The character is visibly doing the thing the UI shows. | **Steal outright**, highest value pattern on the page |
| D | **Wireframe capability morph** | `dark-section` / `si-tabs` | Same character silhouette rendered as a polygon wireframe with a glowing brain. A numbered list (01 Memory → 07 Feedback) swaps the visual per capability. | **Adapt**, maps 1:1 onto our real features |
| E | **Task marquee** | `marquee-section` | Multi-row infinite marquee of verb phrases (WRITE COPY / ANALYZE DATA / DRAFT EMAILS), alternating scroll direction per row. | **Adapt**, cheap, and we have 30 roles of real verbs |
| F | **Group finale** | `cta-final` | 5 characters in a line on a magenta→orange gradient stage. Centre character largest, flanking ones progressively smaller and set back. CTA button sits over the centre character's chest. | **Steal outright**, replaces our current footer CTA |

**Skipped deliberately:** the ASCII-art section, the "8,721,054 tasks automated" counter (we have no
such number and inventing one repeats the fake-testimonial problem), and the pinned scroll-hijack, which
we already have too much of.

---

## 2. There are two competing directions in that folder

`website-clones/` contains both:

1. **ClickUp's photoreal humans**, masked, monochrome, adult, serious.
2. **`Premium Hatching Creature Animation.mp4`**, a 3D hatchling creature with big eyes emerging
   from an egg. Warm, cute, Pixar-adjacent.

These cannot coexist as the character system. Pick one.

**Recommendation: photoreal humans.** Hatchin's entire proposition is "they push back, they
disagree with you, they're colleagues not chatbots." A cute creature reads as a mascot, and mascots
don't argue with you. The pushback quotes on the landing page would fight their own illustrations.

**Keep the hatchling anyway, in one place:** as the loading/empty state, which is exactly where
`EggHatchingAnimation.tsx` already lives. Egg = the brand and the moment of creation. Humans = the
team. That division is coherent and you lose nothing.

---

## 3. The mask: decided 2026-08-02

**Superseded.** This section originally argued against a mask. The first anchor render proved the
larger point wrong in a more useful way: the render came back looking like a ClickUp character
because v1 kept ClickUp's *actual* signature (hair dyed to match, their exact henley, white studio)
and only changed the eye device. A mask was never the problem. Under-differentiating everything
else was.

**Decision: we do use a mask, and it is ours.** The **Shell Visor**: an asymmetric eggshell-fragment
band across the eyes, matte ceramic, tinted to each teammate's own role colour, with a single
hairline fracture glowing warm orange from within.

**The inversion that makes it ours, not theirs:** ClickUp's mask is the *same rainbow on every
character*, which says "all agents are one brand." Ours is *each character's own colour*, with the
orange crack as the only constant, which says "each teammate is distinct, same origin." That is the
real product difference, worn on the face.

Two alternates are specified in the prompt pack for side-by-side testing: **Fracture** (covers one
eye, breaks away across the bridge, other eye bare) and **Emberglass** (translucent amber band lit
from within, no shell texture).

What we still do not copy: the rounded-rectangle silhouette, the shared multi-colour gradient, and
the wordmark debossed on the corner. Those three are the recognisable parts.

Full specs and prompts: [NANO-BANANA-PROMPTS.md](./NANO-BANANA-PROMPTS.md).

---

## 4. The style bible: the part that must NEVER vary

This is what makes 30 separate generations look like one cast instead of 30 stock photos. Every
value here is locked across every character, every pose, forever.

**Revised 2026-08-02 (v2).** Four of these changed after the first render came back too close to
the reference. Old values in strikethrough.

- **Framing:** head and shoulders, chest crop just below the collarbone
- **Angle:** dead-on, facing camera, no tilt, no three-quarter (except the named pose variants)
- **Expression:** calm, neutral, alert. **Closed mouth. No smile.** Direct eye contact with lens
- **Eye device:** Shell Visor, asymmetric, matte ceramic, character's own colour, orange fracture
- **Wardrobe:** plain crew-neck fine merino, clean unbroken neckline, no placket or buttons
  ~~fine-knit mock-neck henley with 3 tonal buttons~~
- **Hair:** natural colour, varied texture and length ~~dyed to exactly match the garment~~
- **Colour rule:** one saturated colour per character, carried by **garment and visor**, not hair
- **Light:** nocturnal. Warm amber key low and in front, as if from a screen below the frame. Cool
  blue rim behind ~~large softbox key above eye level, faint warm rim~~
- **Lens:** 85mm, f/4, sharp on the eyes
- **Background:** near-black charcoal seamless ~~pure white seamless~~
- **Skin:** true to life, unretouched, visible texture

The lighting change is not arbitrary: it matches the existing hero video, which is warm faces lit by
laptop screens against a cool night sky. The characters now belong to the same world as the page
they sit on.

**Deliberate casting variety** across the set: mix ages (mid-20s to late-50s), genders, ethnicities,
hair textures and lengths. The colour treatment and the visor are what unify them, so the *people*
should be visibly different. A cast of 30 near-identical faces would look synthetic and would also
be a poor representation of who actually builds software.

---

## 5. Colour assignments

Pulled from `shared/roleRegistry.ts`, these are already the agent's colour everywhere in the app
(bubbles, avatars, sidebar), so the character photo will match the UI automatically.

| Character | Role | Hex | Colour name for the prompt |
|---|---|---|---|
| **Maya** | Idea Partner | `#14b8a6` | teal |
| **Alex** | Product Manager | `#3b82f6` | cobalt blue |
| **Dev** | Backend Developer | `#f97316` | bright orange |
| **Cleo** | Product Designer | `#a855f7` | violet |
| **Zara** | Creative Director | `#c026d3` | magenta |
| **Kai** | Growth Marketer | `#16a34a` | grass green |
| **Mira** | Content Writer | `#eab308` | golden yellow |
| **Sam** | QA Lead | `#f43f5e` | rose red |
| Finn | UI Engineer | `#06b6d4` | cyan |
| Rio | Data Analyst | `#4f46e5` | indigo |
| Robin | SEO Specialist | `#d97706` | amber |
| Nyx | AI Developer | `#7c3aed` | deep violet |
| Roux | Designer | `#ec4899` | pink |
| Quinn | Operations Manager | `#475569` | slate grey |

The first eight are the launch set, enough for the landing page, the role carousel, and the group
finale. The remaining 22 come later, from the same locked template.

---

## 6. The prompts

**Moved.** The prompts now live in [NANO-BANANA-PROMPTS.md](./NANO-BANANA-PROMPTS.md), cut
specifically for Nano Banana and revised to v2 after the first anchor render came back too close to
the reference.

That file is the single source of truth for anything you paste into a generator. It contains:

- the v1 vs v2 diagnosis table (what made the first render look like ClickUp)
- the three Shell Visor variants to test side by side
- **Prompt A**, the Maya anchor, run cold
- **Prompt B**, the other seven, run with Maya attached as reference
- **Prompt C**, four pose variants mapped to real product surfaces
- **Prompt D**, the group finale
- repair lines for the failure modes worth expecting

Colour assignments stay in section 5 above. Do not paste prompts from anywhere else: an older
version is still cached in this conversation's history and it carries the wrong wardrobe,
background and hair rule.


## 7. Output specs

| Asset | Format | Size | Notes |
|---|---|---|---|
| Hero / group finale | WebP + AVIF | 2400px wide | The reference ships `character-left.webp` at 2517×3146 |
| Role-card character | WebP | 1200px wide | Bleeds past the card edge, so generate wider than the crop |
| Companion (Pattern C) | WebP | 900px wide | Sits in a corner overlapping a mock |
| Avatar | WebP | 256px square | Tight crop on the face from the neutral pose |

**Processing after generation:**
1. Background removal to true transparency, do not ship the white background
2. Export WebP at quality 82, plus an AVIF sibling
3. **Budget: 250KB per character asset, hard ceiling.** The reference's own hero character is 432KB
   and that's already heavy. Our current hero video is 13.8MB, which is the single worst thing on
   the page, replacing motion with a still character is a performance *win*, and we should not
   squander it
4. Every image needs a real `alt`, "Dev, backend developer", not "character"

---

## 8. Where each asset lands

| Component | Pattern | Character assets needed |
|---|---|---|
| `LandingBento.tsx`, the 5,400px scroll-hijack | Replace with **B** (role carousel) | 4 to 6 neutral, at card scale |
| Pushback section (already good) | Add **C** treatment | 3 neutral, Dev, Coda, Alex |
| `how-it-works-bento.tsx` | Add **C** companions | 3 working poses |
| Footer CTA | Replace with **F** | 1 group image |
| Capability section (new) | **D** wireframe morph | 1 character, 7 states |
| Between sections | **E** marquee | none, type only |

---

## 9. Open questions for you

1. **Photoreal humans or the hatchling creature?** (§2)
2. **Which signature device**, hatch-glow rim, monochrome-only, or visor? (§3)
3. **Which generator** are you using? Midjourney, Flux, and Nano Banana each want the prompt
   phrased slightly differently, and character-consistency is handled differently in each. Tell me
   which and I'll re-cut the prompts for it specifically.
4. **Do you want the eight launch characters, or a smaller set of three** to prove the pipeline
   before committing to a full cast?

---

## 10. One legal note

Generated faces are fine. Do not feed a photograph of a real person in as a reference image.
That produces a likeness you do not have rights to. Keep the prompts text-only, or reference only
your own earlier generations.
