const https = require('https');
const fs = require('fs');

const SESSION_COOKIE = 'PHPSESSID=ik095nn53rjj9ek6issul5nc8v; requartettenpo=YTo2NDp7czo4OiJ0ZW5wb19pZCI7aToyMjIzMjMwMTtzOjk6InRlbnBvX21laSI7czo0NDoiTXVsbGF3YXnvvIjjg57jg6njgqbjgqfjgqTvvInmlbTkvZPpmaLjgIDmp5giO3M6MTE6InRlbnBvX3J5YWt1IjtzOjA6IiI7czoxMjoib3lhX3RlbnBvX2lkIjtOO3M6MTA6InVzZV9zeXN0ZW0iO3M6MTA6IjEwMDAwMDAwMDAiO3M6MTY6InlveWFrdV9kaXNwX3R5cGUiO3M6MDoiIjtzOjE3OiJhdXRvX2tva3lha3VfY29kZSI7czozOiJ5ZXMiO3M6MTQ6ImVuYWJsZV9kYXRlX3N0IjtzOjE5OiIyMDAwLTAxLTAxIDAwOjAwOjAwIjtzOjE0OiJlbmFibGVfZGF0ZV9lZCI7czoxOToiMjA5OS0xMi0zMSAwMDowMDowMCI7czoxMToiZW5hYmxlX2ZsYWciO3M6MToiMSI7czoxMToiaG9udGVuX2ZsYWciO3M6MToiMCI7czoxMToicmVwZWF0X2RheXMiO047czoxMzoicmVwZWF0X2NvdW50cyI7TjtzOjEwOiJiZWRfY291bnRzIjtpOjE7czoxODoiYXV0b19rb2t5YWt1X2JlZ2luIjtzOjc6IjAwMDAwMDEiO3M6MTg6InByZWZlY3R1cmVzX2RlcGxveSI7czozOiJ5ZXMiO3M6MTM6ImhlaWdodF9yaXJla2kiO2k6NDAwO3M6MTU6InN1bW1hcnlfZGVmYXVsdCI7TjtzOjE0OiJsYXN0b3JkZXJfZmxhZyI7aTowO3M6MTA6Imppa2FuX3dha3UiO2k6NTtzOjE3OiJjYW5jZWxfcmVjZXB0X2RheSI7TjtzOjE4OiJjYW5jZWxfcmVjZXB0X3RpbWUiO3M6MDoiIjtzOjEzOiJlaWd5b19vcG5fc3VuIjtzOjU6IjA5OjAwIjtzOjEzOiJlaWd5b19jbHNfc3VuIjtzOjU6IjIwOjAwIjtzOjEzOiJreXVrZWlfc3Rfc3VuIjtzOjA6IiI7czoxMzoia3l1a2VpX2VkX3N1biI7czowOiIiO3M6MTM6ImVpZ3lvX29wbl9tb24iO3M6NToiMDk6MDAiO3M6MTM6ImVpZ3lvX2Nsc19tb24iO3M6NToiMjA6MDAiO3M6MTM6Imt5dWtlaV9zdF9tb24iO3M6MDoiIjtzOjEzOiJreXVrZWlfZWRfbW9uIjtzOjA6IiI7czoxMzoiZWlneW9fb3BuX3R1ZSI7czowOiIiO3M6MTM6ImVpZ3lvX2Nsc190dWUiO3M6MDoiIjtzOjEzOiJreXVrZWlfc3RfdHVlIjtzOjA6IiI7czoxMzoia3l1a2VpX2VkX3R1ZSI7czowOiIiO3M6MTM6ImVpZ3lvX29wbl93ZWQiO3M6MDoiIjtzOjEzOiJlaWd5b19jbHNfd2VkIjtzOjA6IiI7czoxMzoia3l1a2VpX3N0X3dlZCI7czowOiIiO3M6MTM6Imt5dWtlaV9lZF93ZWQiO3M6MDoiIjtzOjEzOiJlaWd5b19vcG5fdGh1IjtzOjA6IiI7czoxMzoiZWlneW9fY2xzX3RodSI7czowOiIiO3M6MTM6Imt5dWtlaV9zdF90aHUiO3M6MDoiIjtzOjEzOiJreXVrZWlfZWRfdGh1IjtzOjA6IiI7czoxMzoiZWlneW9fb3BuX2ZyaSI7czowOiIiO3M6MTM6ImVpZ3lvX2Nsc19mcmkiO3M6MDoiIjtzOjEzOiJreXVrZWlfc3RfZnJpIjtzOjA6IiI7czoxMzoia3l1a2VpX2VkX2ZyaSI7czowOiIiO3M6MTM6ImVpZ3lvX29wbl9zYXQiO3M6MDoiIjtzOjEzOiJlaWd5b19jbHNfc2F0IjtzOjA6IiI7czoxMzoia3l1a2VpX3N0X3NhdCI7czowOiIiO3M6MTM6Imt5dWtlaV9lZF9zYXQiO3M6MDoiIjtzOjEwOiJ0ZWlreXVfc3VuIjtzOjU6IjAwMDAwIjtzOjEwOiJ0ZWlreXVfbW9uIjtzOjU6IjAwMDAwIjtzOjEwOiJ0ZWlreXVfdHVlIjtzOjU6IjAwMDAwIjtzOjEwOiJ0ZWlreXVfd2VkIjtzOjU6IjAwMDAwIjtzOjEwOiJ0ZWlreXVfdGh1IjtzOjU6IjAwMDAwIjtzOjEwOiJ0ZWlreXVfZnJpIjtzOjU6IjAwMDAwIjtzOjEwOiJ0ZWlreXVfc2F0IjtzOjU6IjAwMDAwIjtzOjE0OiJyZWdpc3RfbWFpbF9pZCI7TjtzOjE0OiJjYW5jZWxfbWFpbF9pZCI7TjtzOjE0OiJyZW1pbmRfbWFpbF9pZCI7TjtzOjk6InRheF9yb3VuZCI7czowOiIiO3M6MTE6InVzZV9wcmludGVyIjtzOjE6IjAiO3M6MTE6Imdyb3VwX2NvdW50IjtpOjA7czo3OiJwYXNzX29rIjtzOjM6InllcyI7fQ%3D%3D';

