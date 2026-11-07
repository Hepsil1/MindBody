import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function dismissCookieBanner(page) {
    try {
        const acceptBtn = page.locator('button:has-text("Прийняти"), button:has-text("Лише необхідні"), .cookie-banner button').first();
        if (await acceptBtn.isVisible({ timeout: 1500 })) {
            await acceptBtn.click();
            await page.waitForTimeout(300);
        }
    } catch(e) {}
}

async function main() {
    const rawProducts = await prisma.product.findMany({ take: 3 });
    await prisma.$disconnect();

    const plainProducts = rawProducts.map(p => {
        let imgs = [];
        try { imgs = JSON.parse(p.images); } catch(e) {}
        return {
            id: String(p.id),
            name: String(p.name),
            price: Number(p.price) || 1400,
            image: imgs[0] || '/uploads/placeholder.webp'
        };
    });

    const outputDir = 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1/screenshots/cart_checkout/';
    fs.mkdirSync(outputDir, { recursive: true });

    const browser = await chromium.launch();

    // 1. Desktop - Cart Drawer
    {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto('http://localhost:3000/');
        await page.waitForLoadState('networkidle');
        await dismissCookieBanner(page);

        const cartItems = plainProducts.map((p, idx) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            quantity: idx === 0 ? 2 : 1,
            size: idx === 0 ? 'S' : 'M',
            color: idx === 0 ? 'black' : 'espresso',
            image: p.image
        }));

        await page.evaluate((itemsJson) => {
            localStorage.setItem('cart', itemsJson);
            window.dispatchEvent(new Event('cart-updated'));
        }, JSON.stringify(cartItems));

        await page.click('.header__action-btn--cart, button[aria-label*="Кошик"], [aria-label*="кошик"]');
        await page.waitForTimeout(600);

        await page.screenshot({ path: path.join(outputDir, '06_cart_drawer_desktop.png') });
        console.log('Saved 06_cart_drawer_desktop.png');
        await page.close();
    }

    // 2. Mobile - Cart Drawer (390x844 iPhone 14/15)
    {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        await page.goto('http://localhost:3000/');
        await page.waitForLoadState('networkidle');
        await dismissCookieBanner(page);

        const cartItems = plainProducts.slice(0, 2).map((p, idx) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            quantity: 1,
            size: idx === 0 ? 'XS' : 'S',
            color: idx === 0 ? 'graphite' : 'taupe',
            image: p.image
        }));

        await page.evaluate((itemsJson) => {
            localStorage.setItem('cart', itemsJson);
            window.dispatchEvent(new Event('cart-updated'));
        }, JSON.stringify(cartItems));

        await page.click('.header__action-btn--cart, button[aria-label*="Кошик"], [aria-label*="кошик"]');
        await page.waitForTimeout(600);

        await page.screenshot({ path: path.join(outputDir, '07_cart_drawer_mobile.png') });
        console.log('Saved 07_cart_drawer_mobile.png');
        await page.close();
    }

    // 3. Desktop - Checkout page
    {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto('http://localhost:3000/checkout');
        await page.waitForLoadState('networkidle');
        await dismissCookieBanner(page);

        const cartItems = plainProducts.slice(0, 1).map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            quantity: 1,
            size: 'S',
            color: 'black',
            image: p.image
        }));

        await page.evaluate((itemsJson) => {
            localStorage.setItem('cart', itemsJson);
            window.dispatchEvent(new Event('cart-updated'));
        }, JSON.stringify(cartItems));

        await page.reload();
        await page.waitForLoadState('networkidle');
        await dismissCookieBanner(page);

        const proceedBtn = page.locator('button:has-text("Оформити замовлення"), button.cart-btn--primary').first();
        if (await proceedBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await proceedBtn.click();
            await page.waitForTimeout(600);
        }

        await page.fill('#name', 'Софія Мельник');
        await page.fill('#phone', '+380961234567');
        await page.waitForTimeout(300);

        await page.screenshot({ path: path.join(outputDir, '08_checkout_desktop.png'), fullPage: true });
        console.log('Saved 08_checkout_desktop.png');
        await page.close();
    }

    // 4. Mobile - Checkout page
    {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        await page.goto('http://localhost:3000/checkout');
        await page.waitForLoadState('networkidle');
        await dismissCookieBanner(page);

        const cartItems = plainProducts.slice(0, 1).map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            quantity: 1,
            size: 'S',
            color: 'black',
            image: p.image
        }));

        await page.evaluate((itemsJson) => {
            localStorage.setItem('cart', itemsJson);
            window.dispatchEvent(new Event('cart-updated'));
        }, JSON.stringify(cartItems));

        await page.reload();
        await page.waitForLoadState('networkidle');
        await dismissCookieBanner(page);

        const proceedBtn = page.locator('button:has-text("Оформити замовлення"), button.cart-btn--primary').first();
        if (await proceedBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await proceedBtn.click();
            await page.waitForTimeout(600);
        }

        await page.fill('#name', 'Софія Мельник');
        await page.fill('#phone', '+380961234567');
        await page.waitForTimeout(300);

        await page.screenshot({ path: path.join(outputDir, '09_checkout_mobile_hero.png') });
        console.log('Saved 09_checkout_mobile_hero.png');

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(outputDir, '10_checkout_mobile_bottom.png') });
        console.log('Saved 10_checkout_mobile_bottom.png');

        await page.close();
    }

    await browser.close();
    console.log('All screenshots completed successfully!');
}

main().catch(err => {
    console.error('Error in capture:', err);
    process.exit(1);
});
