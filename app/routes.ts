import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("shop/:category", "routes/shop.$category.tsx"),
    route("product/:id", "routes/product.$id.tsx"),
    route("wishlist", "routes/wishlist.tsx"),
    route("checkout", "routes/checkout.tsx"),
    route("about", "routes/about.tsx"),
    route("contacts", "routes/contacts.tsx"),
    route("delivery", "routes/delivery.tsx"),
    route("size-guide", "routes/size-guide.tsx"),
    route("profile", "routes/profile.tsx"),
    route("auth", "routes/auth.tsx"),
    route("api/novaposhta", "routes/api.novaposhta.tsx"),
    route("api/register", "routes/api.register.tsx"),
    route("api/orders/create", "routes/api.orders.create.tsx"),
    route("api/orders/list", "routes/api.orders.list.tsx"),
    route("api/telegram/send", "routes/api.telegram.send.tsx"),
    route("api/search", "routes/api.search.tsx"),
    route("api/reviews", "routes/api.reviews.tsx"),
    route("api/contact", "routes/api.contact.tsx"),
    route("api/auth/sync", "routes/api.auth.sync.tsx"),
    route("api/promo", "routes/api/promo.tsx"),
    route("sitemap.xml", "routes/sitemap[.]xml.tsx"),

    // Admin Login & Logout (Separate from layout)
    route("admin/login", "routes/admin/login.tsx"),
    route("admin/logout", "routes/admin/logout.tsx"),

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
        route("admin/shop-pages", "routes/admin/shop-pages.tsx"),
        route("admin/promo", "routes/admin/promo.tsx"),
        route("admin/reviews", "routes/admin/reviews.tsx"),
    ]),
] satisfies RouteConfig;

