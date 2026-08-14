# Hatchin Characters: Nano Banana Prompt Pack

**Generator:** Nano Banana (Gemini image)
**Signature device:** hatch-glow rim (warm orange backlight on the silhouette). No mask.
**Batch:** all eight launch characters.
**Companion doc:** [CHARACTER-BRIEF.md](./CHARACTER-BRIEF.md)

---

## How this pack is built for Nano Banana specifically

Three things differ from Midjourney-style prompting, and they shape everything below.

1. **No negative-prompt field.** Every exclusion is written as a positive statement instead.
   "Mouth closed" beats "no smile." There is one short `Avoid:` line at the end of each prompt,
   which Gemini does respect, but it is a backstop rather than the main mechanism.
2. **Prose, not tags.** Nano Banana reads a photographer's brief far better than a comma-separated
   keyword pile. The prompts below are full sentences on purpose. Do not compress them.
3. **Consistency comes from attaching an image, not from repeating words.** This is Nano Banana's
   real strength. You generate Maya once, then attach her as a reference for all seven others and
   for every pose. That is why the order of operations below matters more than the wording.

---

## Order of operations

Do these in order. Each step depends on the one before it.

| Step | What you do | Output |
|---|---|---|
| 1 | Run **Prompt A** (Maya) repeatedly until one image is exactly right | `maya-master.png` |
| 2 | Attach `maya-master.png`, run **Prompt B** seven times with the casting swapped | 7 more masters |
| 3 | Attach each master, run **Prompt C** variants | pose set |
| 4 | Attach 5 masters, run **Prompt D** | group finale |
| 5 | Background removal, WebP export, 250KB ceiling | shippable assets |

**Do not skip step 1.** Maya is the style anchor. If she is slightly off, all thirty inherit it.

---

## Revision, 2026-08-02: why v1 looked like ClickUp

The first anchor render came back reading as a ClickUp character with a different colour. Correct
diagnosis: v1 of this pack kept four things that are ClickUp's actual signature, not generic
portrait technique, and only swapped the eye device.

| Tell | v1 (wrong) | v2 (ours) |
|---|---|---|
| Hair | Dyed to exactly match the garment. Their single most recognizable move. | Natural hair. Colour lives in garment, visor and light |
| Garment | Fine-knit mock-neck henley, three tonal buttons. Literally their garment | Plain crew-neck fine merino, no placket, no buttons |
| Background | Pure white seamless, like their whole site | Near-black charcoal, like ours (`#0A0C13`) |
| Light | Flat softbox, faint rim | Nocturnal: warm screen-light key, cool rim. Matches our hero video |
| Eye device | Orange rim light only, too subtle to register | **Shell Visor** (below) |

Everything from here down is v2. Ignore any v1 prompt still cached elsewhere.

---

## The Hatchin visor

ClickUp's mask: symmetrical rounded rectangle, shared rainbow gradient, identical on all thirty,
"Super Agent" wordmark debossed on the corner.

Ours derives from the one thing they cannot have, which is hatching.

**The inversion that matters:** their mask is the *same* on everyone, saying "all agents are one
brand." Ours is **tinted to each teammate's own role colour**, and the only constant is the warm
orange crack, saying "each teammate is distinct, same origin." That is the actual product
difference worn on the face.

### Three variants to test

Generate Maya three times, once per variant, and pick before doing anything else.

**V1. Shell Visor** *(recommended)*

```
Across her eyes she wears a sculpted visor shaped like a fragment of eggshell. It
is a smooth curved band sweeping from temple to temple, noticeably wider and
deeper on the left than the right, so it reads as a piece broken off something
rather than a symmetrical mask. Its surface is matte ceramic in the same deep
teal as her sweater, with a faint pearlescent sheen and a fine natural speckle
like real shell. A single hairline fracture runs diagonally across it, and warm
orange light glows out from inside that crack, spilling faintly onto her cheek
below it. Her eyes are clearly visible through two clean openings in the visor.
```

**V2. Fracture**

```
Across her face she wears a broken ceramic visor. It covers her left eye
completely and sweeps across the bridge of her nose, then breaks away in a
jagged shell-like edge partway across, leaving her right eye entirely bare and
uncovered. The material is matte ceramic in the same deep teal as her sweater
with a faint pearlescent sheen. Warm orange light glows out from along the broken
edge where the shell has fractured. Her left eye is visible through a clean
opening; her right eye is unobstructed.
```

