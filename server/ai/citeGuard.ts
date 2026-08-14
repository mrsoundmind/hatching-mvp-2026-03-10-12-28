// ITL-0 / GRND-01 - enforce cite-or-admit on the chat path.
//
// Cite-or-admit was prompt-instruction ONLY (the openaiService response rule + the rendered knowledge
// block both tell the model "only cite sources explicitly provided; with no provided source attach no
// link"). There was ZERO output-side validation, so a model that ignores the instruction and cites a
// URL from memory is never caught. This is the pure enforcer: given the sources actually retrieved for
// the turn, it strips any cited URL whose host is not among them (the sentence stays), and reports what
// it removed so the strip can be recorded as a quality signal.
//
// Conservative by design: it only touches http(s) URLs, never prose. On an ungrounded turn (no sources
// retrieved) an allow-list of [] means EVERY cited URL is fabricated per the product's own rule, so all
// are stripped. Callers that do not want enforcement simply do not call this.
//
// Pure function: no LLM, no DB, no I/O. Wiring it into the chat path (passing the retrieved source URLs
// from the grounded-retrieval seam) is a separate, hot-file step.

// Markdown links first (so a fabricated [text](url) drops to just "text", never invalid markdown),
// then bare URLs. Both stop before closing brackets/quotes so surrounding punctuation survives.
const MD_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi;
// Exclude markdown emphasis (* `) from the URL so a bold-wrapped URL (**https://x**) does not swallow
// its own closing markers and leave a dangling ** behind after the strip.
const BARE_URL_RE = /https?:\/\/[^\s)\]}>"'*`]+/gi;

/** Trailing sentence punctuation is not part of a URL (fixes "example.com." false-strips). */
function trimUrlPunct(u: string): string {
  return u.replace(/[.,;:!?]+$/, '');
}

/**
 * Host without a leading www., lowercased, trailing sentence punctuation trimmed. Empty string when
 * the URL cannot be parsed. Matching is HOST-granularity (eTLD not resolved): a deep link on a
 * retrieved domain passes, and a subdomain that differs from the retrieved one will not match. This
 * is a deliberate, documented trade-off (see enforceCiteOrAdmit).
 */
export function citeHost(u: string): string {
  try {
    return new URL(trimUrlPunct(u)).host.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

export interface CiteGuardResult {
  /** the response text with fabricated citations removed */
  text: string;
  /** how many cited URLs were not among the provided sources */
  strippedCount: number;
  /** the URLs that were removed (for the telemetry signal) */
  stripped: string[];
}

/**
 * Strip any cited URL whose host is not in `allowedUrls`. `allowedUrls` is the set of source URLs
 * actually retrieved for this turn. An empty allow-list means the turn was ungrounded, so any cited
 * URL is treated as fabricated (per cite-or-admit) and removed.
 */
export function enforceCiteOrAdmit(text: string, allowedUrls: string[]): CiteGuardResult {
  if (!text) return { text, strippedCount: 0, stripped: [] };
  const allowHosts = new Set((allowedUrls || []).map(citeHost).filter(Boolean));
  const stripped: string[] = [];
  const allowed = (url: string): boolean => {
    const host = citeHost(url);
    return !!host && allowHosts.has(host);
  };

  // 1) Markdown links [text](url): keep the human-readable text, drop the fabricated link entirely
  //    (never produce broken "[text]((...))").
  let out = text.replace(MD_LINK_RE, (whole, label: string, url: string) => {
    if (allowed(url)) return whole;
    stripped.push(url);
    return String(label).trim();
  });
  // 2) Bare URLs: remove the URL, keep surrounding prose. No injected system phrase in the agent voice.
  out = out.replace(BARE_URL_RE, (url) => {
    if (allowed(url)) return url;
    stripped.push(url);
    return '';
  });
  // Tidy the whitespace + empty emphasis wrappers a removed URL can leave behind.
  out = out
    .replace(/\*\*\s*\*\*/g, '')      // empty bold left by a stripped **url**
    .replace(/`\s*`/g, '')            // empty inline-code left by a stripped `url`
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .trim();

  return { text: out, strippedCount: stripped.length, stripped };
}

// ITL-0 / GRND-02 - flag unsupported factual claims on UNGROUNDED outward-facing output. When a turn
// retrieved nothing (grounded=false) yet the answer asserts a hard fact (a percentage, a currency
// figure, a big specific number, "studies show"), that claim has no retrieved support and is a
// hallucination risk. This DETECTS and reports it as a quality signal; it does NOT rewrite (conservative,
// so it never censors legitimate reasoning). Mirrors the OUTWARD_OR_FACTUAL detector used for peer-review
// coverage in taskExecutionPipeline. The caller records the flag and can optionally add a soft hedge.
// Tightened to cut false positives (a bare year "2024", a port "5001", or a role's normal vocab like
// "churn rate" is NOT a fabricated claim). A hard claim needs a real quantitative figure (a percentage
// or a currency amount) or an explicit research-citation phrase.
const FACTUAL_MARKERS: Array<[string, RegExp]> = [
  ['percent', /\b\d+(\.\d+)?\s*%/],
  ['money', /[$₹€£]\s?\d/],
  ['citation_phrase', /\b(according to (a|the|our|one)\b|studies show|research shows|survey (found|says|of)|statistically|proven to|a study\b)/i],
];

export interface ClaimGuardResult {
  /** true when the ungrounded answer asserts a hard fact with no retrieved support */
  flagged: boolean;
  /** which marker kinds fired (percent / money / big_number / citation_phrase / metric_claim) */
  markers: string[];
}

/**
 * Flag hard factual claims on an UNGROUNDED turn. Grounded turns pass (the claim may be supported by
 * the retrieved sources). No rewriting, detection only.
 */
export function flagUnsupportedClaims(text: string, grounded: boolean): ClaimGuardResult {
  if (!text || grounded) return { flagged: false, markers: [] };
  const markers = FACTUAL_MARKERS.filter(([, re]) => re.test(text)).map(([name]) => name);
  return { flagged: markers.length > 0, markers };
}
