"""
Build a single comprehensive PDF documenting Hatchin's LLM architecture.
Combines:
  1. Provider Chain (DeepSeek primary, Gemini fallback, Groq free safety net)
  2. Autonomous & Background Work System (5 LLM-based vs 15+ zero-LLM subsystems)
  3. The smart 3-axis routing model
  4. Cost economics + rollback plan

Run: python3 scripts/build-llm-architecture-pdf.py
Output: docs/LLM-ARCHITECTURE.pdf
"""

import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, Preformatted, HRFlowable,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

# ─── Brand tokens ─────────────────────────────────────────────────────────
HATCHIN_BLUE = colors.HexColor('#6C82FF')
HATCHIN_DARK = colors.HexColor('#1E2235')
HATCHIN_GREY = colors.HexColor('#5A6378')
HATCHIN_BG_SOFT = colors.HexColor('#F4F6FB')
HATCHIN_GREEN = colors.HexColor('#22A06B')
HATCHIN_RED = colors.HexColor('#D8504D')
HATCHIN_ORANGE = colors.HexColor('#E07A1B')

OUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'docs', 'LLM-ARCHITECTURE.pdf'
)
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)


# ─── Styles ───────────────────────────────────────────────────────────────
base = getSampleStyleSheet()

style_cover_title = ParagraphStyle(
    'CoverTitle', parent=base['Title'],
    fontName='Helvetica-Bold', fontSize=34, leading=40,
    textColor=HATCHIN_DARK, alignment=TA_LEFT, spaceAfter=8,
)
style_cover_subtitle = ParagraphStyle(
    'CoverSub', parent=base['Title'],
    fontName='Helvetica', fontSize=16, leading=22,
    textColor=HATCHIN_GREY, alignment=TA_LEFT, spaceAfter=6,
)
style_cover_meta = ParagraphStyle(
    'CoverMeta', parent=base['Normal'],
    fontName='Helvetica', fontSize=10, leading=14,
    textColor=HATCHIN_GREY, alignment=TA_LEFT,
)

style_h1 = ParagraphStyle(
    'H1', parent=base['Heading1'],
    fontName='Helvetica-Bold', fontSize=22, leading=28,
    textColor=HATCHIN_DARK, spaceBefore=12, spaceAfter=8,
)
style_h2 = ParagraphStyle(
    'H2', parent=base['Heading2'],
    fontName='Helvetica-Bold', fontSize=15, leading=20,
    textColor=HATCHIN_BLUE, spaceBefore=14, spaceAfter=6,
)
style_h3 = ParagraphStyle(
    'H3', parent=base['Heading3'],
    fontName='Helvetica-Bold', fontSize=12, leading=16,
    textColor=HATCHIN_DARK, spaceBefore=10, spaceAfter=4,
)
style_body = ParagraphStyle(
    'Body', parent=base['Normal'],
    fontName='Helvetica', fontSize=10, leading=15,
    textColor=HATCHIN_DARK, alignment=TA_JUSTIFY, spaceAfter=6,
)
style_body_left = ParagraphStyle(
    'BodyLeft', parent=style_body, alignment=TA_LEFT,
)
style_caption = ParagraphStyle(
    'Caption', parent=base['Normal'],
    fontName='Helvetica-Oblique', fontSize=9, leading=12,
    textColor=HATCHIN_GREY, alignment=TA_LEFT, spaceAfter=8,
)
style_code = ParagraphStyle(
    'Code', parent=base['Code'],
    fontName='Courier', fontSize=8, leading=11,
    textColor=HATCHIN_DARK, leftIndent=8, rightIndent=8,
    backColor=HATCHIN_BG_SOFT, borderPadding=6,
    spaceBefore=4, spaceAfter=8,
)
style_callout = ParagraphStyle(
    'Callout', parent=base['Normal'],
    fontName='Helvetica', fontSize=10, leading=14,
    textColor=HATCHIN_DARK, leftIndent=10, rightIndent=10,
    backColor=HATCHIN_BG_SOFT, borderPadding=8,
    spaceBefore=4, spaceAfter=8,
)
style_tldr = ParagraphStyle(
    'TLDR', parent=base['Normal'],
    fontName='Helvetica', fontSize=11, leading=16,
    textColor=HATCHIN_DARK, leftIndent=12, rightIndent=12,
    backColor=HATCHIN_BG_SOFT, borderColor=HATCHIN_BLUE,
    borderWidth=0, borderPadding=10,
    spaceBefore=8, spaceAfter=10,
)


# ─── Page decorations ─────────────────────────────────────────────────────
def page_decoration(canvas, doc):
    """Draw the brand bar + page footer on every page (except cover)."""
    canvas.saveState()
    page_width, page_height = A4

    # Top brand bar
    canvas.setFillColor(HATCHIN_BLUE)
    canvas.rect(0, page_height - 4, page_width, 4, stroke=0, fill=1)

    # Footer
    canvas.setFillColor(HATCHIN_GREY)
    canvas.setFont('Helvetica', 8)
    footer = f"Hatchin LLM Architecture  •  Page {doc.page}  •  Confidential — internal use"
    canvas.drawCentredString(page_width / 2, 12 * mm, footer)
    canvas.restoreState()


def cover_decoration(canvas, doc):
    """Big brand bar + large page number for the cover."""
    canvas.saveState()
    page_width, page_height = A4

    # Big top brand block
    canvas.setFillColor(HATCHIN_BLUE)
    canvas.rect(0, page_height - 12, page_width, 12, stroke=0, fill=1)

    # Footer
    canvas.setFillColor(HATCHIN_GREY)
    canvas.setFont('Helvetica', 8)
    canvas.drawCentredString(
        page_width / 2, 12 * mm,
        "hatchin.app  •  Generated 2026-05-04  •  Branch: wip/pre-reset-2026-04-28"
    )
    canvas.restoreState()


# ─── Helpers ──────────────────────────────────────────────────────────────
def hrule():
    return HRFlowable(width="100%", thickness=0.5, color=HATCHIN_BG_SOFT,
                      spaceBefore=4, spaceAfter=10)


def code_block(text):
    return Preformatted(text, style_code)


def make_table(data, col_widths=None, header_row=True):
    t = Table(data, colWidths=col_widths, hAlign='LEFT', repeatRows=1 if header_row else 0)
    style = [
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), HATCHIN_DARK),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.25, HATCHIN_BG_SOFT),
    ]
    if header_row:
        style += [
            ('BACKGROUND', (0, 0), (-1, 0), HATCHIN_BLUE),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 9),
        ]
    # Alternate row shading
    if header_row:
        for i in range(1, len(data)):
            if i % 2 == 0:
                style.append(('BACKGROUND', (0, i), (-1, i), HATCHIN_BG_SOFT))
    t.setStyle(TableStyle(style))
    return t


