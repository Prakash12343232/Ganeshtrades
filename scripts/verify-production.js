const DEFAULT_API = 'https://ganeshtrades1.onrender.com/api';
const DEFAULT_SITE = 'https://ganeshtrades.vercel.app';
const DEMO_PRODUCT_NAMES = [
  'Basmati Rice (Premium)',
  'Sona Masoori Rice',
  'Toor Dal',
  'Moong Dal',
  'Chana Dal',
  'Turmeric Powder',
  'Red Chilli Powder',
  'Cumin Seeds',
  'Sunflower Oil',
  'Pure Ghee',
  'Wheat Flour (Atta)',
  'Sugar',
  'Jaggery (Gud)',
  'Tea Powder (Brooke Bond)',
  'Coffee Powder',
  'Cashew Nuts',
  'Almonds',
  'Surf Excel Powder',
  'Vim Dishwash Bar',
  'Maggi Noodles'
];

const args = process.argv.slice(2);
const opt = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const apiBase = opt('--api', process.env.GT_API_BASE || DEFAULT_API).replace(/\/$/, '');
const siteUrl = opt('--site', process.env.GT_SITE_URL || DEFAULT_SITE).replace(/\/$/, '');
const otpUrlRaw = opt('--otp', process.env.GT_OTP_URL || '');
const otpUrl = otpUrlRaw ? otpUrlRaw.replace(/\/$/, '') : '';

let failures = 0;
const report = (check, ok, detail, remedy) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${check}: ${detail}`);
  if (!ok && remedy) console.log(`      fix: ${remedy}`);
  if (!ok) failures++;
};

const fetchJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
  return { status: res.status, body };
};

const run = async () => {
  console.log(`Ganesh Trades production readiness checks`);
  console.log(`  API   : ${apiBase}`);
  console.log(`  Site  : ${siteUrl}`);
  console.log(`  OTP   : ${otpUrl || '(not configured)'}`);
  console.log('');

  let health = null;
  try {
    const { status, body } = await fetchJson(`${apiBase}/health`);
    health = { status, body };
    report(
      'backend health endpoint',
      status === 200 && body.success === true,
      status === 200 && body.success === true ? JSON.stringify({ environment: body.environment, database: body.database }) : `HTTP ${status}`
    );
    report(
      'backend environment is production',
      body.environment === 'production',
      `environment=${JSON.stringify(body.environment)}`,
      'set NODE_ENV=production in the Render dashboard for ganeshtrades1 and redeploy'
    );
    report(
      'backend database connected',
      body.database === 'connected',
      `database=${JSON.stringify(body.database)}`,
      'set a real Atlas MONGODB_URI in the Render dashboard for ganeshtrades1 and redeploy'
    );
  } catch (err) {
    report('backend health endpoint', false, `unreachable: ${err.message}`, 'confirm the Render service ganeshtrades1 is running and healthy at /api/health');
  }

  const demoDetected = (products) =>
    Array.isArray(products) &&
    products.length > 0 &&
    products.every((p) => p.totalSold === 0 && (p.image === '/uploads/default-product.png' || DEMO_PRODUCT_NAMES.includes(p.name)));

  try {
    const { status, body } = await fetchJson(`${apiBase}/products?page=1&limit=50`);
    const products = body && body.data ? body.data : body;
    const detected = demoDetected(products);
    report(
      'backend not serving in-memory/demo data',
      status === 200 && !detected,
      detected ? 'all products match the in-memory demo seed (default-product.png / seeded names / totalSold 0)' : `HTTP ${status}, ${Array.isArray(products) ? products.length : '?'} products`,
      detected ? 'the service booted against the local in-memory fallback; after setting NODE_ENV=production + MONGODB_URI in Render, redeploy and re-run this check' : undefined
    );
  } catch (err) {
    report('backend not serving in-memory/demo data', false, `unreachable: ${err.message}`);
  }

  try {
    const res = await fetch(siteUrl);
    const html = await res.text();
    const assetMatch = html.match(/(?:src|href)="(\/assets\/index-[^"]+\.js)"/);
    report('frontend SPA shell served', res.status === 200 && html.includes('<div id="root"'), `HTTP ${res.status}`);
    let bundleOk = false;
    let bundleDetail = 'no bundle asset found in index.html';
    if (assetMatch) {
      const bundle = await (await fetch(`${siteUrl}${assetMatch[1]}`)).text();
      const expectedOrigin = new URL(apiBase).origin;
      bundleOk = bundle.includes(expectedOrigin);
      bundleDetail = `bundle ${assetMatch[1]} targets ${expectedOrigin}: ${bundleOk ? 'yes' : 'NO'}`;
    }
    report('frontend API target matches backend', bundleOk, bundleDetail, 'rebuild with the correct VITE_API_URL and redeploy the frontend on Vercel');
  } catch (err) {
    report('frontend SPA shell served', false, `unreachable: ${err.message}`);
  }

  if (otpUrl) {
    try {
      const { status, body } = await fetchJson(`${otpUrl}/api/health`);
      report('otp server healthy', status === 200, `HTTP ${status}${body && body.success ? ' (success)' : ''}`, 'create the ganeshtrades-otp-server Render service and configure it per render.yaml');
    } catch (err) {
      report('otp server healthy', false, `unreachable: ${err.message}`, 'create the ganeshtrades-otp-server Render service and configure it per render.yaml');
    }
  } else {
    console.log('SKIP  otp server: not configured (single-DB OTP topology is acceptable; pass --otp <url> to check it)');
  }

  console.log('');
  if (failures === 0) {
    console.log('RESULT: GREEN - all production readiness checks passed.');
  } else {
    console.log(`RESULT: ${failures} production readiness check(s) FAILED.`);
  }
  process.exitCode = failures === 0 ? 0 : 1;
};

run().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exitCode = 1;
});