import { useMemo } from 'react';

// v2.3 Per-role RAG — Sources chips.
// Agents now ground answers in a real per-role knowledge library and cite sources inline as
// [title](url). This surfaces those citations as a scannable, clickable "Sources" row under the
// reply, so anyone can see and open exactly where a fact came from. Renders nothing when the reply
// cited nothing, so non-cited replies look exactly as before.

interface Source {
  title: string;
  url: string;
  domain: string;
}

// Markdown link [text](url) and any bare URL. We parse the FINAL rendered text so chips reflect what
// the answer actually cited (honest), not every chunk that was retrieved.
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BARE_URL = /https?:\/\/[^\s)\]]+/g;

function cleanUrl(u: string): string {
  return u.replace(/[.,;:!)\]]+$/, '');
}

function domainOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u.replace(/^https?:\/\//, '').split('/')[0];
  }
}

/** Extract deduped citations from a reply's text. Exported for unit testing. */
export function extractSources(content: string): Source[] {
  if (!content) return [];
  const seen = new Set<string>();
  const out: Source[] = [];

  const md = new RegExp(MD_LINK);
  let m: RegExpExecArray | null;
  while ((m = md.exec(content)) !== null) {
    const url = cleanUrl(m[2]);
    if (seen.has(url)) continue;
    seen.add(url);
    const title = m[1].trim().replace(/^\[+|\]+$/g, '').trim();
    const domain = domainOf(url);
    out.push({ title: title || domain, url, domain });
  }

  // Bare URLs not already captured as markdown links.
  const stripped = content.replace(new RegExp(MD_LINK), ' ');
  for (const b of stripped.match(BARE_URL) ?? []) {
    const url = cleanUrl(b);
    if (seen.has(url)) continue;
    seen.add(url);
    const domain = domainOf(url);
    out.push({ title: domain, url, domain });
  }

  return out;
}

export function SourceChips({ content }: { content: string }) {
  const sources = useMemo(() => extractSources(content), [content]);
  if (sources.length === 0) return null;

  return (
    <div
      className="mt-2 pt-2 border-t border-dashed border-hatchin-border-subtle"
      data-testid="source-chips"
    >
      <div className="flex items-center gap-1.5 mb-2 text-micro font-semibold uppercase tracking-wide text-muted-foreground">
        <span aria-hidden>📚</span>
        <span>Sources</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sources.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${s.title} — ${s.domain}`}
            className="group inline-flex items-start gap-2 max-w-[280px] rounded-2xl border border-amber-300/70 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 transition-all hover:-translate-y-px hover:shadow-md dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <span className="mt-0.5 grid h-4 w-4 flex-none place-items-center rounded bg-amber-500 text-[10px] font-bold uppercase text-white">
              {s.domain.charAt(0)}
            </span>
            <span className="min-w-0 leading-snug">
              <span className="break-words font-semibold">{s.title}</span>
              <span className="block break-words text-micro text-amber-700/70 dark:text-amber-300/60">
                {s.domain}
              </span>
            </span>
            <span className="flex-none opacity-60 transition-opacity group-hover:opacity-100" aria-hidden>
              ↗
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
