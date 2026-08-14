import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = await pool.query(`
  SELECT
    payload->>'usefulness' usefulness,
    payload->>'hallucinationRisk' halluc,
    payload->>'roleFit' rolefit,
    jsonb_array_length(COALESCE(payload->'fixSuggestions','[]'::jsonb)) fixes,
    jsonb_array_length(COALESCE(payload->'missingQuestions','[]'::jsonb)) missing,
    jsonb_array_length(COALESCE(payload->'contradictions','[]'::jsonb)) contra
  FROM autonomy_events WHERE event_type='peer_review_feedback'`);
const r = q.rows;
const N = r.length;
console.log('TOTAL:', N);
const c = (f) => r.filter(f).length;
console.log('\n-- single-field distributions --');
console.log('usefulness: pass', c(x=>x.usefulness==='pass'), '| fail', c(x=>x.usefulness==='fail'));
console.log('halluc:     low', c(x=>x.halluc==='low'), '| med', c(x=>x.halluc==='medium'), '| high', c(x=>x.halluc==='high'));
console.log('missingQ:   0=', c(x=>x.missing===0), ' 1=', c(x=>x.missing===1), ' >=2=', c(x=>x.missing>=2));
console.log('fixes:      0=', c(x=>x.fixes===0), ' 1-2=', c(x=>x.fixes>=1&&x.fixes<=2), ' >=3=', c(x=>x.fixes>=3));
console.log('contra:     >=1=', c(x=>x.contra>=1));

console.log('\n-- the KEY question: what does usefulness=fail correlate with? --');
console.log('usefulness=fail total:', c(x=>x.usefulness==='fail'));
console.log('  of those, halluc=low: ', c(x=>x.usefulness==='fail'&&x.halluc==='low'));
console.log('  of those, halluc=med: ', c(x=>x.usefulness==='fail'&&x.halluc==='medium'));
console.log('  of those, halluc=high:', c(x=>x.usefulness==='fail'&&x.halluc==='high'));
console.log('  of those, missingQ>=1:', c(x=>x.usefulness==='fail'&&x.missing>=1));
console.log('  (usefulness=fail means fixSuggestions.length===0 by rubric)');

console.log('\n-- candidate TEETH conditions, fire-rate on the 72 --');
const already = c(x=>x.halluc==='high'); // already blocked today
console.log('ALREADY blocked today (halluc=high):', already);
console.log('A) usefulness=fail                       :', c(x=>x.usefulness==='fail'), '(critique proposal)');
console.log('B) usefulness=fail AND halluc>=med       :', c(x=>x.usefulness==='fail'&&(x.halluc==='medium'||x.halluc==='high')));
console.log('C) halluc=med AND missingQ>=2            :', c(x=>x.halluc==='medium'&&x.missing>=2));
console.log('D) halluc>=med AND fixes>=3              :', c(x=>(x.halluc==='medium'||x.halluc==='high')&&x.fixes>=3));
console.log('E) halluc=med AND missingQ>=1            :', c(x=>x.halluc==='medium'&&x.missing>=1));
console.log('   NEW beyond high-gate for C:', c(x=>x.halluc==='medium'&&x.missing>=2), 'D:', c(x=>x.halluc==='medium'&&x.fixes>=3));
await pool.end();
