const https = require('https');
const { Client } = require('pg');

const CLINIC_ID = 'b82a0e9d-e1df-4d99-9b97-db5befbf829b';
const DB_URL = 'postgresql://postgres.vzkfkazjylrkspqrnhnx:fJZj8SDawfJze7H9@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

let COOKIES = '';

function httpPost(path, postData) {
  return new Promise((resolve) => {
    const opt = {
      hostname: 'c6410.jp', path, method: 'POST',
      headers: { 'Cookie': COOKIES, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData), 'User-Agent': 'Mozilla/5.0' }
    };
    const req = https.request(opt, (res) => {
      if (res.statusCode === 302) COOKIES = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      let d = '';
      res.on('data', ch => d += ch);
      res.on('end', () => resolve(d));
    });
    req.write(postData);
    req.end();
  });
}

function parseDateFromVisit(dateStr) {
  const match = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function extractSejutsuPairs(html) {
  const tableStart = html.indexOf('<table id="p1_rireki_table">');
  if (tableStart === -1) return [];
  const tableEnd = html.indexOf('</table>', tableStart);
  const tableHtml = html.substring(tableStart, tableEnd);

  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let match;
  let lastVisitNum = null;
  let lastDate = null;
  const pairs = [];

  while ((match = trRegex.exec(tableHtml)) !== null) {
    const tr = match[1];

    const visitMatch = tr.match(/id="sejutu_n(\d+)"[^>]*>(\d+)<\/a>/);
    const dateMatch = tr.match(/<td class="c_hiduke">([^<]*)<\/td>/);

    if (visitMatch && dateMatch) {
      lastVisitNum = parseInt(visitMatch[2]);
      lastDate = dateMatch[1].trim();
    }

    const sejutuMatch = tr.match(/<textarea[^>]*id='p1_sejutu_n(\d+)'[^>]*>([\s\S]*?)<\/textarea>/);
    if (sejutuMatch && lastVisitNum !== null) {
      pairs.push({
        visitNum: lastVisitNum,
        date: parseDateFromVisit(lastDate),
        content: sejutuMatch[2].trim()
      });
      lastVisitNum = null;
      lastDate = null;
    }
  }

  return pairs;
}

async function main() {
  // Login
  await httpPost('/requartet/index.php?gid=t3', 'gid=t3&login=22232301&password=12548526');
  console.log('Logged in');

  const dbClient = new Client({ connectionString: DB_URL });
  await dbClient.connect();

  // Get all customers from Re:QUARTET list
  const allCustomers = [];
  for (let page = 1; page <= 29; page++) {
    const postData = `gid=t3&page=ns_kokyaku_list&init=on&caller=list&field=RAITENCNT&sort=desc&current=${page}`;
    const result = await httpPost('/requartet/index.php', postData);
    const rowRegex = /<tr><td class='center[^']*'>(\d+)<\/td><td class='center'><a[^>]*rel='(\d+)'>(\d+)<\/a><\/td><td class='left'>([^<]*)<\/td><td class='left'>([^<]*)<\/td>/g;
    let m;
    while ((m = rowRegex.exec(result)) !== null) {
      allCustomers.push({
        visit_count: parseInt(m[1]),
        kcode: m[2],
        name: m[5].trim(),
      });
    }
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(`Total customers: ${allCustomers.length}`);

  // Get patient IDs from DB
  const dbPatients = await dbClient.query('SELECT id, name FROM cm_patients WHERE clinic_id = $1', [CLINIC_ID]);
  const nameToId = {};
  dbPatients.rows.forEach(r => { nameToId[r.name] = r.id; });

  // First, clear all existing notes (they had wrong data from bikou)
  await dbClient.query("UPDATE cm_patients SET notes = NULL WHERE clinic_id = $1", [CLINIC_ID]);
  console.log('Cleared old notes from patients');

  let totalSejutsu = 0;
  let updatedVisits = 0;
  let customersWithContent = 0;
  const BATCH_SIZE = 5;

  for (let i = 0; i < allCustomers.length; i += BATCH_SIZE) {
    const batch = allCustomers.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (cust) => {
      const postData = `gid=t3&page=ns_kokyaku&kokyaku=${cust.kcode}&caller=list`;
      const html = await httpPost('/requartet/index.php', postData);
      const pairs = extractSejutsuPairs(html);
      return { name: cust.name, pairs };
    });

    const results = await Promise.all(promises);

    for (const { name, pairs } of results) {
      const patientId = nameToId[name];
      if (!patientId || pairs.length === 0) continue;

      customersWithContent++;
      totalSejutsu += pairs.length;

      // Update each visit record's treatment_content with the sejutsu content
      for (const pair of pairs) {
        if (!pair.date || !pair.content) continue;

        const updateResult = await dbClient.query(`
          UPDATE cm_visit_records
          SET treatment_content = $1
          WHERE patient_id = $2 AND visit_date = $3 AND visit_number = $4
        `, [pair.content, patientId, pair.date, pair.visitNum]);

        if (updateResult.rowCount > 0) {
          updatedVisits++;
        }
      }

      // Also concatenate all sejutsu into patient notes for easy overview
      const allContent = pairs
        .sort((a, b) => b.visitNum - a.visitNum)
        .map(p => `【${p.visitNum}回目 ${p.date}】\n${p.content}`)
        .join('\n\n');

      await dbClient.query(
        'UPDATE cm_patients SET notes = $1, updated_at = NOW() WHERE id = $2',
        [allContent, patientId]
      );
    }

    if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= allCustomers.length) {
      console.log(`  ${Math.min(i + BATCH_SIZE, allCustomers.length)}/${allCustomers.length} processed | ${customersWithContent} customers with content | ${totalSejutsu} sejutsu found | ${updatedVisits} visits updated`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Verify
  const notesCount = await dbClient.query("SELECT COUNT(*) FROM cm_patients WHERE clinic_id = $1 AND notes IS NOT NULL AND notes != ''", [CLINIC_ID]);
  const treatmentCount = await dbClient.query("SELECT COUNT(*) FROM cm_visit_records vr JOIN cm_patients p ON vr.patient_id = p.id WHERE p.clinic_id = $1 AND vr.treatment_content IS NOT NULL AND vr.treatment_content != '' AND vr.treatment_content != vr.notes", [CLINIC_ID]);

  console.log('\n=== Result ===');
  console.log(`Patients with notes (施術内容): ${notesCount.rows[0].count}`);
  console.log(`Visit records with treatment content: ${updatedVisits}`);
  console.log(`Total sejutsu entries found: ${totalSejutsu}`);

  // Show sample
  const sample = await dbClient.query(`
    SELECT p.name, vr.visit_date, vr.visit_number, vr.treatment_content
    FROM cm_visit_records vr
    JOIN cm_patients p ON vr.patient_id = p.id
    WHERE p.clinic_id = $1 AND vr.treatment_content IS NOT NULL AND vr.treatment_content != ''
    ORDER BY p.name, vr.visit_number DESC
    LIMIT 10
  `, [CLINIC_ID]);
  console.log('\nSample visit records with sejutsu:');
  sample.rows.forEach(r => {
    console.log(`  ${r.name} #${r.visit_number} (${r.visit_date}) | ${r.treatment_content.replace(/\n/g, ' ').substring(0, 80)}`);
  });

  await dbClient.end();
}

main().catch(console.error);
