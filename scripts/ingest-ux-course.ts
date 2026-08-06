// Phase 1 — deep-ingest the user's own UX/UI curriculum (clean Markdown in _foundations/) into the
// UX Designer role. Uses structure-aware chunking + rich per-section citations. Local course material:
// trust tier A (the user's curated top-tier curriculum), no public URL.
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/ingest-ux-course.ts
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { ingestSources, type SourceDoc } from '../server/knowledge/rag/ingest.js';
import { countForRole } from '../server/knowledge/rag/store.js';

const COURSE_DIR = process.env.UX_COURSE_DIR
  || '/Users/shashankrai/Documents/Becoming best ui and ux desinger/_foundations';

function titleFor(file: string, content: string): string {
  const h1 = content.split('\n').find((l) => /^#\s+\S/.test(l));
  const heading = h1 ? h1.replace(/^#\s+/, '').trim() : file.replace(/\.md$/, '').replace(/^\d+-/, '').replace(/-/g, ' ');
  return `UX Design Foundations: ${heading}`;
}

async function main() {
  const files = readdirSync(COURSE_DIR)
    .filter((f) => f.endsWith('.md') && !/^_/.test(f) && f.toLowerCase() !== 'readme.md')
    .sort();
  console.log(`Ingesting ${files.length} UX course files from ${COURSE_DIR}\n`);

  const docs: SourceDoc[] = files.map((f) => {
    const content = readFileSync(path.join(COURSE_DIR, f), 'utf8');
    return {
      role: 'UX Designer',
      url: '',                        // local course, no public URL (cited by title only)
      title: titleFor(f, content),
      trustTier: 'A',
      text: content,
    };
  });

  // Add to the existing UX web sources (idempotent via content_hash), don't wipe them.
  const reports = await ingestSources(docs, { replaceRoles: false, onProgress: (m) => console.log('  ' + m) });
  const r = reports[0];
  console.log(`\n=== ${r.role}: ${r.docs} docs -> ${r.chunks} chunks, ${r.inserted} new ===`);
  console.log(`UX Designer now holds ${await countForRole('ux-designer')} chunks total.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
