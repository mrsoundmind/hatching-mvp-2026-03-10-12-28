#!/usr/bin/env python3
"""
Port the ClickUp Super Agents component CSS into client/src/components/landing-v2/.

Reads the compiled stylesheets from the local mirror in website-clones/, keeps
only the rules belonging to the components we use, renames every ClickUp class
to an lv2- equivalent, scopes everything under .lv2, and neutralises URLs that
point at their CDN or the mirror.

Run:  python3 scripts/port-clickup-css.py
"""

import glob
import io
import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS_DIR = os.path.join(
    REPO, "website-clones/clickup.com/brain-agents/public/_next/static/css"
)
OUT = os.path.join(REPO, "client/src/components/landing-v2/clickup-ported.css")

# Components we actually render. Anything outside this list is skipped.
ALLOW_CLEAN = {
    # section header
    "cu-section-header", "header-eyebrow", "header-divider", "header-content",
    "header-left", "header-right", "header-title", "header-description",
    # final cta
    "cta-final", "cta-final-card", "cta-final-content", "cta-final-title",
    "cta-gradient-bg", "characters-container", "character", "noise-overlay",
    "btn-container",
    # marquee
    "marquee-section", "pills-wall", "pills-row", "cu-pill", "radial-mask",
    "pill-guy",
    # pinned character hero
    "pin-spacer", "super-agents-hero-description",
    # ascii portrait band
    "cta-callout-section", "ascii-line", "display-xl", "text-lg",
    # statement band
    "section-title", "section-description",
    # skill list with companion
    "human-skills-section", "pill-showcase", "showcase-container",
    "showcase-left", "showcase-right", "showcase-title", "showcase-pills",
    "showcase-image", "showcase-canvas", "expandable-pill", "pill-content",
    "pill-header", "pill-icon", "pill-label", "card-title", "card-description",
    "agent-container", "agent-image", "agent-dialog", "agent-dialog-overlay",
    "dialog-icon", "dialog-text", "column-row-text", "column-row-visual",
    "centered-column", "centered-cards-row", "centered-divider", "is-visible",
    # counter band
    "cta-vibe-section",
    # capability morph
    "capabilities-showcase", "dark-section", "superintelligence-content",
    "lined-content", "lined-sector", "ls-dashed", "dissect", "active",
    # technology header + stacked feature rows
    "technology-section", "two-cols", "feature-section-wrapper",
    "feature-section", "feature-col", "feature-left", "feature-right",
    "feature-title", "feature-desc", "feature-text", "feature-btn",
    # six-up capability grid
    "last-feature-section", "last-feature-left", "last-feature-title",
    "last-feature-desc", "feature-stack-title",
}
ALLOW_CLEAN_PREFIX = ("character-", "cap-")

# CSS-module classes, by their pre-hash name.
ALLOW_MODULE = {
    # AgentCarousel
    "agentCarousel", "carouselSection", "carouselHeader", "carouselWrapper",
    "carouselTrack", "carouselCard", "navButtons", "navBtn", "disabled",
    "mobileNav", "cardContent", "cardTitle", "cardLabel", "cardIcon",
    "cardTop", "plusButton", "cardMedia",
    # CUSectionHeader
    "cuSectionHeader", "headerEyebrow", "headerDivider", "headerContent",
    "headerLeft", "headerRight", "headerTitle", "headerDescription", "light",
    # CTAFinalCard
    "ctaDesktopButton", "ctaMobileButton",
    # AgentHeroPin
    "heroContainer", "heroText", "heroTitle", "subtitle", "sectionHeader",
    "sectionHeaderLeft", "sectionHeaderRight", "sectionTitle", "heroButtons",
    "heroContent", "scrollHint", "heroInner",
    # AgentHeroPin (rest)
    "actions", "actor", "actorWrapper", "agentFeatures", "agentFeaturesMobile",
    "arrowIcon", "bottomBlock", "buttonText", "ctaText", "ctaWrapper",
    "desktopOnly", "featuresContainer", "featuresGrid", "featuresIntro",
    "featuresIntroContent", "featuresLeft", "featuresRight", "indicatorBase",
    "indicatorOverlay", "indicatorText", "label", "leftTags", "mobileActor",
    "mobileOnly", "mobilePill", "mobilePillsRow", "mobileVisual", "noiseBg",
    "pinnedActor", "radialGlow", "rightTags", "scrollBackIndicator",
    "superpowers", "tm", "touchBackButton", "visualPlaceholder",
    # CTACallout
    "ctaCallout", "ctaContent", "ctaHeading", "ctaDescription",
    "ctaButtonWrapper", "asciiArt", "asciiText", "backgroundContainer",
    "characterImage", "gradientBg", "noiseOverlay", "visualEffectsContainer",
    # CTAVibe
    "ctaVibe", "ctaBg", "ctaStats", "statsLabel", "statsNumber",
    "character", "characterLeft", "characterRight", "dot", "dotGrid",
    "dotGridWrapper",
    # OneTwoCU
    "oneTwoCu", "sectionContent", "sectionDescription", "sectionEyebrow",
    "sectionTitle", "centered", "centeredText", "centeredTitle",
    "centeredDescription", "noBorders", "desktop", "mobile",
    # PillShowcase
    "pillShowcase", "showcaseCanvas", "showcaseContainer", "showcaseLeft",
    "showcasePills", "showcaseRight", "showcaseTitle",
    # ExpandablePill
    "expandablePill", "isExpanded", "pillContent", "pillHeader", "pillIcon",
    "pillLabel",
}
MODULE_PREFIXES = (
    "AgentCarousel", "CUSectionHeader", "CTAFinalCard", "AgentHeroPin",
    "CTACallout", "CTAVibe", "OneTwoCU", "PillShowcase", "ExpandablePill",
)