# ─── Content ──────────────────────────────────────────────────────────────
story = []

# ═════════════ COVER ═════════════
story.append(Spacer(1, 80))
story.append(Paragraph("Hatchin LLM Architecture", style_cover_title))
story.append(Paragraph(
    "Provider Chain + Autonomous Work System",
    style_cover_subtitle
))
story.append(Spacer(1, 24))

cover_table_data = [
    ['Document version', 'v1.0 — Phase A complete'],
    ['Generated', '2026-05-04'],
    ['Branch', 'wip/pre-reset-2026-04-28'],
    ['Owner', 'Shashank'],
    ['Status', 'DeepSeek wired, eval gate pending'],
    ['Coverage', 'Provider chain + 20+ background subsystems'],
]
cover_meta_table = Table(cover_table_data, colWidths=[42*mm, 95*mm])
cover_meta_table.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
    ('TEXTCOLOR', (0, 0), (0, -1), HATCHIN_GREY),
    ('TEXTCOLOR', (1, 0), (1, -1), HATCHIN_DARK),
    ('FONT', (1, 0), (1, -1), 'Helvetica-Bold', 10),
    ('LEFTPADDING', (0, 0), (-1, -1), 0),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]))
story.append(cover_meta_table)

story.append(Spacer(1, 60))
story.append(Paragraph(
    "<i>This document combines two architectures into one: how Hatchin chooses "
    "an LLM provider per request (the chain), and which LLM (or zero-LLM rule) "
    "powers each background subsystem (autonomy, peer review, task suggestion, "
    "team auto-hatch, handoffs). It is the source of truth for cost reasoning, "
    "rollback procedures, and operational decisions.</i>",
    style_body
))
story.append(PageBreak())

# ═════════════ TABLE OF CONTENTS ═════════════
story.append(Paragraph("Contents", style_h1))
story.append(hrule())

toc_data = [
    ['1', 'Executive Summary', '3'],
    ['2', 'Architecture I — Provider Chain', '4'],
    ['2.1', 'The 3-axis routing model', '4'],
    ['2.2', 'The provider stack', '5'],
    ['2.3', 'Production fallback chain', '6'],
    ['2.4', 'Workload-specific preferences', '7'],
    ['2.5', 'Simple / Standard / Complex classifier', '8'],
    ['2.6', 'Worked examples', '9'],
    ['3', 'Architecture II — Autonomous & Background Work', '10'],
    ['3.1', 'TL;DR — 5 LLM-based vs 15+ zero-LLM subsystems', '10'],
    ['3.2', 'Per-subsystem mapping', '11'],
    ['3.3', 'Background work flow diagram', '13'],
    ['3.4', 'Cost economics of autonomy', '14'],
    ['4', 'Combined System Architecture', '15'],
    ['5', 'Groq vs Ollama — clearing the confusion', '16'],
    ['6', 'Operational Concerns', '17'],
    ['6.1', 'Rollback', '17'],
    ['6.2', 'Active risks', '17'],
    ['6.3', 'Acceptance criteria', '17'],
    ['7', 'File reference index', '18'],
]
toc_table = Table(toc_data, colWidths=[15*mm, 130*mm, 15*mm])
toc_table.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
    ('TEXTCOLOR', (0, 0), (-1, -1), HATCHIN_DARK),
    ('TEXTCOLOR', (0, 0), (0, -1), HATCHIN_BLUE),
    ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 10),
    ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LINEBELOW', (0, 0), (-1, -1), 0.25, HATCHIN_BG_SOFT),
]))
story.append(toc_table)
story.append(PageBreak())

# ═════════════ §1 EXECUTIVE SUMMARY ═════════════
story.append(Paragraph("1. Executive Summary", style_h1))
story.append(hrule())

story.append(Paragraph(
    "Hatchin's LLM stack runs on the principle that <b>routing decisions should be "
    "free, and only the actual reasoning should cost money.</b> "
    "After Phase A (commits 4d113a7 + 34c8f23), the architecture is:",
    style_body
))

summary_data = [
    ['Layer', 'Provider', 'Open source?', 'Role', 'Cost (per 1M tokens)'],
    ['1. Free primary',     'Groq Llama 3.3-70B',     'Yes (Meta)',     'Simple chat, task extract, compaction', '₹0'],
    ['2. Cost-optimized',   'DeepSeek V4-Flash',      'No (proprietary)', 'Standard / complex chat, deliverables', '₹12 in / ₹23 out'],
    ['3. Premium reasoning','DeepSeek V4-Pro',        'No (proprietary)', 'Pro autonomy + peer review',           '₹36 in / ₹73 out (promo)'],
    ['Hot fallback',        'Gemini 2.5-Flash / Pro', 'No',             'Auto-takes over on DeepSeek failure',  '₹104 / ₹417 in'],
    ['Free safety net',     'Groq Llama 3.3-70B',     'Yes',            'Last-resort fallback',                 '₹0'],
    ['Test mode only',      'Ollama Llama 3.1-8B',    'Yes (self-host)','Eval suite locally',                   '₹0 (your CPU)'],
    ['CI deterministic',    'Mock provider',          'n/a',            'Eval reproducibility',                 '₹0'],
]
story.append(make_table(summary_data, col_widths=[28*mm, 35*mm, 22*mm, 50*mm, 28*mm]))

story.append(Paragraph(
    "<b>OpenAI was removed from the default prod chain</b> in commit 34c8f23. It stays "
    "registered as an explicit escape hatch (set <font face='Courier'>LLM_PRIMARY=openai</font>) "
    "but never fires by default.",
    style_body
))

story.append(Paragraph(
    "<b>Cost impact (modelled).</b> Heavy Pro user economics flip from "
    "<font color='#D8504D'><b>−₹8,150/month loss</b></font> to "
    "<font color='#22A06B'><b>+₹699/month margin</b></font>. At 1,000 paid users, "
    "this is ~₹3.9 Cr/year in savings.",
    style_callout
))

story.append(Paragraph(
    "<b>Smart by design.</b> Out of 20+ background subsystems, only <b>5 actually call an LLM</b>. "
    "The rest are pure rules, regex, or scoring algorithms. Routing, expertise matching, "
    "cycle detection, trust scoring, intent classification, lifecycle commands — all zero-LLM.",
    style_body
))
story.append(PageBreak())

# ═════════════ §2 ARCHITECTURE I — PROVIDER CHAIN ═════════════
story.append(Paragraph("2. Architecture I — Provider Chain", style_h1))
story.append(hrule())