const TOTAL_CUSTOMERS = 566;
const PER_PAGE = 20;
const TOTAL_PAGES = Math.ceil(TOTAL_CUSTOMERS / PER_PAGE);

function fetch(path, method = 'GET', postData = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'c6410.jp',
      path,
      method,
      headers: {
        'Cookie': SESSION_COOKIE,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ...(method === 'POST' ? {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        } : {}),
      },
    };
    const req = https.request(options, (res) => {
      if (res.statusCode === 302) {
        resolve({ redirect: res.headers.location, cookies: res.headers['set-cookie'] });
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

function parseCustomerList(html) {
  const customers = [];
  const rowRegex = /<tr><td class='center'>(\d+)<\/td><td class='center'><a[^>]*rel='(\d+)'>(\d+)<\/a><\/td><td class='left'>([^<]*)<\/td><td class='left'>([^<]*)<\/td><td class='center'><span[^>]*>(男|女)<\/span><\/td><td class='left long'>([^<]*)<\/td><td class='left long'>([^<]*)<\/td><td class='left long'>(.*?)<\/td><td class='center'>([^<]*)<\/td>/g;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const tel2Div = match[9];
    const tel2Match = tel2Div.match(/<div>([^<]*)<\/div>/g) || [];
    const tel2List = tel2Match.map(d => d.replace(/<\/?div>/g, '')).filter(t => t.trim());

    customers.push({
      visit_count: parseInt(match[1]),
      kcode: match[2],
      kokyaku_no: match[3],
      furigana: match[4].trim(),
      name: match[5].trim(),
      gender: match[6],
      address: match[7].trim(),
      phone: match[8].trim(),
      phone2: tel2List,
      last_visit: match[10].trim(),
    });
  }
  return customers;
}

function parseCustomerDetail(html) {
  const detail = {};

  // Extract form fields
  const fieldMap = {
    'kKana': 'furigana',
    'kName': 'name',
    'kZip': 'zipcode',
    'kAddr1': 'address1',
    'kAddr2': 'address2',
    'kTel1': 'phone1',
    'kTel2': 'phone2',
    'kTel3': 'phone3',
    'kMail1': 'email',
    'kJob': 'occupation',
  };

  for (const [formName, key] of Object.entries(fieldMap)) {
    const regex = new RegExp(`name="${formName}"[^>]*value="([^"]*)"`);
    const match = html.match(regex);
    detail[key] = match ? match[1] : '';
  }

  // Extract gender
  const seiMatch = html.match(/name="kSei"[^>]*checked/);
  if (seiMatch) {
    const valMatch = seiMatch[0].match(/value="(\d+)"/);
    detail.gender = valMatch && valMatch[1] === '1' ? '男' : '女';
  }

  // Extract visit history from rireki table
  detail.visits = [];
  const rirekiRegex = /<tr>\s*<td class="c_meisai"[^>]*>\s*(?:<a[^>]*>(\d+)<\/a>)?\s*<div class="p1_meisai">([\s\S]*?)<\/div>\s*<\/td>\s*<td class="c_kikan"[^>]*>([^<]*)<\/td>\s*<td class="c_hiduke">([^<]*)<\/td>\s*<td class="c_uketuke">([^<]*)<\/td>\s*<td class="c_douki">([^<]*)<\/td>\s*<td class="c_course">([^<]*)<\/td>\s*<td class="c_quantity"[^>]*>([^<]*)<\/td>\s*<td class="c_tantou">([^<]*)<\/td>\s*<td class="c_tantou">([^<]*)<\/td>\s*<td class="c_kingaku"[^>]*>\s*([^<]*)/g;

  let match;
  while ((match = rirekiRegex.exec(html)) !== null) {
    detail.visits.push({
      visit_number: parseInt(match[1]) || 0,
      days_since_last: match[3].trim(),
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

  return detail;
}

async function scrapeAllPages() {
  console.log(`Scraping ${TOTAL_PAGES} pages of customer list...`);
  const allCustomers = [];

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const postData = `gid=t3&page=ns_kokyaku_list&init=on&caller=list&field=RAITENCNT&sort=desc&current=${page}`;
    const result = await fetch('/requartet/index.php', 'POST', postData);
    const customers = parseCustomerList(result.body);
    allCustomers.push(...customers);
    console.log(`  Page ${page}/${TOTAL_PAGES}: ${customers.length} customers (total: ${allCustomers.length})`);

    // Small delay to be nice
    await new Promise(r => setTimeout(r, 200));
  }

  return allCustomers;
}

async function scrapeCustomerDetails(customers) {
  console.log(`\nScraping ${customers.length} customer detail pages...`);
  const details = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (cust) => {
      const postData = `gid=t3&page=ns_kokyaku&kokyaku=${cust.kcode}&caller=list`;
      const result = await fetch('/requartet/index.php', 'POST', postData);
      const detail = parseCustomerDetail(result.body);
      return { ...cust, detail };
    });

    const results = await Promise.all(promises);
    details.push(...results);

    if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= customers.length) {
      console.log(`  ${Math.min(i + BATCH_SIZE, customers.length)}/${customers.length} details fetched`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return details;
}

async function main() {
  const outputDir = '/Users/ooguchiyouhei/事業/AI会社/MEO勝ち上げくん/app/scripts/output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Phase 1: Scrape customer list
  console.log('=== Phase 1: Customer List ===');
  const customers = await scrapeAllPages();
  fs.writeFileSync(`${outputDir}/customers_list.json`, JSON.stringify(customers, null, 2));
  console.log(`Saved ${customers.length} customers to customers_list.json`);

  // Phase 2: Scrape details with visit history
  console.log('\n=== Phase 2: Customer Details + Visit History ===');
  const details = await scrapeCustomerDetails(customers);
  fs.writeFileSync(`${outputDir}/customers_full.json`, JSON.stringify(details, null, 2));

  // Summary
  let totalVisits = 0;
  details.forEach(d => { totalVisits += (d.detail?.visits?.length || 0); });
  console.log(`\nDone! ${details.length} customers, ${totalVisits} visit records total`);
  console.log(`Data saved to ${outputDir}/customers_full.json`);
}

main().catch(console.error);
