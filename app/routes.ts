import { type RouteConfig, route, layout } from "@react-router/dev/routes";

/**
 * Public storefront routes carry an optional locale prefix (`:lang?`):
 *   /shop/yoga      → Ukrainian (default, no prefix)
 *   /en/shop/yoga   → English   /ru/shop/yoga → Russian
 * Loaders validate the param via localeFromParam() (garbage prefix → 404).
 * /api and /admin are intentionally NOT localized.
 */
export default [
    route(":lang?", "routes/home.tsx"),
    route(":lang?/shop/:category", "routes/shop.$category.tsx"),
    route(":lang?/shop/:category/:subcategory", "routes/shop.$category.$subcategory.tsx"),
    route(":lang?/product/:id", "routes/product.$id.tsx"),
    route(":lang?/p/:slug", "routes/p.$slug.tsx"),
    route(":lang?/wishlist", "routes/wishlist.tsx"),
    route(":lang?/checkout", "routes/checkout.tsx"),
    route(":lang?/about", "routes/about.tsx"),
    route(":lang?/contacts", "routes/contacts.tsx"),
    route(":lang?/delivery", "routes/delivery.tsx"),
    route(":lang?/size-guide", "routes/size-guide.tsx"),
    route(":lang?/privacy", "routes/privacy.tsx"),
    route(":lang?/terms", "routes/terms.tsx"),
    route(":lang?/return-policy", "routes/return-policy.tsx"),
    route(":lang?/faq", "routes/faq.tsx"),
    route(":lang?/care-guide", "routes/care-guide.tsx"),
    route(":lang?/search", "routes/search.tsx"),
    route(":lang?/profile", "routes/profile.tsx"),
    route(":lang?/auth", "routes/auth.tsx"),
    route(":lang?/auth/callback", "routes/auth.callback.tsx"),
    route("api/novaposhta", "routes/api.novaposhta.tsx"),
    route("api/register", "routes/api.register.tsx"),
    route("api/orders/create", "routes/api.orders.create.tsx"),
    route("api/orders/list", "routes/api.orders.list.tsx"),
    route("api/telegram/send", "routes/api.telegram.send.tsx"),
    route("api/search", "routes/api.search.tsx"),
    route("api/products/slugs", "routes/api.products.slugs.tsx"),
    route("api/cart/prices", "routes/api.cart.prices.tsx"),
    route("api/reviews", "routes/api.reviews.tsx"),
    route("api/contact", "routes/api.contact.tsx"),
    route("api/quick-order", "routes/api.quick-order.tsx"),
    route("api/auth/login", "routes/api.auth.login.tsx"),
    route("api/auth/logout", "routes/api.auth.logout.tsx"),
    route("api/auth/change-password", "routes/api.auth.change-password.tsx"),
    route("api/auth/google", "routes/api.auth.google.tsx"),
    route("api/auth/google/callback", "routes/api.auth.google.callback.tsx"),
    route("api/profile", "routes/api.profile.tsx"),
    route("api/promo", "routes/api/promo.tsx"),
    route("api/newsletter", "routes/api.newsletter.tsx"),
    route("api/health", "routes/api.health.tsx"),
    route("api/instagram/refresh", "routes/api.instagram.refresh.tsx"),
    route("sitemap.xml", "routes/sitemap[.]xml.tsx"),

    // Admin Login & Logout (Separate from layout)
    route("admin/login", "routes/admin/login.tsx"),
    route("admin/logout", "routes/admin/logout.tsx"),
    // CSV export — resource route (no component), kept outside the layout so it
    // returns a raw CSV Response instead of being wrapped in the layout HTML.
    route("admin/customers/export", "routes/admin/customers/export.tsx"),
    // Cmd+K palette backend — bare-JSON resource route (admin-guarded).
    route("admin/api/search", "routes/admin/api.search.tsx"),

    // Admin Panel Routes
    layout("routes/admin/_layout.tsx", [
        route("admin", "routes/admin/index.tsx"),
        route("admin/slides", "routes/admin/slides.tsx"),
        route("admin/products", "routes/admin/products/index.tsx"),
        route("admin/products/new", "routes/admin/products/new.tsx"),
        route("admin/products/:id", "routes/admin/products/$id.tsx"),

        // Orders
        route("admin/orders", "routes/admin/orders/index.tsx"),
        route("admin/orders/:id", "routes/admin/orders/$id.tsx"),

        route("admin/customers", "routes/admin/customers/index.tsx"),
        route("admin/customers/:id", "routes/admin/customers/$id.tsx"),
        route("admin/categories", "routes/admin/categories/index.tsx"),
        route("admin/inventory", "routes/admin/inventory.tsx"),
        route("admin/shop-pages", "routes/admin/shop-pages.tsx"),
        route("admin/promo", "routes/admin/promo.tsx"),
        route("admin/reviews", "routes/admin/reviews.tsx"),
    ]),
] satisfies RouteConfig;