story.append(Paragraph("2.1  The 3-axis routing model", style_h2))
story.append(Paragraph(
    "Every LLM call is decided by three independent axes. Smart routing emerges from "
    "how they interact:",
    style_body
))

story.append(code_block(
"""┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   Axis 1: WORKLOAD       Axis 2: TIER        Axis 3: RUNTIME     │
│   (what kind of call?)   (free vs Pro?)      (prod vs test?)     │
│                                                                  │
│   simple chat            standard            prod                │
│   standard chat          premium             test                │
│   complex chat                                                   │
│   task extraction                                                │
│   compaction                                                     │
│   autonomy                                                       │
│   peer review                                                    │
│   deliverable gen                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘"""
))

story.append(Paragraph(
    "Each axis pulls from a different file. <b>Workload</b> preferences live in "
    "the workload's own code (e.g. <font face='Courier' size='9'>openaiService.ts:428</font> "
    "prefers Groq for simple chat). <b>Tier</b> is decided by "
    "<font face='Courier' size='9'>resolveModelForTier()</font> — premium goes to "
    "DeepSeek V4-Pro. <b>Runtime</b> is the global mode set by the "
    "<font face='Courier' size='9'>LLM_MODE</font> env var.",
    style_body
))
story.append(PageBreak())

# ─── §2.2 Provider stack ───
story.append(Paragraph("2.2  The provider stack", style_h2))
story.append(Paragraph(
    "Six providers are registered in <font face='Courier' size='9'>providerResolver.ts:24-30</font>. "
    "Three serve production, two are reserved for test/eval, and one (OpenAI) is an explicit-only escape hatch.",
    style_body
))

stack_data = [
    ['Provider', 'Class file', 'Mode', 'Models', 'Notes'],
    ['DeepSeek',  'deepseekProvider.ts', 'prod',     'V4-Flash, V4-Pro',          'Primary since 2026-04'],
    ['Gemini',    'geminiProvider.ts',   'prod',     '2.5-Flash, 2.5-Pro',        'Hot fallback'],
    ['Groq',      'groqProvider.ts',     'prod',     'llama-3.3-70b-versatile',   'Free (cloud), Llama 3.3'],
    ['OpenAI',    'openaiProvider.ts',   'opt-in',   'gpt-4o-mini',               'Removed from default chain'],
    ['Ollama',    'ollamaProvider.ts',   'test only','llama3.1:8b (configurable)', 'Self-hosted, prod-blocked'],
    ['Mock',      'mockProvider.ts',     'CI',       'mock-v1',                    'Deterministic stubs'],
]
story.append(make_table(stack_data, col_widths=[24*mm, 36*mm, 20*mm, 40*mm, 38*mm]))

story.append(Paragraph(
    "All providers implement the same <font face='Courier' size='9'>LLMProvider</font> interface "
    "(<font face='Courier' size='9'>providerTypes.ts:56-61</font>). They all expose "
    "<font face='Courier' size='9'>generateChat()</font>, <font face='Courier' size='9'>streamChat()</font>, "
    "and (optionally) <font face='Courier' size='9'>healthCheck()</font>. The resolver layer treats them "
    "as interchangeable; only the chain ordering matters at runtime.",
    style_body
))

story.append(Paragraph(
    "<b>Why DeepSeek uses the OpenAI SDK</b> — DeepSeek exposes an OpenAI-compatible REST endpoint "
    "at <font face='Courier' size='9'>https://api.deepseek.com/v1</font>. Our provider wraps the "
    "OpenAI Node SDK with a custom <font face='Courier' size='9'>baseURL</font>, mirroring how "
    "GroqProvider does the same. No proprietary SDK needed.",
    style_callout
))
story.append(PageBreak())

# ─── §2.3 Production chain ───
story.append(Paragraph("2.3  Production fallback chain", style_h2))
story.append(Paragraph(
    "When workload code does NOT specify a provider preference, "
    "<font face='Courier' size='9'>streamChatWithRuntimeFallback()</font> picks one via this 3-step process:",
    style_body
))

story.append(code_block(
"""STEP 1 — resolvePrimaryProvider()
  LLM_PRIMARY env var?      → respect it (explicit override)
  DEEPSEEK_API_KEY set?     → primary = deepseek    ← NEW DEFAULT
  GEMINI_API_KEY set?       → primary = gemini      ← FALLBACK PATH
  OPENAI_API_KEY set?       → primary = openai      ← OPT-IN ONLY
  otherwise                 → primary = gemini (will fail with clear error)

STEP 2 — buildProviderOrder() (production mode)
  primary = deepseek  → [deepseek, gemini?, groq?]
  primary = gemini    → [gemini, deepseek?, groq?]
  primary = openai    → [openai, gemini?, groq?]      (escape hatch)
  ('?' = only added if that API key is set)

STEP 3 — applyModelDefaults()
  deepseek + tier=premium  → DEEPSEEK_PRO_MODEL    || 'deepseek-v4-pro'
  deepseek + tier=standard → DEEPSEEK_MODEL        || 'deepseek-v4-flash'
  gemini                   → GEMINI_MODEL          || 'gemini-2.5-flash'
  groq                     → GROQ_MODEL            || 'llama-3.3-70b-versatile'
  ollama-test              → TEST_OLLAMA_MODEL     || 'llama3.1:8b'
  mock                     → 'mock-v1'"""
))

story.append(Paragraph("Visual chain (default config with all keys set)", style_h3))
story.append(code_block(
"""┌────────────────────────────────────────────────────────────────┐
│   ① DeepSeek V4-Flash      ← PRIMARY  ($0.14/$0.28 per 1M)     │
│        │                                                         │
│        │ on failure (network, 5xx, key missing)                  │
│        ▼                                                         │
│   ② Gemini 2.5-Flash       ← HOT FALLBACK ($0.15/$0.60 per 1M)  │
│        │                                                         │
│        │ on failure                                              │
│        ▼                                                         │
│   ③ Groq Llama 3.3-70B     ← FREE SAFETY NET  ($0)              │
│                                                                  │
└────────────────────────────────────────────────────────────────┘"""
))

story.append(Paragraph(
    "Each fall-through is logged. The response metadata carries "
    "<font face='Courier' size='9'>fallbackChain: ['deepseek']</font> if Gemini took over, so we can detect "
    "DeepSeek instability after deployment.",
    style_body
))
story.append(PageBreak())

# ─── §2.4 Workload preferences ───
story.append(Paragraph("2.4  Workload-specific preferences (override default chain)", style_h2))
story.append(Paragraph(
    "Some workloads bypass the default chain and call a specific provider directly via "
    "<font face='Courier' size='9'>generateWithPreferredProvider()</font> or "
    "<font face='Courier' size='9'>streamWithPreferredProvider()</font>. These preferences are the "
    "v1.2 cost-optimization design — preserved exactly, untouched by the DeepSeek migration.",
    style_body
))

