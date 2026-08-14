import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(`SELECT payload FROM autonomy_events WHERE event_type='peer_review_feedback'`);
const rows = r.rows.map(x=>x.payload||{});
const dist = (key)=>rows.reduce((a,p)=>{const v=p[key]; a[v]=(a[v]||0)+1; return a;},{});
console.log('TOTAL:', rows.length);
console.log('roleFit:', JSON.stringify(dist('roleFit')));
console.log('usefulness:', JSON.stringify(dist('usefulness')));
console.log('hallucinationRisk:', JSON.stringify(dist('hallucinationRisk')));
const contraLens = rows.map(p=>Array.isArray(p.contradictions)?p.contradictions.length:0);
console.log('contradictions_len_distribution:', JSON.stringify(contraLens.reduce((a,n)=>{a[n]=(a[n]||0)+1;return a;},{})));
// Would Phase D fail conditions EVER fire?
const c1 = rows.filter(p=>Array.isArray(p.contradictions)&&p.contradictions.length>=2).length;
const c2 = rows.filter(p=>p.hallucinationRisk==='high' && p.usefulness==='fail').length;
console.log('WOULD_FIRE contradictions>=2 :', c1, '/', rows.length);
console.log('WOULD_FIRE (halluc=high AND usefulness=fail) :', c2, '/', rows.length);
console.log('halluc=high rows:', rows.filter(p=>p.hallucinationRisk==='high').length, '| of those, usefulness values:', JSON.stringify(rows.filter(p=>p.hallucinationRisk==='high').reduce((a,p)=>{a[p.usefulness]=(a[p.usefulness]||0)+1;return a;},{})));
await pool.end();
