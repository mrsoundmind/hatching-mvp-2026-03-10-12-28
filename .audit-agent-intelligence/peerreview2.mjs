import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// distribution of review verdicts
const dist = await pool.query(`SELECT payload->>'roleFit' rolefit, payload->>'usefulness' usefulness, jsonb_array_length(COALESCE(payload->'contradictions','[]'::jsonb)) contra, jsonb_array_length(COALESCE(payload->'fixSuggestions','[]'::jsonb)) fixes, jsonb_array_length(COALESCE(payload->'missingQuestions','[]'::jsonb)) missing, payload->>'hallucinationRisk' halluc FROM autonomy_events WHERE event_type='peer_review_feedback'`);
const rows = dist.rows;
console.log('TOTAL_PEER_REVIEWS:', rows.length);
const fails = rows.filter(r=>r.rolefit!=='pass' || r.usefulness!=='pass' || r.contra>0 || r.fixes>0 || r.missing>0);
console.log('REVIEWS_THAT_FLAGGED_SOMETHING:', fails.length, '/', rows.length);
console.log('rolefit distribution:', JSON.stringify(rows.reduce((a,r)=>{a[r.rolefit]=(a[r.rolefit]||0)+1;return a;},{})));
console.log('had_fixSuggestions>0:', rows.filter(r=>r.fixes>0).length, 'had_missingQuestions>0:', rows.filter(r=>r.missing>0).length, 'had_contradictions>0:', rows.filter(r=>r.contra>0).length);
console.log('hallucinationRisk distribution:', JSON.stringify(rows.reduce((a,r)=>{a[r.halluc]=(a[r.halluc]||0)+1;return a;},{})));
// sample a review that flagged something
const flagged = await pool.query(`SELECT payload FROM autonomy_events WHERE event_type='peer_review_feedback' AND (jsonb_array_length(COALESCE(payload->'fixSuggestions','[]'::jsonb))>0 OR jsonb_array_length(COALESCE(payload->'missingQuestions','[]'::jsonb))>0) ORDER BY timestamp DESC LIMIT 1`);
if(flagged.rows[0]){ const p=flagged.rows[0].payload; console.log('\nSAMPLE_FLAGGED_REVIEW fixSuggestions:', JSON.stringify(p.fixSuggestions||p.fixSuggestion||[]).slice(0,300)); console.log('  missingQuestions:', JSON.stringify(p.missingQuestions||[]).slice(0,300)); }
await pool.end();