# Excluded on purpose.
#  - per-card decoration bound to ClickUp artwork we do not have
#  - their bespoke data visuals (analytics percentile, agents online, top
#    performers, radar, knowledge grid, audit log, permissions, retention).
#    Those depict ClickUp product data, so we build our own inner visuals
#    with Hatchin content and keep only their row structure.
DENY = re.compile(
    r"purple-cube|mystery|green-ghost|lightbox|contact-sales|tab-panel|"
    r"scrolling-code|orange-guy|blue-girl|overlay-card|overlay-agents|"
    r"certified|code-line|\borb\b|custom-agent|"
    r"analytics-|ambient-|performer|radar-|knowledge-|audit-card|"
    r"permissions-|reflection-|zero-retention|live-intel|dot-chart|"
    r"line-chart|milestone-|org-chart|org-avatar|org-member|org-role|"
    r"bar-block|clip-rect|overview-",
    re.I,
)

ANIM_KEYWORDS = {
    "linear", "infinite", "ease", "forwards", "normal", "both", "alternate",
    "none", "paused", "running", "reverse", "ease-in", "ease-out",
    "ease-in-out", "backwards", "alternate-reverse",
}


def blocks(s):
    """Split a stylesheet into (kind, head, body) triples."""
    i, n, out = 0, len(s), []
    while i < n:
        if s[i] == "@":
            j, semi = s.find("{", i), s.find(";", i)
            if j < 0 or (0 <= semi < j):
                i = semi + 1
                continue
            depth, k = 0, j
            while k < n:
                if s[k] == "{":
                    depth += 1
                elif s[k] == "}":
                    depth -= 1
                    if depth == 0:
                        break
                k += 1
            out.append(("at", s[i:j], s[j + 1:k]))
            i = k + 1
        else:
            j = s.find("{", i)
            if j < 0:
                break
            k = s.find("}", j)
            out.append(("rule", s[i:j], s[j + 1:k]))
            i = k + 1
    return out


def kebab(s):
    return re.sub(r"(?<!^)(?=[A-Z])", "-", s).lower()


MODULE_RE = re.compile(
    # Their hashed names can end in extra underscores (headerDescription___GBZv),
    # so capture the camelCase identifier only, never the separators.
    r"\.(?:" + "|".join(MODULE_PREFIXES) + r")_([A-Za-z][A-Za-z0-9]*)_{2,}[\w-]+"
)


def wanted(sel):
    if DENY.search(sel):
        return False
    for c in re.findall(r"\.([A-Za-z_][\w-]*)", sel):
        if c in ALLOW_CLEAN:
            return True
        if any(c.startswith(p) for p in ALLOW_CLEAN_PREFIX):
            return True
        m = re.match(r"(?:" + "|".join(MODULE_PREFIXES) + r")_([A-Za-z][A-Za-z0-9]*)_{2,}", c)
        if m and m.group(1) in ALLOW_MODULE:
            return True
    return False


def rename(sel):
    sel = MODULE_RE.sub(lambda m: ".lv2-" + kebab(m.group(1)), sel)

    def plain(m):
        n = m.group(1)
        if n.startswith("lv2-"):
            return "." + n
        if n in ALLOW_CLEAN or any(n.startswith(p) for p in ALLOW_CLEAN_PREFIX):
            return ".lv2-" + n
        return "." + n

    return re.sub(r"\.([A-Za-z_][\w-]*)", plain, sel)


def clean_body(b):
    b = re.sub(r"url\((?:\"|')?/?__external__[^)]*\)", "none", b)
    b = re.sub(r"url\((?:\"|')?https?://[^)]*\)", "none", b)
    b = re.sub(
        r"(?:" + "|".join(MODULE_PREFIXES) + r")_([A-Za-z][A-Za-z0-9]*)_{2,}[\w-]+",
        lambda m: "lv2-" + kebab(m.group(1)),
        b,
    )
    return b.strip()


