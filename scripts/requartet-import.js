const { Client } = require('pg');
const fs = require('fs');

const CLINIC_ID = 'b82a0e9d-e1df-4d99-9b97-db5befbf829b';
const DB_URL = 'postgresql://postgres.vzkfkazjylrkspqrnhnx:fJZj8SDawfJze7H9@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

function parseDateFromVisit(dateStr) {
  // "2026-03-08 (日) 18:25" -> "2026-03-08"
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

async function main() {
  const data = JSON.parse(fs.readFileSync('./scripts/output/customers_full.json', 'utf8'));
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log(`Importing ${data.length} customers into clinic ${CLINIC_ID}...`);

  // Check existing patients to avoid duplicates
  const existing = await client.query('SELECT name, furigana FROM cm_patients WHERE clinic_id = $1', [CLINIC_ID]);
  const existingNames = new Set(existing.rows.map(r => r.name));
  console.log(`Existing patients: ${existingNames.size}`);

  let patientCount = 0;
  let visitCount = 0;
  let slipCount = 0;
  let skipped = 0;

  for (const cust of data) {
    // Skip if already exists
    if (existingNames.has(cust.name)) {
      skipped++;
      continue;
    }

    const detail = cust.detail || {};
    const visits = detail.visits || [];

    // Determine first and last visit dates
    let firstVisitDate = null;
    let lastVisitDate = null;
    if (visits.length > 0) {
      // Visits are sorted newest first
      lastVisitDate = parseDateFromVisit(visits[0].date);
      firstVisitDate = parseDateFromVisit(visits[visits.length - 1].date);
    } else if (cust.last_visit) {
      lastVisitDate = cust.last_visit;
    }

    // Calculate LTV
    let ltv = 0;
    visits.forEach(v => { ltv += v.amount || 0; });

    // Calculate days since last visit
    let daysSinceLastVisit = null;
    if (lastVisitDate) {
      const diff = new Date() - new Date(lastVisitDate);
      daysSinceLastVisit = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    const prefecture = extractPrefecture(cust.address);
    const city = extractCity(cust.address);

    // Insert patient
    const patientResult = await client.query(`
      INSERT INTO cm_patients (
        name, furigana, gender, phone, email, address, zipcode,
        prefecture, city, occupation,
        visit_count, first_visit_date, last_visit_date,
        ltv, days_since_last_visit,
        status, is_enabled, clinic_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        $14, $15,
        'active', true, $16, NOW(), NOW()
      ) RETURNING id
    `, [
      cust.name,
      cust.furigana || detail.furigana || '',
      cust.gender || '不明',
      cust.phone || detail.phone1 || '',
      detail.email || '',
      cust.address || detail.address1 || '',
      detail.zipcode || '',
      prefecture,
      city,
      detail.occupation || '',
      cust.visit_count || visits.length,
      firstVisitDate,
      lastVisitDate,
      ltv,
      daysSinceLastVisit,
      CLINIC_ID,
    ]);

    const patientId = patientResult.rows[0].id;
    patientCount++;

    // Insert visit records and slips
    for (const visit of visits) {
      const visitDate = parseDateFromVisit(visit.date);
      if (!visitDate) continue;

      // Insert cm_visit_records
      await client.query(`
        INSERT INTO cm_visit_records (
          patient_id, visit_date, visit_number,
          treatment_content, payment_amount, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        patientId,
        visitDate,
        visit.visit_number,
        visit.course || '',
        visit.amount || 0,
        visit.motive ? `動機: ${visit.motive}` : '',
      ]);
      visitCount++;

      // Insert cm_slips
      if (visit.course) {
        await client.query(`
          INSERT INTO cm_slips (
            patient_id, patient_name, visit_date,
            staff_name, menu_name, total_price,
            base_price, option_price, discount, tax,
            notes, clinic_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 0, $8, $9, NOW())
        `, [
          patientId,
          cust.name,
          visitDate,
          visit.staff1 || '',
          visit.course,
          visit.amount || 0,
          visit.amount || 0,
          visit.reception || '',
          CLINIC_ID,
        ]);
        slipCount++;
      }
    }

    if (patientCount % 50 === 0) {
      console.log(`  ${patientCount} patients, ${visitCount} visits, ${slipCount} slips inserted...`);
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Patients: ${patientCount} inserted, ${skipped} skipped (already exist)`);
  console.log(`Visit records: ${visitCount}`);
  console.log(`Slips: ${slipCount}`);

  // Verify
  const countResult = await client.query('SELECT COUNT(*) FROM cm_patients WHERE clinic_id = $1', [CLINIC_ID]);
  console.log(`\nTotal patients in DB for this clinic: ${countResult.rows[0].count}`);

  await client.end();
}

main().catch(console.error);