**V3. Emberglass**

```
Across her eyes she wears a single narrow band of translucent amber glass, edge
to edge from temple to temple, with softly rounded ends. It is lit faintly from
within, so it glows warm orange, and her eyes are visible through it as though
through tinted glass. The band is minimal and smooth, with no texture, no
speckle, and no fracture.
```

---

## Prompt A: Maya, the style anchor (v2)

Run this cold, with no reference image. The visor block below is **V1 Shell Visor**: to test the
others, swap that one paragraph and change nothing else.

```
A studio portrait photograph of a woman in her early forties, East Asian, with a
calm and observant face and fine lines around her eyes. She has natural black
hair in a sharp chin-length bob with a blunt fringe.

She wears a plain crew-neck fine merino sweater in a deep saturated teal, with a
clean unbroken neckline: no placket, no buttons, no collar detail.

Across her eyes she wears a sculpted visor shaped like a fragment of eggshell. It
is a smooth curved band sweeping from temple to temple, noticeably wider and
deeper on the left than the right, so it reads as a piece broken off something
rather than a symmetrical mask. Its surface is matte ceramic in the same deep
teal as her sweater, with a faint pearlescent sheen and a fine natural speckle
like real shell. A single hairline fracture runs diagonally across it, and warm
orange light glows out from inside that crack, spilling faintly onto her cheek
below it. Her eyes are clearly visible through two clean openings in the visor.

She faces the camera dead-on, squared to the lens, making direct eye contact. Her
expression is calm, neutral and alert, and her mouth is closed and relaxed.

The lighting is nocturnal. A warm amber key light sits low and in front of her,
as though she is lit by the screen of a laptop just below the frame, catching her
face, her throat and the front of her sweater. A cool blue rim light behind her
separates her shoulders and the crown of her head from the darkness. The
contrast between the warm front light and the cool edge is distinct.

Framing is head and shoulders, cropped just below the collarbone, head centred
with a little headroom. Shot on an 85mm lens at f/4, tack sharp on her eyes.

The background is a plain near-black charcoal seamless studio backdrop, unlit and
empty, with her figure separated from it by the cool rim light.

The result should look like a real editorial portrait photograph: natural
unretouched skin texture with visible pores, true-to-life skin tone, and honest
photographic detail. Vertical 4:5 portrait orientation.

Avoid: smiling, visible teeth, dyed or unnaturally coloured hair, buttons or
plackets on the sweater, any text or logos on the visor, a symmetrical or
rectangular mask shape, a rainbow or multi-colour gradient on the visor, glasses,
jewellery, hats, a white or light background, and airbrushed plastic-looking skin.
```

**What to check before you lock it:**
- The visor is **asymmetric**. If it comes back as a neat symmetrical rectangle, it is ClickUp again
- The visor is **one colour, her own**, with no rainbow gradient anywhere on it
- The orange crack actually glows and spills a little light onto the cheek
- Hair is natural black, not teal
- Neckline is clean, with no buttons
- Background is near-black, not white or grey
- Warm front light and cool rim are visibly different temperatures

**Repair lines if needed:**

| Problem | Add this sentence |
|---|---|
| Visor comes back symmetrical | `The visor is deliberately lopsided, clearly larger on one side, like a shard rather than a manufactured mask.` |
| Crack does not glow | `The fracture line emits light, as if something luminous is contained behind the shell.` |
| Too dark to read the face | `Her face is clearly lit and fully legible despite the dark surroundings.` |
| Looks like sci-fi VR goggles | `The visor is thin, close-fitting and ceramic, like porcelain or eggshell, not bulky technical eyewear.` |

---

## Prompt B: the other seven

**Attach `maya-master.png`.** Then run this once per character, swapping only the bracketed casting
line. Everything else stays word for word.