workload_data = [
    ['Workload', 'Where decided', 'Preferred', 'Why', 'Cost'],
    ['Simple chat',       'openaiService.ts:426',         'Groq',      'Free; quality enough for "ok thanks"',   '₹0'],
    ['Standard chat',     'falls through (no preference)', 'DeepSeek V4-Flash', 'New cheap default',                       '~₹0.05/msg'],
    ['Complex chat',      'falls through (no preference)', 'DeepSeek V4-Flash', 'Same model, full token budget',          '~₹0.20/msg'],
    ['Task extraction',   'organicExtractor.ts:106',      'Groq',      'Free; small targeted output',            '₹0'],
    ['Compaction',        'conversationCompactor.ts:116', 'Groq',      'Free; summarisation is easy',            '₹0'],
    ['Autonomy execution','index.ts:348',                 'DeepSeek V4-Pro', 'Long reasoning, high stakes',      '~₹2/task (promo)'],
    ['Peer review',       'taskExecutionPipeline.ts',     'DeepSeek V4-Pro', 'Domain-specific lens needs reasoning','~₹1.20/review'],
    ['Deliverable gen',   'deliverableGenerator.ts:81',   'DeepSeek V4-Flash', 'Long-form structured output',    '~₹0.30/PRD'],
    ['Background runner', 'index.ts:317',                 'DeepSeek V4-Flash', 'Idle-time, low priority',        '~₹0.05/call'],
]
story.append(make_table(workload_data, col_widths=[30*mm, 38*mm, 30*mm, 40*mm, 22*mm]))

story.append(Paragraph(
    "<b>The pattern:</b> Groq owns workloads where Llama 3.3 quality is sufficient AND we benefit "
    "from the free tier (high-volume, low-stakes). DeepSeek owns everything else where reasoning "
    "matters but cost still matters. Gemini is on the bench, ready to take over.",
    style_callout
))
story.append(PageBreak())

# ─── §2.5 Classifier ───
story.append(Paragraph("2.5  Simple / Standard / Complex classifier", style_h2))
story.append(Paragraph(
    "The classifier in <font face='Courier' size='9'>taskComplexityClassifier.ts:19-69</font> is "
    "<b>zero-LLM</b> — pure regex heuristics, runs in microseconds. It feeds the workload axis above, "
    "deciding whether a chat message can route to free Groq or needs DeepSeek.",
    style_body
))

story.append(Paragraph("simple — routed to free Groq Llama", style_h3))
story.append(Paragraph(
    "<b>Triggers</b> if any match:<br/>"
    "• Pure emoji or ack: <font face='Courier' size='9'>👍, 👎, ✅, ❌, lol, haha, lmao</font><br/>"
    "• ≤5 words AND matches greeting list: <i>hi, hey, thanks, ok, sure, yes, no, cool, "
    "perfect, agreed, exactly, got it, sounds good, done, noted</i><br/>"
    "• ≤3 words AND not an action verb / question / technical keyword<br/>"
    "<b>Examples</b>: \"ok thanks\", \"cool 👍\", \"sounds good\", \"yep\"",
    style_body
))

story.append(Paragraph("complex — routed to default chain with full token budget", style_h3))
story.append(Paragraph(
    "<b>Triggers</b> if any match:<br/>"
    "• 2+ multi-part markers (<font face='Courier' size='9'>1.</font>, <font face='Courier' size='9'>2.</font>, "
    "<i>step 1, phase 2, firstly, additionally</i>)<br/>"
    "• &gt;60 words<br/>"
    "• Technical keyword + Analysis keyword in same message<br/>"
    "• &gt;15 words AND has analysis keyword (analyze, compare, evaluate, audit, strategy, roadmap)<br/>"
    "• Technical + Creative keywords together<br/>"
    "• &gt;30 words AND has any domain keyword<br/>"
    "<b>Keyword sets</b>: 40+ technical (api, schema, kubernetes, refactor...), "
    "15+ analysis (audit, evaluate, prioritize...), 12+ creative (brand, tone, persona, mockup...)",
    style_body
))

story.append(Paragraph("standard — everything else (the default)", style_h3))
story.append(Paragraph(
    "Most chat messages land here. Routes to default chain (DeepSeek V4-Flash).",
    style_body
))

story.append(Paragraph("Adaptive token budget per class", style_h3))
budget_data = [
    ['Class', 'Max tokens', 'Why'],
    ['simple',   '300',  'Short reply needed; "you\'re welcome" doesn\'t need 1200 tokens'],
    ['standard', '800',  'Full thought, but no essay'],
    ['complex',  '1200', 'Long-form reasoning'],
    ['first-message override', '500', 'Welcome / setup needs middle ground'],
]
story.append(make_table(budget_data, col_widths=[40*mm, 30*mm, 90*mm]))

story.append(Paragraph(
    "<b>Why this matters</b>: simple messages get free Groq AND a small token budget. "
    "Complex messages get DeepSeek AND full budget. You can't waste premium tokens on \"ok thanks\".",
    style_callout
))
story.append(PageBreak())

# ─── §2.6 Worked examples ───
story.append(Paragraph("2.6  Worked examples", style_h2))
story.append(Paragraph(
    "Six concrete scenarios showing how the routing actually plays out.",
    style_body
))

