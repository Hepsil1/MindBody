const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();
const http = require('http');
const fs = require('fs');
const path = require('path');

async function audit() {
  console.log('=========================================');
  console.log('  MINDBODY VPS AUDIT - ' + new Date().toISOString());
  console.log('=========================================\n');

  // 1. DATABASE SCHEMA CHECK
  console.log('=== 1. DATABASE SCHEMA ===');
  try {
    const tables = await p.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
    );
    console.log('  Tables:', tables.map(t => t.tablename).join(', '));
  } catch(e) {
    console.log('  ERROR:', e.message);
  }

  // Review columns
  try {
    const cols = await p.$queryRawUnsafe(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Review' ORDER BY ordinal_position`
    );
    console.log('\n  Review columns:', cols.map(c => c.column_name).join(', '));
    const hasStatus = cols.some(c => c.column_name === 'status');
    console.log('  Review has "status" column:', hasStatus);
    if (!hasStatus) console.log('  ⚠️  PROBLEM: Review table missing "status" column - review moderation will break!');
  } catch(e) {
    console.log('  Review schema error:', e.message);
  }

  // User columns
  try {
    const cols = await p.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'User' ORDER BY ordinal_position`
    );
    console.log('\n  User columns:', cols.map(c => c.column_name).join(', '));
  } catch(e) {
    console.log('  User schema error:', e.message);
  }

  // 2. DATA COUNTS
  console.log('\n=== 2. DATA COUNTS ===');
  const countQueries = [
    ['Product (total)', 'SELECT COUNT(*)::int as c FROM "Product"'],
    ['Product (active)', `SELECT COUNT(*)::int as c FROM "Product" WHERE status = 'active'`],
    ['Slide (total)', 'SELECT COUNT(*)::int as c FROM "Slide"'],
    ['Slide (home)', `SELECT COUNT(*)::int as c FROM "Slide" WHERE page IS NULL OR page = 'home'`],
    ['Category', 'SELECT COUNT(*)::int as c FROM "Category"'],
    ['Order', 'SELECT COUNT(*)::int as c FROM "Order"'],
    ['ShopPage', 'SELECT COUNT(*)::int as c FROM "ShopPage"'],
    ['FilterConfig', 'SELECT COUNT(*)::int as c FROM "FilterConfig"'],
    ['Review', 'SELECT COUNT(*)::int as c FROM "Review"'],
    ['PromoCode', 'SELECT COUNT(*)::int as c FROM "PromoCode"'],
    ['User', 'SELECT COUNT(*)::int as c FROM "User"'],
  ];
  for (const [name, q] of countQueries) {
    try {
      const r = await p.$queryRawUnsafe(q);
      const flag = (name.includes('Slide') && r[0].c === 0) ? ' ⚠️  EMPTY - hero slider will be blank!' : '';
      console.log(`  ${name}: ${r[0].c}${flag}`);
    } catch(e) {
      console.log(`  ${name}: ERROR - ${e.message.substring(0, 80)}`);
    }
  }

  // 3. PRODUCTS INTEGRITY
  console.log('\n=== 3. PRODUCT INTEGRITY ===');
  try {
    const noImg = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "Product" WHERE images IS NULL OR images = '[]' OR images = '' OR images = 'null'`);
    console.log(`  Products with no images: ${noImg[0].c}`);
    
    const dDrive = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "Product" WHERE images LIKE '%D:%' OR images LIKE '%d:%'`);
    console.log(`  Products with D: drive paths: ${dDrive[0].c}`);

    const absPath = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "Product" WHERE images LIKE '%C:\\\\%' OR images LIKE '%c:\\\\%'`);
    console.log(`  Products with C: drive absolute paths: ${absPath[0].c}`);

    const noSlug = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "Product" WHERE "shopPageSlug" IS NULL OR "shopPageSlug" = ''`);
    console.log(`  Products without shopPageSlug: ${noSlug[0].c}`);

    const noPrice = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "Product" WHERE price IS NULL OR price = 0`);
    console.log(`  Products with zero/null price: ${noPrice[0].c}`);

    // Sample a product to check image paths
    const sample = await p.$queryRawUnsafe(`SELECT id, name, images FROM "Product" WHERE status = 'active' LIMIT 3`);
    console.log('\n  Sample products:');
    for (const prod of sample) {
      let imgs = [];
      try { imgs = JSON.parse(prod.images || '[]'); } catch {}
      console.log(`    - ${prod.name}: ${imgs.length} images, first: ${imgs[0] || 'NONE'}`);
    }
  } catch(e) {
    console.log('  Error:', e.message);
  }

  // 4. SHOPPAGE DATA
  console.log('\n=== 4. SHOP PAGES ===');
  try {
    const pages = await p.$queryRawUnsafe(`SELECT slug, title, "heroImage", "heroImagePos" FROM "ShopPage"`);
    for (const pg of pages) {
      const hasImg = pg.heroImage && pg.heroImage.length > 3;
      console.log(`  ${pg.slug}: title="${pg.title}", heroImage=${hasImg ? '✅' : '❌ MISSING'}, pos=${pg.heroImagePos}`);
    }
  } catch(e) {
    console.log('  Error:', e.message);
  }

  // 5. CATEGORIES
  console.log('\n=== 5. CATEGORIES ===');
  try {
    const cats = await p.$queryRawUnsafe(`SELECT id, title, image, link FROM "Category" ORDER BY "order" ASC`);
    for (const cat of cats) {
      console.log(`  ${cat.title}: link=${cat.link}, image=${cat.image ? cat.image.substring(0, 50) : 'NONE'}`);
    }
  } catch(e) {
    console.log('  Error:', e.message);
  }

  // 6. FILTER CONFIGS
  console.log('\n=== 6. FILTER CONFIGS ===');
  try {
    const fcs = await p.$queryRawUnsafe(`SELECT id, config FROM "FilterConfig"`);
    for (const fc of fcs) {
      try {
        const parsed = JSON.parse(fc.config);
        const cats = parsed.categories ? Object.keys(parsed.categories).length : 0;
        const colors = parsed.colors ? Object.keys(parsed.colors).length : 0;
        const sizes = parsed.sizes ? parsed.sizes.length : 0;
        console.log(`  ${fc.id}: ${cats} categories, ${colors} colors, ${sizes} sizes`);
      } catch {
        console.log(`  ${fc.id}: INVALID JSON!`);
      }
    }
  } catch(e) {
    console.log('  Error:', e.message);
  }

  // 7. FILE SYSTEM CHECKS
  console.log('\n=== 7. FILE SYSTEM ===');
  const checkPaths = [
    'build/server/index.js',
    'build/client/index.html',
    'public/brand-sun.png',
    'public/robots.txt',
    'public/uploads',
    '.env',
    'ecosystem.config.cjs',
    'node_modules/@prisma/client',
    'prisma/schema.prisma',
  ];
  for (const p of checkPaths) {
    const full = path.join('c:\\mindbody', p);
    const exists = fs.existsSync(full);
    const stat = exists ? fs.statSync(full) : null;
    const info = stat ? (stat.isDirectory() ? 'DIR' : `${Math.round(stat.size/1024)}KB`) : '';
    console.log(`  ${exists ? '✅' : '❌'} ${p} ${info}`);
  }

  // Check uploads directory  
  const uploadsDir = path.join('c:\\mindbody', 'public', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    console.log(`  📁 public/uploads: ${files.length} files`);
  }

  // 8. HTTP ENDPOINT TESTS
  console.log('\n=== 8. HTTP ENDPOINT TESTS ===');
  const endpoints = [
    ['/', 'Home page'],
    ['/shop/yoga', 'Shop yoga'],
    ['/shop/sport', 'Shop sport'],
    ['/admin/login', 'Admin login'],
    ['/api/search?q=test', 'Search API'],
    ['/sitemap.xml', 'Sitemap'],
    ['/robots.txt', 'Robots.txt'],
  ];

  for (const [url, name] of endpoints) {
    try {
      const result = await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:3000${url}`, { timeout: 5000 }, (res) => {
          let body = '';
          res.on('data', d => body += d.toString().substring(0, 500));
          res.on('end', () => resolve({ status: res.statusCode, bodyLen: body.length, snippet: body.substring(0, 100) }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });
      const flag = result.status >= 400 ? '⚠️' : '✅';
      console.log(`  ${flag} ${name} (${url}): ${result.status}, ${result.bodyLen} bytes`);
    } catch(e) {
      console.log(`  ❌ ${name} (${url}): ${e.message}`);
    }
  }

  // 9. ENV VARIABLE CHECK
  console.log('\n=== 9. ENV FILE CHECK ===');
  try {
    const envContent = fs.readFileSync('c:\\mindbody\\.env', 'utf-8');
    const required = ['DATABASE_URL', 'SESSION_SECRET', 'ADMIN_PASSWORD', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'NOVA_POSHTA_API_KEY', 'SITE_URL'];
    for (const key of required) {
      const regex = new RegExp(`^${key}=(.+)$`, 'm');
      const match = envContent.match(regex);
      if (match) {
        const val = match[1].replace(/"/g, '');
        const safe = ['SITE_URL', 'TELEGRAM_CHAT_ID'].includes(key) ? val : `[SET, ${val.length} chars]`;
        console.log(`  ✅ ${key} = ${safe}`);
      } else {
        console.log(`  ❌ ${key} = MISSING!`);
      }
    }
  } catch(e) {
    console.log('  Error reading .env:', e.message);
  }

  // 10. PM2 ECOSYSTEM CHECK
  console.log('\n=== 10. ECOSYSTEM CONFIG ===');
  try {
    const eco = require('./ecosystem.config.cjs');
    const app = eco.apps[0];
    console.log(`  name: ${app.name}`);
    console.log(`  script: ${app.script}`);
    console.log(`  args: ${app.args}`);
    console.log(`  cwd: ${app.cwd}`);
    console.log(`  NODE_ENV: ${app.env?.NODE_ENV}`);
    console.log(`  PORT: ${app.env?.PORT}`);
    console.log(`  DATABASE_URL: ${app.env?.DATABASE_URL ? '[SET]' : '❌ MISSING'}`);
    console.log(`  SESSION_SECRET: ${app.env?.SESSION_SECRET ? '[SET]' : '❌ MISSING'}`);
    console.log(`  SITE_URL: ${app.env?.SITE_URL || '❌ MISSING'}`);
  } catch(e) {
    console.log('  Error:', e.message);
  }

  // 11. PRISMA SCHEMA vs DB SYNC
  console.log('\n=== 11. PRISMA SCHEMA SYNC ===');
  try {
    const schemaContent = fs.readFileSync('c:\\mindbody\\prisma\\schema.prisma', 'utf-8');
    const models = schemaContent.match(/model\s+(\w+)/g);
    console.log('  Schema models:', models ? models.map(m => m.replace('model ', '')).join(', ') : 'NONE');
    
    // Check for _prisma_migrations table
    const migrations = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`);
    console.log(`  Applied migrations: ${migrations[0].c}`);
    
    const pending = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "_prisma_migrations" WHERE finished_at IS NULL`);
    if (pending[0].c > 0) console.log(`  ⚠️ Pending migrations: ${pending[0].c}`);
  } catch(e) {
    console.log('  Error:', e.message);
  }

  console.log('\n=========================================');
  console.log('  AUDIT COMPLETE');
  console.log('=========================================');

  await p.$disconnect();
}

audit().catch(e => { console.error('FATAL:', e); process.exit(1); });