```
Using the attached photograph as the exact reference for photographic treatment,
create a portrait of a different person in the same series.

Match the attached image precisely in: the nocturnal lighting with its warm amber
key from below the frame and cool blue rim behind, lens and depth of field,
head-and-shoulders framing and crop height, dead-on camera angle, near-black
charcoal seamless background, colour response, and the calm closed-mouth
expression with direct eye contact. The sweater is the same plain crew-neck fine
merino with a clean unbroken neckline and no buttons.

They wear the same style of sculpted eggshell-fragment visor across the eyes:
the same asymmetric broken-shard shape, the same matte ceramic material with its
faint pearlescent sheen and fine speckle, and the same single hairline fracture
glowing warm orange from within. The only difference is its colour.

The person is different. This one is [CASTING], with natural [HAIR]. Their
sweater and their visor are both a deep saturated [COLOUR]. Their hair colour is
natural and is not dyed.

Everything else about the photograph should be indistinguishable from the
reference, as though both portraits were shot in the same session, minutes
apart, by the same photographer. Vertical 4:5 portrait orientation.

Avoid: smiling, visible teeth, dyed hair, buttons or plackets, a symmetrical or
rectangular visor, a rainbow or multi-colour visor, text or logos on the visor,
glasses, jewellery, hats, a white or light background, and plastic
over-retouched skin.
```

> **The visor is always the character's own colour, never a shared gradient.** If any render comes
> back with a rainbow visor, discard it. That is the single detail that would make the set read as
> a ClickUp copy.

### The seven casting lines

**Alex, Product Manager, cobalt `#3b82f6`**
- `[CASTING]` = a man in his mid-thirties, South Asian, steady and attentive, with light stubble
- `[HAIR]` = short cropped black hair, neatly cut
- `[COLOUR]` = cobalt blue

**Dev, Backend Developer, orange `#f97316`**
- `[CASTING]` = a man in his late twenties, white with freckled skin, quietly intense
- `[HAIR]` = messy medium-length auburn hair falling over the forehead
- `[COLOUR]` = bright orange

**Cleo, Product Designer, violet `#a855f7`**
- `[CASTING]` = a woman in her early thirties, Black, poised and appraising
- `[HAIR]` = tight natural black coils cropped close to the head
- `[COLOUR]` = violet

**Zara, Creative Director, magenta `#c026d3`**
- `[CASTING]` = a woman in her early fifties, Latina, confident with a level unimpressed gaze
- `[HAIR]` = long straight dark brown hair swept back behind the shoulders
- `[COLOUR]` = magenta

**Kai, Growth Marketer, green `#16a34a`**
- `[CASTING]` = a person in their late twenties with an androgynous presentation, mixed heritage, sharp and quick-eyed
- `[HAIR]` = a cropped undercut with longer textured length on top
- `[COLOUR]` = grass green

**Mira, Content Writer, yellow `#eab308`**
- `[CASTING]` = a woman in her mid-twenties, Middle Eastern, thoughtful and unhurried
- `[HAIR]` = long loose dark waves parted in the centre
- `[COLOUR]` = golden yellow

**Sam, QA Lead, rose `#f43f5e`**
- `[CASTING]` = a man in his late fifties, white, weathered and sceptical, with deep-set eyes
- `[HAIR]` = short grey hair receding at the temples
- `[COLOUR]` = rose red

> **Dev is `#f97316`, the same orange as the crack glow.** On him the fracture will not read,
> because it is orange light on an orange visor. Add this line to his prompt only:
> `Because his visor is orange, the light escaping the fracture reads as a brighter, whiter core
> rather than a colour shift, so the crack still separates clearly from the surrounding shell.`

---

## Prompt C: pose variants

**Attach that character's master image.** These are edits on a locked person, which is the thing
Nano Banana does best. Change nothing but the pose sentence.

```
Using the attached photograph, generate the same person again, identical in every
respect: same face, same hair, same sweater, same eggshell visor in the same
colour with the same glowing fracture, same nocturnal lighting, same near-black
background, same lens and crop. Only the pose changes.

[POSE]

Vertical 4:5 portrait orientation, matching the reference exactly in every other way.

Avoid: any change to the face, hair, garment colour, visor shape or colour,
lighting or background.
```

| Variant | `[POSE]` | Where it gets used |
|---|---|---|
| **Thinking** | `Both index fingers rest lightly against the temples, touching the outer edges of the visor. The head stays level and squared to the camera, and the light escaping the fracture in the visor is noticeably brighter than usual, as though something is working behind it.` | Agent thinking state, DeliberationCard |
| **Working** | `The head and shoulders turn slightly to look down and to the right at something just outside the frame, and one hand is raised near the chest, caught mid-gesture. The eyes follow the direction of the turn.` | Companion beside a product mock |
| **Handing off** | `One arm extends forward toward the camera with the palm open and turned upward, offering something. The eyes stay locked on the lens.` | HandoffCard |
| **Reviewing** | `The arms are folded across the chest and the head tilts very slightly to one side, with one eyebrow fractionally raised in evaluation. Eye contact is direct.` | Peer review, Fresh Reader Review |