examples = [
    ('Free user sends "ok thanks"',
     '''1. tierGate: Free, under 500/day → allow
2. classifier: 'simple'
3. workload code (openaiService:426) prefers GROQ
4. → Groq Llama 3.3-70B answers
5. Cost: ₹0
   Fallback if Groq fails: DeepSeek V4-Flash (~₹0.05)'''),
    ('Pro user asks complex strategy question',
     '''1. tierGate: Pro → allow
2. classifier: 'complex'
3. no workload preference → falls through to default chain
4. resolvePrimaryProvider: DEEPSEEK_API_KEY set → primary = deepseek
5. buildProviderOrder: [deepseek, gemini, groq]
6. applyModelDefaults: deepseek + standard → 'deepseek-v4-flash'
7. → DeepSeek V4-Flash answers
8. Cost: ~₹0.05 (with cache hit on system prompt: ~₹0.005)
   Fallback chain: Gemini 2.5-Flash → Groq'''),
    ('Pro user triggers autonomy execution',
     '''1. tierGate: Pro, autonomy enabled → allow
2. workload: autonomy execution (server/index.ts:348)
3. calls resolveModelForTier('premium')
4. DEEPSEEK_API_KEY set → returns { provider: 'deepseek', model: 'deepseek-v4-pro' }
5. → DeepSeek V4-Pro answers (peer review fires after if risk ≥ 0.35)
6. Cost: ~₹2 per autonomy task (promo)
   Fallback: Gemini 2.5-Pro (set via GEMINI_PRO_MODEL)'''),
    ('Eval suite running (TEST_LLM_PROVIDER=deepseek)',
     '''1. resolveRuntimeConfig: mode='test', testProvider='deepseek'
2. config = { provider: 'deepseek', model: 'deepseek-v4-flash' }
3. buildProviderOrder (test mode): [deepseek, ollama-test, mock]
4. → DeepSeek primary, falls back to Ollama (if running locally), then Mock'''),
    ('DeepSeek has an outage',
     '''1. Pro user sends standard chat
2. resolveRuntimeConfig: primary = deepseek
3. Chain: [deepseek, gemini, groq]
4. DeepSeek throws 503
5. Resolver catches, loops → tries Gemini 2.5-Flash → success
6. Response metadata: fallbackChain: ['deepseek']
7. Telemetry: if > 5% of requests show this, alert'''),
    ('Manual rollback (DeepSeek consistently bad)',
     '''1. Set LLM_PRIMARY=gemini in .env, restart server
2. resolvePrimaryProvider returns 'gemini' regardless of DEEPSEEK_API_KEY
3. Chain becomes: [gemini, deepseek, groq]
4. Behaviour reverts to v1.2 baseline; DeepSeek stays available for testing
5. Zero code change, zero data migration'''),
]

for title, body in examples:
    story.append(Paragraph(f"<b>{title}</b>", style_h3))
    story.append(code_block(body))
story.append(PageBreak())

# ═════════════ §3 ARCHITECTURE II — AUTONOMOUS WORK ═════════════
story.append(Paragraph("3. Architecture II — Autonomous &amp; Background Work", style_h1))
story.append(hrule())

story.append(Paragraph("3.1  TL;DR — 5 LLM-based vs 15+ zero-LLM subsystems", style_h2))
story.append(Paragraph(
    "Hatchin's autonomy stack has 20+ moving parts. Only 5 actually call an LLM. The rest are pure "
    "rules, regex, scoring, or graph algorithms — fast, deterministic, and free. This is intentional design "
    "from v1.1 / v1.2 to keep autonomy cheap and predictable. Routing decisions cost nothing; only "
    "actual reasoning costs money.",
    style_body
))

story.append(Paragraph("LLM-based subsystems (5)", style_h3))
llm_based_data = [
    ['Subsystem', 'LLM used', 'Why an LLM'],
    ['Autonomy task execution',     'DeepSeek V4-Pro',   'Plan, breakdown, research — needs reasoning'],
    ['Background runner',           'DeepSeek V4-Flash', 'Idle-time follow-ups, summaries'],
    ['Peer review',                 'DeepSeek V4-Pro',   'Domain-specific critique requires judgment'],
    ['Return briefing (Maya)',      'DeepSeek V4-Pro',   'Coherent narrative summary of session'],
    ['Organic task suggestions',    'Groq Llama 3.3-70B','Subtle "we should X" intent extraction'],
]
story.append(make_table(llm_based_data, col_widths=[55*mm, 38*mm, 67*mm]))

story.append(Paragraph("Zero-LLM subsystems (15+)", style_h3))
zero_llm_data = [
    ['Subsystem', 'Mechanism'],
    ['Conductor (who responds?)',           'Keyword matching + scoring'],
    ['Expertise matching',                  'Skill-vector scoring algorithm'],
    ['Safety scoring',                      'Heuristic rules (hallucination/scope/exec)'],
    ['Decision forecasting',                'Rules + outcome lookup'],
    ['Trust scoring',                       'Math (success rate compounding)'],
    ['Handoff orchestration',               'Calls conductor + BFS cycle detection'],
    ['Handoff cycle detection',             'BFS graph algorithm'],
    ['Intent classifier (5 task intents)',  'Regex pattern matching (file comment: "Zero-LLM-cost")'],
    ['Task creator',                        'DB insert from confirmed intent'],
    ['Task lifecycle commands',             'Regex + fuzzy match for status/priority/assignee'],
    ['Duplicate detector',                  'Jaccard similarity ≥ 0.7'],
    ['Completion detector',                 'Regex on agent response'],
    ['Personality evolution',               'Trait scoring algorithm'],
    ['Auto-hatch (team creation)',          'Action parser regex on agent reply'],
    ['Conversation compaction (decision)',  'Context-fill check (the actual summary uses Groq)'],
]
story.append(make_table(zero_llm_data, col_widths=[60*mm, 100*mm]))
story.append(PageBreak())

# ─── §3.2 Per-subsystem mapping ───
story.append(Paragraph("3.2  Per-subsystem mapping", style_h2))
story.append(Paragraph(
    "The complete map of every background subsystem and its LLM choice (or lack thereof). "
    "File references point to the implementation in this commit.",
    style_body
))

mapping_data = [
    ['Subsystem',                    'Mechanism',     'LLM',                   'File:line'],
    ['Autonomy task execution',      'LLM',           'DeepSeek V4-Pro',       'index.ts:340-361'],
    ['Background runner',            'LLM',           'DeepSeek V4-Flash',     'index.ts:317-334'],
    ['Peer review',                  'LLM',           'DeepSeek V4-Pro',       'peerReview/peerReviewRunner.ts'],
    ['Return briefing (Maya)',       'LLM (inherits)','DeepSeek V4-Pro',       'ai/returnBriefing.ts:110'],
    ['Organic task suggestions',     'LLM',           'Groq Llama 3.3-70B',    'ai/tasks/organicExtractor.ts:106'],
    ['Conversation compaction',      'LLM',           'Groq Llama 3.3-70B',    'ai/conversationCompactor.ts:116'],
    ['Deliverable generation',       'LLM',           'DeepSeek V4-Flash',     'ai/deliverableGenerator.ts:81'],
    ['Conductor routing',            'Rules',         'none',                  'ai/conductor.ts:55'],
    ['Expertise matching',           'Algorithm',     'none',                  'ai/expertiseMatching.ts'],
    ['Safety scoring',               'Rules',         'none',                  'ai/safety.ts'],
    ['Decision forecasting',         'Rules',         'none',                  'ai/forecast.ts'],
    ['Trust scoring',                'Math',          'none',                  'autonomy/trustScoring/trustScorer.ts'],
    ['Handoff orchestration',        'Algorithm',     'none',                  'autonomy/handoff/handoffOrchestrator.ts'],
    ['Handoff announcements',        'Piggybacks',    'whatever chat used',    'autonomy/handoff/handoffAnnouncement.ts'],
    ['Intent classifier',            'Regex',         'none',                  'ai/tasks/intentClassifier.ts:2'],
    ['Task creator',                 'DB insert',     'none',                  'ai/tasks/taskCreator.ts'],
    ['Task lifecycle commands',      'Regex+fuzzy',   'none',                  'ai/tasks/taskLifecycle.ts'],
    ['Duplicate detector',           'Jaccard',       'none',                  'ai/tasks/duplicateDetector.ts'],
    ['Completion detector',          'Regex',         'none',                  'ai/tasks/completionDetector.ts'],
    ['Personality evolution',        'Scoring',       'none',                  'ai/personalityEvolution.ts'],
    ['Team auto-hatch',              'Action parser', 'none',                  'routes/chat.ts:2156, ai/actionParser.ts'],
]
story.append(make_table(mapping_data, col_widths=[44*mm, 26*mm, 36*mm, 56*mm]))
story.append(PageBreak())