def main():
    css = "\n".join(
        io.open(f, encoding="utf-8", errors="ignore").read()
        for f in sorted(glob.glob(os.path.join(CSS_DIR, "*.css")))
    )
    if not css:
        raise SystemExit(f"no stylesheets found in {CSS_DIR}")

    used_kf, kept, seen = set(), [], set()

    def note_kf(body):
        for m in re.finditer(r"animation(?:-name)?\s*:\s*([^;]+)", body):
            for tok in re.split(r"[,\s]+", m.group(1)):
                if re.match(r"^[A-Za-z][\w-]*$", tok) and tok not in ANIM_KEYWORDS:
                    used_kf.add(tok)

    for kind, head, body in blocks(css):
        if kind == "rule":
            if not wanted(head):
                continue
            cb = clean_body(body)
            note_kf(cb)
            rule = f".lv2 {rename(head).strip()}{{{cb}}}"
            if rule not in seen:
                seen.add(rule)
                kept.append(rule)
        elif head.strip().startswith("@media"):
            subs = []
            for k2, h2, b2 in blocks(body):
                if k2 == "rule" and wanted(h2):
                    cb = clean_body(b2)
                    note_kf(cb)
                    subs.append(f"  .lv2 {rename(h2).strip()}{{{cb}}}")
            if subs:
                kept.append(head.strip() + "{\n" + "\n".join(subs) + "\n}")

    keyframes, kf_seen = [], set()
    for kind, head, body in blocks(css):
        if kind == "at" and head.strip().startswith("@keyframes"):
            raw = head.split("@keyframes", 1)[1].strip()
            m = re.match(
                r"(?:" + "|".join(MODULE_PREFIXES) + r")_([A-Za-z][A-Za-z0-9]*)_{2,}", raw
            )
            name = "lv2-" + kebab(m.group(1)) if m else raw
            if name in used_kf and name not in kf_seen:
                kf_seen.add(name)
                keyframes.append(f"@keyframes {name}{{{body.strip()}}}")

    io.open(OUT, "w", encoding="utf-8").write(
        HEADER + "\n".join(kept) + "\n\n" + "\n".join(keyframes) + FIXUPS
    )
    print(f"rules: {len(kept)}  keyframes: {sorted(kf_seen)}  ->  {OUT}")


HEADER = """/* Landing v2: components ported from the ClickUp Super Agents reference.
 *
 * GENERATED FILE. Do not edit by hand.
 * Regenerate with:  python3 scripts/port-clickup-css.py
 *
 * Source: website-clones/clickup.com/brain-agents (mirrored 2026-08-02).
 *
 * These are the shipped layout, geometry and motion rules of their
 * components, lifted from the compiled stylesheet, re-namespaced to an lv2-
 * prefix and scoped under .lv2 on the page root. No ClickUp class name
 * appears in our markup, and this file cannot reach /landing or the app.
 *
 * Excluded on purpose: per-card decoration (purple cube, ascii agent, mystery
 * mask, lightbox, contact-sales card). Those are bound to ClickUp artwork we
 * do not have. References to their CDN and to the local mirror become `none`.
 */

"""

FIXUPS = """

/* -- Ports that need our own JS, and our palette --------------------------
 * Their cards ship opacity:0 and are faded in by GSAP ScrollTrigger, which we
 * did not port. Without this the rail renders blank. useReveal adds
 * .is-visible; reduced-motion users get the cards immediately.
 */
.lv2 .lv2-carousel-card { opacity: 1; }
.lv2 .lv2-reveal .lv2-carousel-card {
  opacity: 0;
  transform: translateY(34px);
  transition: opacity .7s cubic-bezier(.34,-.15,.36,1.15),
              transform .7s cubic-bezier(.34,-.15,.36,1.15);
  transition-delay: calc(var(--i, 0) * 90ms);
}
.lv2 .lv2-reveal.is-visible .lv2-carousel-card { opacity: 1; transform: none; }

/* Their page is white, ours is #0a0c13. Only colour changes here. Every
 * dimension, gap and duration above is theirs, untouched. */
.lv2 .lv2-header-title { color: #fff; }
.lv2 .lv2-header-description { color: rgba(255,255,255,.55); }
.lv2 .lv2-header-eyebrow { color: rgba(255,255,255,.4); }
.lv2 .lv2-header-divider { background: rgba(255,255,255,.1); }
.lv2 .lv2-nav-btn {
  background: rgba(255,255,255,.06); color: #fff;
  border: 1px solid rgba(255,255,255,.15);
}
.lv2 .lv2-nav-btn:not(:disabled):hover { background: rgba(255,255,255,.12); }
.lv2 .lv2-nav-btn:disabled { opacity: .3; cursor: default; }
.lv2 .lv2-marquee-section { background: #0a0c13; block-size: auto; padding: 96px 0; }
.lv2 .lv2-marquee-section:before { display: none; }
.lv2 .lv2-marquee-section h2 { color: #fff; }
.lv2 .lv2-pills-wall:after { background: linear-gradient(180deg, transparent, #0a0c13); }
.lv2 .lv2-cu-pill {
  color: rgba(255,255,255,.45);
  border-color: rgba(255,255,255,.09);
  background: rgba(255,255,255,.02);
}

@media (prefers-reduced-motion: reduce) {
  .lv2 .lv2-reveal .lv2-carousel-card { opacity: 1; transform: none; }
  .lv2 *, .lv2 *::before, .lv2 *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
}
"""

if __name__ == "__main__":
    main()