Neutral is the only one you need for all eight. Generate the other four for **Maya, Dev, and Cleo
only** and reuse them. That is 8 neutrals plus 12 poses, so 20 renders for the launch set.

---

## Prompt D: the group finale

**Attach five masters: Kai, Alex, Dev, Cleo, Zara.** One composed scene beats five composited
cutouts, because the shared lighting is what sells it.

```
Using the five attached portraits as the exact references for these five people,
create a single group photograph of all five of them standing shoulder to
shoulder in one row, facing the camera dead-on, framed head and shoulders and
cropped just below the collarbone.

Keep each person exactly as they appear in their reference: the same face, the
same natural hair, the same crew-neck sweater in their own colour, and the same
eggshell-fragment visor in that same colour with its warm orange glowing
fracture. From left to right they are the green one, the blue one, the orange
one, the violet one, and the magenta one.

Arrange them in a shallow arc. The orange figure stands in the centre, closest to
camera and largest in frame. The blue and violet figures flank them, slightly
smaller and set a little further back. The green and magenta figures sit at the
outer edges, smaller still and further back again.

All five hold the same calm neutral expression with mouths closed and eyes on the
lens. The lighting is one continuous nocturnal setup across the whole group: a
warm amber key from low in front, as though from a screen just below the frame,
and a cool blue rim behind that separates every silhouette so each figure stands
clear of the one behind it. The five glowing visor fractures are the brightest
points in the frame.

Shot on an 85mm lens at f/4. Plain near-black charcoal seamless background.
Photorealistic editorial group portraiture with natural skin texture. Wide 16:9
landscape orientation.

Avoid: smiling, visible teeth, dyed hair, jewellery, hats, logos or text, uneven
or mismatched lighting between figures, overlapping heads, any figure looking
away from the camera, and a white or light background.
```

If Nano Banana drifts on faces across five people at once, fall back to generating them in two
groups of three (sharing the centre figure) and compositing on the shared dark background. The
lighting will still match because every master came from the same anchor.

---

## Output and processing

Nano Banana does not reliably produce true alpha channels. Every prompt above specifies a
near-black charcoal seamless background, which is both the world these characters live in and a
clean key source, because our page background is `#0A0C13`.

**The tradeoff, stated plainly:** dark-lit cutouts composite beautifully onto the dark landing page
and badly onto any light surface. If a light-background surface ever needs one of these characters,
that is a re-generation, not a re-edit. Worth it, because matching our actual page beats keeping a
theoretical option open.

| Asset | Source pose | Export | Width |
|---|---|---|---|
| Hero and group finale | group, or neutral | WebP + AVIF | 2400px |
| Role-card character | neutral | WebP | 1200px |
| Companion beside a mock | working | WebP | 900px |
| Avatar | neutral, tight face crop | WebP | 256px |

1. Key out the charcoal background to true transparency. Check the shoulder and hair edges, since
   the cool rim light is exactly where a careless key eats into the silhouette.
2. Export WebP at quality 82 with an AVIF sibling.
3. **250KB per asset, hard ceiling.** For reference, ClickUp's own hero character ships at 432KB and
   that is already heavy. Our current hero video is 13.8MB, so replacing it with a still is a large
   performance win. Do not spend the savings on oversized PNGs.
4. Real alt text on every image: `Dev, backend developer`, not `character`.

---

## Three things to watch

**The visor is the signature, so it has to be identical in shape across all thirty.** Same
asymmetric shard, same fracture angle, same material. Only the colour changes. Once Maya is locked,
compare every subsequent render against her at the visor specifically. That is where drift shows
first.

**Never let a visor come back as a rainbow gradient.** One colour per character, always their own.
That single detail is the difference between our system and a ClickUp copy.

**Do not attach photographs of real people as references.** Generated faces are fine. A real
person's photo produces a likeness you do not have rights to. Reference only your own earlier
generations.
