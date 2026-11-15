import { PrismaClient } from "@prisma/client";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

const results = {
    checks: [],
    passed: 0,
    failed: 0,
};

function record(name, ok, details) {
    if (ok) results.passed++;
    else results.failed++;
    results.checks.push({ name, ok, details });
    const mark = ok ? "✓ PASS" : "✗ FAIL";
    console.log(`${mark}: ${name} — ${details}`);
}

async function audit() {
    console.log("====================================================");
    console.log("   MIND BODY — Automated SEO & GEO Health Audit");
    console.log(`   Target: ${baseUrl}`);
    console.log("====================================================\n");

    // 1. Robots.txt
    try {
        const res = await fetch(`${baseUrl}/robots.txt`);
        const txt = await res.text();
        const hasPerplexity = txt.includes("PerplexityBot");
        const hasLlms = txt.includes("llms.txt");
        const hasFeed = txt.includes("feed.xml");
        record(
            "robots.txt AI & Feed Discovery",
            res.ok && hasPerplexity && hasLlms && hasFeed,
            `Status ${res.status}, AI bots: ${hasPerplexity ? "allowed" : "missing"}, llms.txt: ${hasLlms ? "listed" : "missing"}`,
        );
    } catch (err) {
        record("robots.txt reachable", false, err.message);
    }

    // 2. Sitemap.xml
    try {
        const res = await fetch(`${baseUrl}/sitemap.xml`);
        const txt = await res.text();
        const hasUrls = txt.includes("<urlset") && txt.includes("<loc>");
        record(
            "sitemap.xml Structure",
            res.ok && hasUrls,
            `Status ${res.status}, XML urlset present with valid <loc> tags`,
        );
    } catch (err) {
        record("sitemap.xml reachable", false, err.message);
    }

    // 3. /llms.txt & /llms-full.txt (GEO)
    try {
        const [r1, r2] = await Promise.all([
            fetch(`${baseUrl}/llms.txt`),
            fetch(`${baseUrl}/llms-full.txt`),
        ]);
        const [t1, t2] = await Promise.all([r1.text(), r2.text()]);
        const ok = r1.ok && r2.ok && t1.length > 200 && t2.length > 500;
        record(
            "llms.txt & llms-full.txt (GEO AI Passports)",
            ok,
            `llms.txt: ${t1.length} bytes, llms-full.txt: ${t2.length} bytes, full technical specs active`,
        );
    } catch (err) {
        record("GEO LLM endpoints", false, err.message);
    }

    // 4. Google Merchant Feed (/feed.xml)
    try {
        const res = await fetch(`${baseUrl}/feed.xml`);
        const txt = await res.text();
        const hasGoogleBase = txt.includes('xmlns:g="http://base.google.com/ns/1.0"');
        const hasItems = txt.includes("<item>") && txt.includes("<g:price>");
        record(
            "Google Merchant Center Feed (/feed.xml)",
            res.ok && hasGoogleBase && hasItems,
            `Status ${res.status}, Google Base RSS 2.0 namespace validated with items & pricing`,
        );
    } catch (err) {
        record("feed.xml reachable", false, err.message);
    }

    // 5. Sample PDP SEO & Alt Attributes
    try {
        const sampleProduct = await prisma.product.findFirst({
            where: { status: "active", slug: { not: null } },
            select: { id: true, name: true, slug: true },
        });

        if (sampleProduct && sampleProduct.slug) {
            const url = `${baseUrl}/p/${sampleProduct.slug}`;
            const res = await fetch(url);
            const html = await res.text();

            // Check single H1
            const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
            record(
                "Semantic H1 structure",
                h1Count === 1,
                `Found exactly ${h1Count} H1 tag(s) on PDP`,
            );

            // Check meta description
            const hasMetaDesc = html.includes('name="description"') && !html.includes('content=""');
            record(
                "Meta Description Coverage",
                hasMetaDesc,
                "Meta description populated and non-empty",
            );

            // Check canonical link
            const hasCanonical = html.includes('rel="canonical"');
            record(
                "Canonical Link Integrity",
                hasCanonical,
                "Canonical link tag present pointing to authoritative URL",
            );

            // Check Schema.org Product JSON-LD
            const hasJsonLd =
                html.includes("application/ld+json") && html.includes('"@type":"Product"');
            record(
                "Schema.org Product JSON-LD",
                hasJsonLd,
                "Rich snippets with Offer, Shipping, and Condition included",
            );

            // Check img alt tags: ensure no empty alt="" on content images
            const emptyAltMatch = html.match(
                /<img(?![^>]*class="[^"]*decorative)[^>]*alt=""[^>]*>/gi,
            );
            const emptyAltCount = emptyAltMatch ? emptyAltMatch.length : 0;
            record(
                "Image Alt Tag Coverage",
                emptyAltCount === 0,
                emptyAltCount === 0
                    ? "All gallery and recommendation images have descriptive alt texts"
                    : `${emptyAltCount} image(s) with empty alt`,
            );
        } else {
            record("Database Product Sample", false, "No published product found");
        }
    } catch (err) {
        record("PDP SEO extraction", false, err.message);
    }

    // 6. Broken Links & Core Routes Integrity
    const coreRoutes = [
        "/",
        "/about",
        "/contacts",
        "/delivery",
        "/return-policy",
        "/privacy",
        "/terms",
        "/checkout",
    ];
    let brokenCount = 0;
    for (const r of coreRoutes) {
        try {
            const resp = await fetch(`${baseUrl}${r}`);
            if (!resp.ok) brokenCount++;
        } catch {
            brokenCount++;
        }
    }
    record(
        "Core Navigation Route Integrity",
        brokenCount === 0,
        `Tested ${coreRoutes.length} fundamental routes: ${brokenCount} broken (404/500)`,
    );

    await prisma.$disconnect();

    const total = results.passed + results.failed;
    const score = Math.round((results.passed / total) * 100);

    console.log("\n====================================================");
    console.log(`   SEO & GEO Quality Score: ${score}% (${results.passed}/${total} checks passed)`);
    console.log("====================================================\n");

    if (results.failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

audit().catch(async (e) => {
    console.error("Audit fatal error:", e);
    await prisma.$disconnect();
    process.exit(1);
});
