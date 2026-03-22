const https = require('https');

let COOKIES = '';
function httpPost(path, postData) {
  return new Promise((resolve) => {
    const opt = { hostname: 'c6410.jp', path, method: 'POST',
      headers: { 'Cookie': COOKIES, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData), 'User-Agent': 'Mozilla/5.0' }
    };
    const req = https.request(opt, (res) => {
      if (res.statusCode === 302) COOKIES = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      let d = ''; res.on('data', ch => d += ch); res.on('end', () => resolve(d));
    });
    req.write(postData); req.end();
  });
}

async function main() {
  await httpPost('/requartet/index.php?gid=t3', 'gid=t3&login=22232301&password=12548526');
  const html = await httpPost('/requartet/index.php', 'gid=t3&page=ns_kokyaku&kokyaku=0007876&caller=list');

  // Extract the rireki table content and sejutu rows in order
  const tableStart = html.indexOf('<table id="p1_rireki_table">');
  const tableEnd = html.indexOf('</table>', tableStart);
  const tableHtml = html.substring(tableStart, tableEnd);

  // Parse all <tr> in order
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let match;
  let lastVisitNum = null;
  let lastDate = null;
  const pairs = [];

  while ((match = trRegex.exec(tableHtml)) !== null) {
    const tr = match[1];

    // Check if this is a visit row (has sejutu_n link and c_hiduke)
    const visitMatch = tr.match(/id="sejutu_n(\d+)"[^>]*>(\d+)<\/a>/);
    const dateMatch = tr.match(/<td class="c_hiduke">([^<]*)<\/td>/);

    if (visitMatch && dateMatch) {
      lastVisitNum = parseInt(visitMatch[2]);
      lastDate = dateMatch[1].trim();
    }

    // Check if this is a sejutu row
    const sejutuMatch = tr.match(/<textarea[^>]*id='p1_sejutu_n(\d+)'[^>]*>([\s\S]*?)<\/textarea>/);
    if (sejutuMatch && lastVisitNum !== null) {
      pairs.push({
        visitNum: lastVisitNum,
        date: lastDate,
        content: sejutuMatch[2].trim()
      });
      lastVisitNum = null;
      lastDate = null;
    }
  }

  console.log('Total visit-sejutu pairs:', pairs.length);
  pairs.forEach(p => {
    console.log(`  visit#${p.visitNum} ${p.date} | ${p.content.replace(/\n/g, ' ').substring(0, 80)}`);
  });
}

main().catch(console.error);
