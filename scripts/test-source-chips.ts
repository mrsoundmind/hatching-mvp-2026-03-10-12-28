// Unit test for the Sources-chips citation parser (extractSources).
// Run: ./node_modules/.bin/tsx scripts/test-source-chips.ts
import { extractSources } from '../client/src/components/chat/SourceChips.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

// 1. Single markdown link.
const a = extractSources('Roughly 96.55% get zero traffic [96.55% of pages get no search traffic](https://ahrefs.com/blog/search-traffic-study/). More text.');
check('parses one markdown citation', a.length === 1, `got ${a.length}`);
check('captures the link text as title', a[0]?.title === '96.55% of pages get no search traffic', a[0]?.title);
check('captures the url', a[0]?.url === 'https://ahrefs.com/blog/search-traffic-study/', a[0]?.url);
check('derives the domain (www stripped)', a[0]?.domain === 'ahrefs.com', a[0]?.domain);

// 2. Trailing punctuation should not leak into the URL.
const b = extractSources('See [MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html).');
check('strips trailing period from url', b[0]?.url === 'https://martinfowler.com/bliki/MonolithFirst.html', b[0]?.url);

// 3. Multiple links, dedupe by URL.
const c = extractSources('[A](https://x.com/a) and [A again](https://x.com/a) and [B](https://y.org/b)');
check('dedupes repeated urls', c.length === 2, `got ${c.length}`);
check('keeps distinct urls', c.map((s) => s.domain).join(',') === 'x.com,y.org', c.map((s) => s.domain).join(','));

// 4. Bare URL (no markdown) uses domain as title.
const d = extractSources('Reference: https://sre.google/sre-book/service-level-objectives/ for details');
check('captures a bare url', d.length === 1, `got ${d.length}`);
check('bare url title falls back to domain', d[0]?.title === 'sre.google', d[0]?.title);

// 5. No citations -> empty (so the chip row renders nothing).
check('no links -> empty', extractSources('Just a normal reply with no sources at all.').length === 0);
check('empty content -> empty', extractSources('').length === 0);

// 6. Markdown link + a separate bare url both captured, no double-count of the same url.
const e = extractSources('[RICE](https://intercom.com/blog/rice/) see also https://intercom.com/blog/rice/ and https://svpg.com/x');
check('md + bare dedupe same url, keep new bare', e.length === 2, `got ${e.length} (${e.map((s) => s.url).join(' | ')})`);

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
