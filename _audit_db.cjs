const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();

async function audit() {
  try {
    const tables = [
      { name: 'Product', q: 'SELECT COUNT(*)::int as c FROM "Product"' },
      { name: 'Slide', q: 'SELECT COUNT(*)::int as c FROM "Slide"' },
      { name: 'Category', q: 'SELECT COUNT(*)::int as c FROM "Category"' },
      { name: 'Order', q: 'SELECT COUNT(*)::int as c FROM "Order"' },
      { name: 'ShopPage', q: 'SELECT COUNT(*)::int as c FROM "ShopPage"' },
      { name: 'FilterConfig', q: 'SELECT COUNT(*)::int as c FROM "FilterConfig"' },
      { name: 'Review', q: 'SELECT COUNT(*)::int as c FROM "Review"' },
      { name: 'PromoCode', q: 'SELECT COUNT(*)::int as c FROM "PromoCode"' },
      { name: 'User', q: 'SELECT COUNT(*)::int as c FROM "User"' },
    ];

    console.log('=== DATABASE HEALTH ===');
    for (const t of tables) {
      try {
        const r = await p.$queryRawUnsafe(t.q);
        console.log(`  ${t.name}: ${r[0].c} records`);
      } catch (e) {
        console.log(`  ${t.name}: ERROR - ${e.message}`);
      }
    }

    // Check active products with images
    const activeProducts = await p.$queryRawUnsafe('SELECT COUNT(*)::int as c FROM "Product" WHERE status = \'active\'');
    console.log(`  Active Products: ${activeProducts[0].c}`);

    // Check products without images
    const noImg = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "Product" WHERE images IS NULL OR images = '[]' OR images = ''`);
    console.log(`  Products without images: ${noImg[0].c}`);

    // Check products with broken image paths (referencing D: drive)
    const dDrive = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "Product" WHERE images LIKE '%D:%' OR images LIKE '%d:%'`);
    console.log(`  Products with D: drive paths: ${dDrive[0].c}`);

    // Check slides
    const homeSlides = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "Slide" WHERE page IS NULL OR page = 'home'`);
    console.log(`  Home Slides: ${homeSlides[0].c}`);

    // Check filter configs
    const configs = await p.$queryRawUnsafe('SELECT id FROM "FilterConfig"');
    console.log(`  FilterConfig IDs: ${configs.map(c => c.id).join(', ')}`);
    
    // Check for pending reviews
    const pendingReviews = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "Review" WHERE status = 'pending'`);
    console.log(`  Pending Reviews: ${pendingReviews[0].c}`);

    // Check orders
    const recentOrders = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as c FROM "Order" WHERE "createdAt" > NOW() - INTERVAL '7 days'`);
    console.log(`  Orders (last 7 days): ${recentOrders[0].c}`);

  } catch (e) {
    console.error('Database connection error:', e.message);
  } finally {
    await p.$disconnect();
  }
}

audit();
