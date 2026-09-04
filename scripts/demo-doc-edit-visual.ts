// Produces a REAL edited document from a realistic input, for a visual screenshot proof.
// Simulates an uploaded file, runs the real editor (DeepSeek), writes the edited .pdf and .docx.
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/demo-doc-edit-visual.ts
import { writeFileSync } from 'fs';
import mammoth from 'mammoth';
import { editDocument } from '../server/documents/documentEditor.js';
import { markdownToDocx } from '../server/documents/markdownToDocx.js';
import { markdownToPdf } from '../server/documents/markdownToPdf.js';

const OUT = '/private/tmp/claude-501/-Users-shashankrai-Documents-hatching-mvp-5th-march/e433eb83-3933-4614-80d6-c592aed4b0f7/scratchpad';

const INPUT_MD = `# GreenLeaf Coffee — Launch Marketing Brief

## Overview
GreenLeaf is a subscription service delivering freshly roasted, ethically sourced coffee to homes and small offices. We roast to order and ship within 24 hours.

## Target Audience
Home coffee enthusiasts aged 28 to 45 who care about freshness and sourcing, and small offices of 5 to 30 people that want a reliable coffee supply without managing a vendor.

## Positioning
The freshest coffee you can get without owning a roaster. We compete on freshness and traceability, not on being the cheapest.

## Channels
We will focus on organic social, a referral program, and partnerships with local cafes for launch. Paid ads come later once the funnel converts.
`;

const INSTRUCTION =
  'Go through this brief and add two missing sections: a "Competitor Landscape" section and a "Success Metrics" section. ' +
  'Also expand the Target Audience section with one more concrete segment. Keep everything already there, and do not invent specific numbers or fake competitor names.';

async function main() {
  process.env.LLM_MODE = 'prod';
  delete process.env.LLM_PRIMARY;
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';

  // Simulate an uploaded PDF and an uploaded Word doc of the same brief.
  const pdfIn = await markdownToPdf(INPUT_MD, 'GreenLeaf-Brief');
  const docxIn = await markdownToDocx(INPUT_MD);
  writeFileSync(`${OUT}/greenleaf-original.pdf`, pdfIn);

  console.log('Editing the PDF (real DeepSeek)...');
  const pdfRes = await editDocument({ buffer: pdfIn, filename: 'GreenLeaf-Brief.pdf', instruction: INSTRUCTION, agentRole: 'Growth Marketer' });
  writeFileSync(`${OUT}/greenleaf-edited.pdf`, pdfRes.buffer);

  console.log('Editing the Word doc (real DeepSeek)...');
  const docxRes = await editDocument({ buffer: docxIn, filename: 'GreenLeaf-Brief.docx', instruction: INSTRUCTION, agentRole: 'Growth Marketer' });
  writeFileSync(`${OUT}/greenleaf-edited.docx`, docxRes.buffer);
  const docxText = (await mammoth.extractRawText({ buffer: docxRes.buffer })).value;

  console.log('\n--- checks ---');
  console.log('edited PDF valid:', pdfRes.buffer.subarray(0, 5).toString('latin1') === '%PDF-', `(${(pdfRes.buffer.length/1024).toFixed(0)}kb)`);
  console.log('edited DOCX valid + Word mime:', pdfRes.ext === '.pdf', docxRes.mime.includes('wordprocessingml'), `(${(docxRes.buffer.length/1024).toFixed(0)}kb)`);
  console.log('kept original (GreenLeaf, Positioning, Channels):', /GreenLeaf/.test(docxText) && /Positioning/i.test(docxText) && /Channels/i.test(docxText));
  console.log('added Competitor Landscape:', /competitor/i.test(docxText));
  console.log('added Success Metrics:', /success metrics|metrics/i.test(docxText));
  console.log(`\nWritten: greenleaf-original.pdf, greenleaf-edited.pdf, greenleaf-edited.docx`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.stack || e?.message || e); process.exit(1); });
