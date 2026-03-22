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
      if (res.statusCode === 302) {
        COOKIES = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      }
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

function extractVisits(html) {
  const visits = [];
  const regex = /<tr>\s*<td class="c_meisai"[^>]*>\s*(?:<a[^>]*>(\d+)<\/a>)?\s*<div class="p1_meisai">([\s\S]*?)<\/div>\s*<\/td>\s*<td class="c_kikan"[^>]*>([^<]*)<\/td>\s*<td class="c_hiduke">([^<]*)<\/td>\s*<td class="c_uketuke">([^<]*)<\/td>\s*<td class="c_douki">([^<]*)<\/td>\s*<td class="c_course">([^<]*)<\/td>\s*<td class="c_quantity"[^>]*>([^<]*)<\/td>\s*<td class="c_tantou">([^<]*)<\/td>\s*<td class="c_tantou">([^<]*)<\/td>\s*<td class="c_kingaku"[^>]*>\s*([^<]*)/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    visits.push({
      visit_number: parseInt(m[1]) || 0,
      date: m[4].trim(),
      course: m[7].trim(),
      staff1: m[9].trim(),
      amount: parseInt(m[11].replace(/,/g, '').trim()) || 0,
      reception: m[5].trim(),
      motive: m[6].trim(),
    });
  }
  return visits;
}

async function main() {
  // Login
  await httpPost('/requartet/index.php?gid=t3', 'gid=t3&login=22232301&password=12548526');
  console.log('Logged in');

  const dbClient = new Client({ connectionString: DB_URL });
  await dbClient.connect();

  const missing = [
    { kcode: '0002025', name: '川辺　加奈', furigana: 'かわべ　かな' },
    { kcode: '0010118', name: '青木　澄子', furigana: 'あおき　すみこ' },
  ];

  for (const cust of missing) {
    const html = await httpPost('/requartet/index.php', `gid=t3&page=ns_kokyaku&kokyaku=${cust.kcode}&caller=list`);

    // Extract fields
    const getField = (name) => {
      const m = html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`));
      return m ? m[1] : '';
    };
    const zipcode = getField('kZip');
    const address = getField('kAddr1');
    const phone = getField('kTel1');
    const email = getField('kMail1');
    const occupation = getField('kJob');

    // Gender - check which radio is checked
    const genderMatch = html.match(/name="kSei"[^>]*id="kSei_2"[^>]*checked/);
    const gender = genderMatch ? '男' : '女';

    // Memo
    const memoMatch = html.match(/<textarea[^>]*id="p1_bikou_txt"[^>]*>([\s\S]*?)<\/textarea/);
    const memo = memoMatch ? memoMatch[1].trim() : '';

    // Visits
    const visits = extractVisits(html);

    let firstVisitDate = null, lastVisitDate = null, ltv = 0;
    if (visits.length > 0) {
      lastVisitDate = parseDateFromVisit(visits[0].date);
      firstVisitDate = parseDateFromVisit(visits[visits.length - 1].date);
      visits.forEach(v => { ltv += v.amount || 0; });
    }
    const daysSinceLastVisit = lastVisitDate ? Math.floor((new Date() - new Date(lastVisitDate)) / (1000 * 60 * 60 * 24)) : null;

    const prefMatch = address.match(/^(.+?[都道府県])/);
    const cityMatch = address.match(/[都道府県](.+?[市区町村郡])/);

    const result = await dbClient.query(`
      INSERT INTO cm_patients (name, furigana, gender, phone, email, address, zipcode, prefecture, city, occupation, notes,
        visit_count, first_visit_date, last_visit_date, ltv, days_since_last_visit,
        status, is_enabled, clinic_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'active',true,$17,NOW(),NOW()) RETURNING id
    `, [
      cust.name, cust.furigana, gender, phone, email, address, zipcode,
      prefMatch ? prefMatch[1] : '', cityMatch ? cityMatch[1] : '',
      occupation, memo,
      visits.length, firstVisitDate, lastVisitDate, ltv, daysSinceLastVisit, CLINIC_ID,
    ]);

    const patientId = result.rows[0].id;

    for (const v of visits) {
      const vd = parseDateFromVisit(v.date);
      if (!vd) continue;
      await dbClient.query(
        'INSERT INTO cm_visit_records (patient_id, visit_date, visit_number, treatment_content, payment_amount, notes, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())',
        [patientId, vd, v.visit_number, v.course, v.amount, v.motive ? `動機: ${v.motive}` : '']
      );
      if (v.course) {
        await dbClient.query(
          'INSERT INTO cm_slips (patient_id, patient_name, visit_date, staff_name, menu_name, total_price, base_price, option_price, discount, tax, notes, clinic_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,$8,$9,NOW())',
          [patientId, cust.name, vd, v.staff1, v.course, v.amount, v.amount, v.reception, CLINIC_ID]
        );
      }
    }

    console.log(`Added: ${cust.name} | gender: ${gender} | phone: ${phone} | address: ${address}`);
    console.log(`  visits: ${visits.length} | LTV: ¥${ltv.toLocaleString()} | memo: ${memo ? memo.substring(0, 80) + '...' : '(empty)'}`);
  }

  // Final count
  const cnt = await dbClient.query('SELECT COUNT(*) FROM cm_patients WHERE clinic_id = $1', [CLINIC_ID]);
  const vcnt = await dbClient.query('SELECT COUNT(*) FROM cm_visit_records vr JOIN cm_patients p ON vr.patient_id = p.id WHERE p.clinic_id = $1', [CLINIC_ID]);
  const mcnt = await dbClient.query("SELECT COUNT(*) FROM cm_patients WHERE clinic_id = $1 AND notes IS NOT NULL AND notes != ''", [CLINIC_ID]);
  console.log(`\nFinal: ${cnt.rows[0].count} patients, ${vcnt.rows[0].count} visit records, ${mcnt.rows[0].count} with memos`);

  await dbClient.end();
}

main().catch(console.error);