# ─── §3.3 Background flow diagram ───
story.append(Paragraph("3.3  Background work flow diagram", style_h2))
story.append(Paragraph(
    "How a single user message fans out across foreground chat, background autonomy, "
    "and passive observation. Stars (★) mark LLM calls; everything else is zero-LLM.",
    style_body
))

story.append(code_block(
"""           USER MESSAGE OR BACKGROUND TRIGGER
                          │
        ┌─────────────────┼─────────────────────────┐
        ▼                 ▼                          ▼
   FOREGROUND        BACKGROUND               PASSIVE OBSERVATION
   CHAT              AUTONOMY                 (every message)
        │                 │                          │
   ╔════╧════════╗   ╔════╧════════════╗   ╔═════════╧═══════════╗
   ║ Conductor   ║   ║ Background      ║   ║ Intent classifier   ║
   ║ — picks     ║   ║ runner          ║   ║ — 5 intents         ║
   ║   speaker   ║   ║ + Task          ║   ║   ZERO-LLM (regex)  ║
   ║ ZERO-LLM    ║   ║ execution       ║   ╚═════════╤═══════════╝
   ╚════╤════════╝   ║ pipeline        ║             │
        ▼            ╚════╤════════════╝             ▼
   ╔═════════════╗        │                ┌─────────────────────┐
   ║ Safety      ║        ▼                │ Routes per intent:  │
   ║ scoring     ║   ╔════════════════╗    │                     │
   ║ ZERO-LLM    ║   ║ Safety gate    ║    │ EXPLICIT_TASK       │
   ╚════╤════════╝   ║ ZERO-LLM rules ║    │ → DB insert         │
        ▼            ║                ║    │   (zero-LLM)        │
   ┌─────────────┐   ║ <0.35 auto     ║    │                     │
   │ Agent reply │   ║ 0.35-0.59 PR   ║    │ ORGANIC_CANDIDATE   │
   │ (LLM call)  │   ║ ≥0.60 blocked  ║    │ → ★ Groq (FREE)     │
   │             │   ╚════╤═══════════╝    │                     │
   │ if simple   │        ▼                │ LIFECYCLE_COMMAND   │
   │   → ★ Groq  │   ╔════════════════╗    │ → regex match       │
   │ else        │   ║ resolveModel   ║    │   (zero-LLM)        │
   │   → ★ DeepS │   ║ ForTier        ║    │                     │
   │   eek       │   ║ ('premium')    ║    │ NO_TASK_INTENT      │
   │   V4-Flash  │   ║                ║    │ → drop              │
   └──────┬──────┘   ║ ★ DeepSeek     ║    └─────────────────────┘
          ▼          ║   V4-Pro       ║
   ┌─────────────┐   ╚════╤═══════════╝
   │ Action      │        ▼
   │ parser      │   ╔════════════════╗
   │ ZERO-LLM    │   ║ Agent does     ║
   │ (regex)     │   ║ the work:      ║
   │ Parses      │   ║                ║
   │ [[TASK]]    │   ║ ★ DeepSeek     ║
   │ [[TEAM]]    │   ║   V4-Pro       ║
   │ [[HATCH]]   │   ╚════╤═══════════╝
   │ [[BRAIN]]   │        ▼
   └──────┬──────┘   ╔════════════════╗
          ▼          ║ Peer review    ║
   ┌─────────────┐   ║ (if 0.35-0.59) ║
   │ Team / hatch│   ║                ║
   │ creation    │   ║ ★ DeepSeek     ║
   │ DB only,    │   ║   V4-Pro       ║
   │ ZERO-LLM    │   ╚════╤═══════════╝
   └─────────────┘        ▼
                     ╔════════════════╗
                     ║ Trust scoring  ║
                     ║ + Handoff      ║
                     ║ orchestrator   ║
                     ║ ZERO-LLM       ║
                     ╚════╤═══════════╝
                          ▼
                     ╔════════════════╗
                     ║ Return briefing║
                     ║ ★ DeepSeek V4-Pro║
                     ╚════════════════╝"""
))
story.append(PageBreak())

# ─── §3.4 Cost economics ───
story.append(Paragraph("3.4  Cost economics of autonomy", style_h2))
story.append(Paragraph(
    "Per-operation cost for a heavy Pro user, with DeepSeek V4-Pro on promo pricing "
    "(active until 2026-05-31).",
    style_body
))

cost_data = [
    ['Operation',                    'Tokens',          'Cost',           'Notes'],
    ['1 autonomy task execution',    '5K in + 1.5K out', '~₹2',           'The big-ticket item'],
    ['1 peer review',                '3K in + 0.8K out', '~₹1.20',        'Fires for ~30% of autonomy tasks'],
    ['1 deliverable (PRD)',          '4K in + 3K out',   '~₹0.30',        'V4-Flash, not premium'],
    ['1 organic task extraction',    '1.5K in + 0.2K out','₹0',           'Free (Groq)'],
    ['1 conversation compaction',    '3K in + 0.6K out', '₹0',            'Free (Groq), only when context fills'],
    ['1 return briefing',            '2K in + 0.4K out', '~₹0.50',        'Once per autonomy session (V4-Pro)'],
    ['Conductor / safety / handoff', 'n/a',              '₹0',            'Zero-LLM by design'],
    ['Task suggestions, auto-hatch', 'n/a',              '₹0',            'Routing free; chat LLM did the thinking'],
]
story.append(make_table(cost_data, col_widths=[48*mm, 38*mm, 22*mm, 55*mm]))

story.append(Paragraph("A typical heavy Pro user with 50 autonomy tasks/day:", style_h3))
story.append(Paragraph(
    "• 50 × ~₹2 = ~₹100/day execution<br/>"
    "• ~15 peer reviews × ₹1.20 = ~₹18/day<br/>"
    "• ~10 deliverables × ₹0.30 = ~₹3/day<br/>"
    "• Compaction + extraction: ~₹0<br/>"
    "<b>Total: ~₹121/day = ~₹3,630/mo on background work alone</b>",
    style_body
))

