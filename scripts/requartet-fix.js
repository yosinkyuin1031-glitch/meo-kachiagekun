const https = require('https');
const fs = require('fs');
const { Client } = require('pg');

const CLINIC_ID = 'b82a0e9d-e1df-4d99-9b97-db5befbf829b';
const DB_URL = 'postgresql://postgres.vzkfkazjylrkspqrnhnx:fJZj8SDawfJze7H9@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

let SESSION_COOKIE = '';

function fetch(path, method = 'GET', postData = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'c6410.jp', path, method,
      headers: {
        'Cookie': SESSION_COOKIE,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      if (res.statusCode === 302) {
        const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        resolve({ redirect: true, cookies });
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ body: data, status: res.statusCode }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function login() {
  const loginData = 'gid=t3&login=22232301&password=12548526';
  const result = await fetch('/requartet/index.php?gid=t3', 'POST', loginData);
  SESSION_COOKIE = result.cookies;
  console.log('Logged in successfully');
}

function parseCustomerList(html) {
  const customers = [];
  const rowRegex = /<tr><td class='center'>(\d+)<\/td><td class='center'><a[^>]*rel='(\d+)'>(\d+)<\/a><\/td><td class='left'>([^<]*)<\/td><td class='left'>([^<]*)<\/td><td class='center'><span[^>]*>(男|女)<\/span><\/td><td class='left long'>([^<]*)<\/td><td class='left long'>([^<]*)<\/td><td class='left long'>(.*?)<\/td><td class='center'>([^<]*)<\/td>/g;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    customers.push({
      visit_count: parseInt(match[1]),
      kcode: match[2],
      kokyaku_no: match[3],
      furigana: match[4].trim(),
      name: match[5].trim(),
      gender: match[6],
      address: match[7].trim(),
      phone: match[8].trim(),
      last_visit: match[10].trim(),
    });
  }
  return customers;
}

function parseDateFromVisit(dateStr) {
  const match = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function extractPrefecture(address) {
  const match = address.match(/^(.+?[都道府県])/);
  return match ? match[1] : '';
}

function extractCity(address) {
  const match = address.match(/[都道府県](.+?[市区町村郡])/);
  return match ? match[1] : '';
}

function extractMemo(html) {
  const match = html.match(/<textarea[^>]*id="p1_bikou_txt"[^>]*>([\s\S]*?)<\/textarea/);
  return match ? match[1].trim() : '';
}

function extractVisits(html) {
  const visits = [];
  const rirekiRegex = /<tr>\s*<td class="c_meisai"[^>]*>\s*(?:<a[^>]*>(\d+)<\/a>)?\s*<div class="p1_meisai">([\s\S]*?)<\/div>\s*<\/td>\s*<td class="c_kikan"[^>]*>([^<]*)<\/td>\s*<td class="c_hiduke">([^<]*)<\/td>\s*<td class="c_uketuke">([^<]*)<\/td>\s*<td class="c_douki">([^<]*)<\/td>\s*<td class="c_course">([^<]*)<\/td>\s*<td class="c_quantity"[^>]*>([^<]*)<\/td>\s*<td class="c_tantou">([^<]*)<\/td>\s*<td class="c_tantou">([^<]*)<\/td>\s*<td class="c_kingaku"[^>]*>\s*([^<]*)/g;
  let match;
  while ((match = rirekiRegex.exec(html)) !== null) {
    visits.push({
      visit_number: parseInt(match[1]) || 0,
      date: match[4].trim(),
      reception: match[5].trim(),
      motive: match[6].trim(),
      course: match[7].trim(),
      quantity: parseInt(match[8].trim()) || 1,
      staff1: match[9].trim(),
      staff2: match[10].trim(),
      amount: parseInt(match[11].replace(/,/g, '').trim()) || 0,
    });
  }
  return visits;
}

function extractDetailFields(html) {
  const fields = {};
  const fieldMap = { 'kKana': 'furigana', 'kName': 'name', 'kZip': 'zipcode', 'kAddr1': 'address1', 'kTel1': 'phone1', 'kMail1': 'email', 'kJob': 'occupation' };
  for (const [formName, key] of Object.entries(fieldMap)) {
    const regex = new RegExp(`name="${formName}"[^>]*value="([^"]*)"`);
    const m = html.match(regex);
    fields[key] = m ? m[1] : '';
  }
  return fields;
}

async function main() {
  await login();
  const dbClient = new Client({ connectionString: DB_URL });
  await dbClient.connect();

  // ========== PART 1: Find and add missing 2 customers ==========
  console.log('\n=== Part 1: Finding missing customers ===');

  // Re-scrape all pages to get full list
  const TOTAL_PAGES = 29;
  const allCustomers = [];
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const postData = `gid=t3&page=ns_kokyaku_list&init=on&caller=list&field=RAITENCNT&sort=desc&current=${page}`;
    const result = await fetch('/requartet/index.php', 'POST', postData);
    const customers = parseCustomerList(result.body);
    allCustomers.push(...customers);
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`Total from Re:QUARTET: ${allCustomers.length}`);

  // Check what's in DB
  const dbPatients = await dbClient.query('SELECT name, furigana FROM cm_patients WHERE clinic_id = $1', [CLINIC_ID]);
  const dbNames = new Set(dbPatients.rows.map(r => r.name));
  console.log(`Total in DB: ${dbNames.size}`);

  // Find missing
  const missing = allCustomers.filter(c => !dbNames.has(c.name));
  console.log(`Missing customers: ${missing.length}`);
  missing.forEach(m => console.log(`  - ${m.name} (${m.furigana}), visits: ${m.visit_count}`));

  // Add missing customers
  for (const cust of missing) {
    const postData = `gid=t3&page=ns_kokyaku&kokyaku=${cust.kcode}&caller=list`;
    const result = await fetch('/requartet/index.php', 'POST', postData);
    const detail = extractDetailFields(result.body);
    const memo = extractMemo(result.body);
    const visits = extractVisits(result.body);

    let firstVisitDate = null, lastVisitDate = null, ltv = 0;
    if (visits.length > 0) {
      lastVisitDate = parseDateFromVisit(visits[0].date);
      firstVisitDate = parseDateFromVisit(visits[visits.length - 1].date);
      visits.forEach(v => { ltv += v.amount || 0; });
    } else if (cust.last_visit) {
      lastVisitDate = cust.last_visit;
    }

    let daysSinceLastVisit = null;
    if (lastVisitDate) {
      daysSinceLastVisit = Math.floor((new Date() - new Date(lastVisitDate)) / (1000 * 60 * 60 * 24));
    }

    const patientResult = await dbClient.query(`
      INSERT INTO cm_patients (
        name, furigana, gender, phone, email, address, zipcode,
        prefecture, city, occupation, notes,
        visit_count, first_visit_date, last_visit_date,
        ltv, days_since_last_visit,
        status, is_enabled, clinic_id, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'active',true,$17,NOW(),NOW())
      RETURNING id
    `, [
      cust.name, cust.furigana || detail.furigana || '', cust.gender || '不明',
      cust.phone || detail.phone1 || '', detail.email || '',
      cust.address || detail.address1 || '', detail.zipcode || '',
      extractPrefecture(cust.address), extractCity(cust.address),
      detail.occupation || '', memo,
      cust.visit_count || visits.length, firstVisitDate, lastVisitDate,
      ltv, daysSinceLastVisit, CLINIC_ID,
    ]);

    const patientId = patientResult.rows[0].id;

    for (const visit of visits) {
      const visitDate = parseDateFromVisit(visit.date);
      if (!visitDate) continue;

      await dbClient.query(`
        INSERT INTO cm_visit_records (patient_id, visit_date, visit_number, treatment_content, payment_amount, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [patientId, visitDate, visit.visit_number, visit.course || '', visit.amount || 0, visit.motive ? `動機: ${visit.motive}` : '']);

      if (visit.course) {
        await dbClient.query(`
          INSERT INTO cm_slips (patient_id, patient_name, visit_date, staff_name, menu_name, total_price, base_price, option_price, discount, tax, notes, clinic_id, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,$8,$9,NOW())
        `, [patientId, cust.name, visitDate, visit.staff1 || '', visit.course, visit.amount || 0, visit.amount || 0, visit.reception || '', CLINIC_ID]);
      }
    }

    console.log(`  Added: ${cust.name} (${visits.length} visits, memo: ${memo ? 'yes' : 'no'})`);
    await new Promise(r => setTimeout(r, 300));
  }

  // ========== PART 2: Update all memos ==========
  console.log('\n=== Part 2: Updating memos for all customers ===');

  // Get all DB patients with their names and kcode mapping
  const allDbPatients = await dbClient.query('SELECT id, name FROM cm_patients WHERE clinic_id = $1', [CLINIC_ID]);
  const nameToId = {};
  allDbPatients.rows.forEach(r => { nameToId[r.name] = r.id; });

  let memoUpdated = 0;
  let memoEmpty = 0;
  const BATCH_SIZE = 5;

  for (let i = 0; i < allCustomers.length; i += BATCH_SIZE) {
    const batch = allCustomers.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (cust) => {
      const postData = `gid=t3&page=ns_kokyaku&kokyaku=${cust.kcode}&caller=list`;
      const result = await fetch('/requartet/index.php', 'POST', postData);
      const memo = extractMemo(result.body);
      return { name: cust.name, memo };
    });

    const results = await Promise.all(promises);

    for (const { name, memo } of results) {
      const patientId = nameToId[name];
      if (!patientId) continue;

      if (memo) {
        await dbClient.query('UPDATE cm_patients SET notes = $1, updated_at = NOW() WHERE id = $2', [memo, patientId]);
        memoUpdated++;
      } else {
        memoEmpty++;
      }
    }

    if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= allCustomers.length) {
      console.log(`  ${Math.min(i + BATCH_SIZE, allCustomers.length)}/${allCustomers.length} processed (memos: ${memoUpdated} updated, ${memoEmpty} empty)`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Final verification
  const finalCount = await dbClient.query('SELECT COUNT(*) FROM cm_patients WHERE clinic_id = $1', [CLINIC_ID]);
  const memoCount = await dbClient.query("SELECT COUNT(*) FROM cm_patients WHERE clinic_id = $1 AND notes IS NOT NULL AND notes != ''", [CLINIC_ID]);
  const visitTotal = await dbClient.query('SELECT COUNT(*) FROM cm_visit_records vr JOIN cm_patients p ON vr.patient_id = p.id WHERE p.clinic_id = $1', [CLINIC_ID]);

  console.log('\n=== Final Verification ===');
  console.log(`Total patients: ${finalCount.rows[0].count}`);
  console.log(`Patients with memos: ${memoCount.rows[0].count}`);
  console.log(`Total visit records: ${visitTotal.rows[0].count}`);

  await dbClient.end();
}

main().catch(console.error);