story.append(Paragraph(
    "<b>Combined with chat (~₹2,500/mo) → ~₹6,000/mo total LLM</b> per heavy Pro user. "
    "Down from ~₹9,500/mo on the all-Gemini baseline. The V4-Pro promo is doing most of the "
    "heavy lifting; post-2026-05-31 the math needs re-evaluation.",
    style_callout
))
story.append(PageBreak())

# ═════════════ §4 COMBINED SYSTEM ═════════════
story.append(Paragraph("4. Combined System Architecture", style_h1))
story.append(hrule())

story.append(Paragraph(
    "How both architectures fit together. Foreground chat and background autonomy share the same "
    "provider chain, but call different entry points based on workload type and tier.",
    style_body
))

story.append(code_block(
"""┌───────────────────────────────────────────────────────────────────────────┐
│  ENTRY POINTS                                                              │
│                                                                            │
│   Chat (WebSocket)        Autonomy queue       Eval suite                  │
│   /api/hatch/chat         (pg-boss)            scripts/eval-*.ts           │
│        │                       │                     │                     │
└────────┼───────────────────────┼─────────────────────┼─────────────────────┘
         │                       │                     │
         ▼                       ▼                     ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  WORKLOAD CLASSIFIERS (zero-LLM)                                      │
 │                                                                        │
 │   • taskComplexityClassifier.ts       → simple / standard / complex   │
 │   • intentClassifier.ts               → 5 task intents                │
 │   • safety.ts                         → risk score                    │
 │   • conductor.ts                      → which agent answers           │
 │                                                                        │
 └──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  WORKLOAD-SPECIFIC PREFERENCES (some skip default chain)              │
 │                                                                        │
 │   Workload                          Preferred provider                │
 │   ─────────                          ──────────────────                │
 │   simple chat                       Groq          (FREE)               │
 │   task extraction                   Groq          (FREE)               │
 │   compaction                        Groq          (FREE)               │
 │   autonomy / peer review            DeepSeek V4-Pro (premium tier)     │
 │   standard / complex chat           (no preference → default chain)    │
 │   deliverable generation            (no preference → default chain)    │
 │                                                                        │
 └──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  DEFAULT FALLBACK CHAIN (providerResolver.ts)                         │
 │                                                                        │
 │   ① DeepSeek V4-Flash    (PRIMARY — cost-optimized)                  │
 │       │ on failure                                                     │
 │       ▼                                                                │
 │   ② Gemini 2.5-Flash     (HOT FALLBACK)                              │
 │       │ on failure                                                     │
 │       ▼                                                                │
 │   ③ Groq Llama 3.3-70B   (FREE SAFETY NET)                           │
 │                                                                        │
 │   LLM_PRIMARY env var overrides this.                                 │
 │   OpenAI removed from defaults (commit 34c8f23).                      │
 │                                                                        │
 └──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  COST TRACKING (usageTracker.ts)                                      │
 │                                                                        │
 │   Records per call: provider, model, tier, tokens, cost (cents)       │
 │   COST_TABLE knows all 6 models incl. DeepSeek V4-Flash + V4-Pro      │
 │                                                                        │
 └──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   stream chunks → user / persist artifact"""
))
story.append(PageBreak())

# ═════════════ §5 GROQ vs OLLAMA ═════════════
story.append(Paragraph("5. Groq vs Ollama — clearing the confusion", style_h1))
story.append(hrule())

story.append(Paragraph(
    "Both run open-source Llama models. They are completely different things.",
    style_body
))

go_data = [
    ['',                          'Groq',                         'Ollama'],
    ['What is it?',               'Cloud API service',            'Self-hosted local runtime'],
    ['Where does inference run?', 'Groq data centers (LPU chips)','Localhost CPU/GPU'],
    ['Hatchin usage',             'Production primary (free tier)','Test mode ONLY — blocked in prod'],
    ['Free?',                     'Yes (free tier, ~30 req/min)', 'Yes ($) but uses YOUR CPU/RAM'],
    ['Speed',                     'Sub-second TTFT',              '5-15s on a MacBook (8B model)'],
    ['Quality',                   'llama-3.3-70b-versatile (70B)','llama3.1:8b (8B — much weaker)'],
    ['Internet needed?',          'Yes (cloud)',                  'No (fully offline)'],
    ['API key needed?',           'Yes (GROQ_API_KEY)',           'No'],
    ['Currently active?',         'YES (key in .env)',            'NO (only test mode)'],
]
story.append(make_table(go_data, col_widths=[40*mm, 60*mm, 60*mm]))

story.append(Paragraph("Why Ollama is blocked in production", style_h3))
story.append(Paragraph(
    "<font face='Courier' size='9'>providerResolver.ts:62</font> explicitly throws if you try "
    "<font face='Courier' size='9'>LLM_MODE=prod</font> with Ollama. Reasons:",
    style_body
))
story.append(Paragraph(
    "<b>1. Quality cliff</b> — llama3.1:8b hallucinates badly on Hatchin's 30-role system prompts.<br/>"
    "<b>2. Latency</b> — 5-15s to first token kills streaming UX.<br/>"
    "<b>3. Single-machine bottleneck</b> — your laptop can't serve multiple users.<br/>"
    "<b>4. Resource starvation</b> — keeping the model in RAM heats your laptop and slows everything.",
    style_body
))

story.append(Paragraph("Where Ollama IS useful", style_h3))
story.append(Paragraph(
    "• <b>Eval suites locally</b>: <font face='Courier' size='9'>TEST_LLM_PROVIDER=ollama "
    "npm run eval:bench</font> runs offline, free.<br/>"
    "• <b>Privacy-paranoid prospect demos</b>: \"this can run 100% on-prem\" — but only if you "
    "upgrade to llama3.1:70b on a beefy GPU machine (40 GB RAM).",
    style_body
))

story.append(Paragraph(
    "<b>Bottom line</b>: Groq is the free option already covering ~40% of your traffic. "
    "Ollama is a test-time tool, not a production tool.",
    style_callout
))
story.append(PageBreak())

# ═════════════ §6 OPERATIONAL CONCERNS ═════════════
story.append(Paragraph("6. Operational Concerns", style_h1))
story.append(hrule())

story.append(Paragraph("6.1  Rollback", style_h2))
story.append(Paragraph(
    "Single env var, no code change, no data migration:",
    style_body
))
story.append(code_block(
"""# Reverts default chain to Gemini-first; DeepSeek stays registered for testing
LLM_PRIMARY=gemini

# Or to OpenAI escape hatch (unusual)
LLM_PRIMARY=openai"""
))
story.append(Paragraph(
    "Restart the server (or trigger env reload) for the change to take effect.",
    style_body
))

story.append(Paragraph("6.2  Active risks", style_h2))
risks_data = [
    ['Risk', 'Status', 'Mitigation'],
    ['V4-Pro promo expires 2026-05-31',    'Active',     'Re-evaluate; post-promo it costs more than Gemini 2.5-Pro on input. Calendar reminder + comment in COST_TABLE.'],
    ['deepseek-chat / -reasoner deprecation 2026-07-24', 'Mitigated', 'Already using V4 endpoints; no migration needed.'],
    ['Latency regression vs Groq',          'Watch',      'gate:performance enforces ≤ 1.5× Gemini baseline.'],
    ['Data residency (DeepSeek China-hosted)','Future',   'Architecture supports per-customer LLM_PRIMARY=gemini for EU/regulated.'],
    ['30-role distinctiveness regression',  'Watch',      'BLOCKING gate: 294 tests in test:voice, test:pushback, test:reasoning.'],
    ['Single-vendor risk',                  'Mitigated',  'Gemini hot fallback + Groq free safety net = 3-provider chain.'],
]
story.append(make_table(risks_data, col_widths=[60*mm, 22*mm, 78*mm]))

story.append(Paragraph("6.3  Acceptance criteria (Phase A)", style_h2))
story.append(Paragraph(
    "Before flipping production primary, all of the following must pass:",
    style_body
))
story.append(code_block(
"""TEST_LLM_PROVIDER=deepseek npm run eval:routing
TEST_LLM_PROVIDER=deepseek npm run eval:bench
TEST_LLM_PROVIDER=deepseek npm run gate:safety
TEST_LLM_PROVIDER=deepseek npm run gate:conductor
TEST_LLM_PROVIDER=deepseek npm run gate:performance
npm run test:tone
npm run test:voice          # 8 tests
npm run test:pushback       # 46 tests
npm run test:reasoning      # 240 tests
npm run test:integrity
npm run test:dto

PASS CRITERIA:
  • eval:bench smartness within 5% of Gemini baseline
  • Tone-guard pass rate ≥ 95%
  • Routing accuracy ≥ baseline
  • Latency ≤ 1.5× Gemini"""
))

story.append(Paragraph(
    "<b>7-day production checkpoint:</b> actual ₹/heavy-user matches predicted (~₹670) within 10%; "
    "Gemini fallback usage &lt; 5%; cache hit ratio ≥ 50%; Groq still serving &gt; 30% of total request count.",
    style_callout
))
story.append(PageBreak())

# ═════════════ §7 FILE REFERENCE ═════════════
story.append(Paragraph("7. File reference index", style_h1))
story.append(hrule())

story.append(Paragraph(
    "Where each piece of the LLM architecture lives. Clickable in source-aware editors.",
    style_body
))

ref_data = [
    ['Concern', 'File'],
    ['Provider type definitions',           'server/llm/providerTypes.ts'],
    ['Provider chain logic',                'server/llm/providerResolver.ts'],
    ['DeepSeek provider implementation',    'server/llm/providers/deepseekProvider.ts'],
    ['Gemini provider implementation',      'server/llm/providers/geminiProvider.ts'],
    ['Groq provider implementation',        'server/llm/providers/groqProvider.ts'],
    ['Ollama provider implementation',      'server/llm/providers/ollamaProvider.ts'],
    ['OpenAI provider implementation',      'server/llm/providers/openaiProvider.ts'],
    ['Mock provider implementation',        'server/llm/providers/mockProvider.ts'],
    ['Cost tracking + COST_TABLE',          'server/billing/usageTracker.ts'],
    ['Cache-friendly system prompt',        'server/ai/promptTemplate.ts'],
    ['Workload: simple chat (Groq pref)',   'server/ai/openaiService.ts:426'],
    ['Workload: task extraction (Groq pref)','server/ai/tasks/organicExtractor.ts:106'],
    ['Workload: compaction (Groq pref)',    'server/ai/conversationCompactor.ts:116'],
    ['Workload: autonomy execution',        'server/index.ts:340-361'],
    ['Workload: deliverable generation',    'server/ai/deliverableGenerator.ts:81'],
    ['Workload: peer review',               'server/autonomy/peerReview/peerReviewRunner.ts'],
    ['Workload: return briefing',           'server/ai/returnBriefing.ts:110'],
    ['Tier gating middleware',              'server/middleware/tierGate.ts'],
    ['Autonomy policies (cost cap, etc.)',  'server/autonomy/config/policies.ts'],
    ['Conductor (zero-LLM routing)',        'server/ai/conductor.ts'],
    ['Expertise matching (zero-LLM)',       'server/ai/expertiseMatching.ts'],
    ['Safety scoring (zero-LLM)',           'server/ai/safety.ts'],
    ['Decision forecasting (zero-LLM)',     'server/ai/forecast.ts'],
    ['Trust scoring (zero-LLM)',            'server/autonomy/trustScoring/trustScorer.ts'],
    ['Handoff orchestrator (zero-LLM)',     'server/autonomy/handoff/handoffOrchestrator.ts'],
    ['Intent classifier (zero-LLM)',        'server/ai/tasks/intentClassifier.ts'],
    ['Action parser (zero-LLM)',            'server/ai/actionParser.ts'],
    ['Migration status doc',                '.planning/DEEPSEEK-MIGRATION-STATUS.md'],
    ['Env config template',                 '.env.example'],
]
story.append(make_table(ref_data, col_widths=[68*mm, 92*mm]))

story.append(Spacer(1, 12))
story.append(Paragraph(
    "<b>End of document.</b> Generated 2026-05-04. For implementation details beyond this scope, "
    "see <font face='Courier' size='9'>.planning/DEEPSEEK-MIGRATION-STATUS.md</font> and "
    "<font face='Courier' size='9'>CLAUDE.md</font> in the repository root.",
    style_caption
))


# ─── Build PDF ────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUT_PATH,
    pagesize=A4,
    leftMargin=20 * mm,
    rightMargin=20 * mm,
    topMargin=22 * mm,
    bottomMargin=22 * mm,
    title="Hatchin LLM Architecture",
    author="Shashank Rai",
    subject="LLM provider chain + autonomous work system",
)


def all_pages(canvas, doc):
    if doc.page == 1:
        cover_decoration(canvas, doc)
    else:
        page_decoration(canvas, doc)


doc.build(story, onFirstPage=cover_decoration, onLaterPages=page_decoration)
print(f"PDF written: {OUT_PATH}")
print(f"Pages: {doc.page}")
