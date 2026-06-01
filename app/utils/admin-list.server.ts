// URL-driven list queries for admin tables.
//
// Why: every admin list (products, orders, customers, promo, reviews) loaded
// ALL rows with a bare findMany — no search, filter, sort, or pagination. This
// helper turns the request's searchParams into a Prisma where/orderBy/skip/take
// from a small declarative spec, so each route gets shareable/bookmarkable
// filtered views (the idiomatic React Router pattern: read searchParams in the
// loader, derive UI state from the returned `state` rather than local state).
//
// Security: searchable fields, sortable columns, and filter values are all
// WHITELISTED in the spec, so a malformed/hostile param degrades to defaults and
// can never inject arbitrary keys into the Prisma `where`.

export type SortDir = "asc" | "desc";

export interface FilterSpec {
    /** searchParam key, e.g. "status" */
    param: string;
    /** Prisma field to filter on; defaults to `param`. */
    field?: string;
    /** Allowed values — anything else is ignored (keeps junk out of `where`). */
    allowed?: readonly string[];
    /** "equals" (default) compares as-is; "boolean" coerces "true"/"false". */
    kind?: "equals" | "boolean";
}

export interface ListSpec {
    /** Fields OR-searched by `q` (case-insensitive contains). */
    searchFields?: readonly string[];
    /** Map of sort key → Prisma orderBy field. A whitelist. */
    sortable?: Record<string, string>;
    defaultSort?: { field: string; dir: SortDir };
    filters?: readonly FilterSpec[];
    perPageDefault?: number;
    perPageMax?: number;
}

export interface ListState {
    q: string;
    sort: string;
    dir: SortDir;
    page: number;
    perPage: number;
    filters: Record<string, string>;
}

export interface ListQuery<TWhere> {
    where: TWhere;
    orderBy: Record<string, SortDir>;
    skip: number;
    take: number;
    /** Normalized request state — the single source the UI renders from. */
    state: ListState;
}

export function buildListQuery<TWhere>(request: Request, spec: ListSpec): ListQuery<TWhere> {
    const sp = new URL(request.url).searchParams;

    const q = (sp.get("q") ?? "").trim();
    const perPageDefault = spec.perPageDefault ?? 25;
    const perPageMax = spec.perPageMax ?? 100;
    const perPage = clampInt(sp.get("perPage"), perPageDefault, 1, perPageMax);
    const page = clampInt(sp.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);

    // Sort: never trust the raw param — resolve it through the whitelist.
    const defaultField = spec.defaultSort?.field ?? "createdAt";
    const sortKey = sp.get("sort") ?? defaultField;
    const sortField = spec.sortable?.[sortKey] ?? defaultField;
    const defaultDir: SortDir = spec.defaultSort?.dir ?? "desc";
    const dirParam = sp.get("dir");
    const dir: SortDir = dirParam === "asc" ? "asc" : dirParam === "desc" ? "desc" : defaultDir;

    const AND: Record<string, unknown>[] = [];

    if (q && spec.searchFields?.length) {
        AND.push({
            OR: spec.searchFields.map((f) => ({ [f]: { contains: q, mode: "insensitive" } })),
        });
    }

    const filters: Record<string, string> = {};
    for (const f of spec.filters ?? []) {
        const raw = sp.get(f.param);
        if (raw === null || raw === "") continue;
        if (f.allowed && !f.allowed.includes(raw)) continue;
        filters[f.param] = raw;
        const field = f.field ?? f.param;
        if (f.kind === "boolean") AND.push({ [field]: raw === "true" });
        else AND.push({ [field]: raw });
    }

    const where = (AND.length ? { AND } : {}) as TWhere;

    return {
        where,
        orderBy: { [sortField]: dir },
        skip: (page - 1) * perPage,
        take: perPage,
        state: { q, sort: sortKey, dir, page, perPage, filters },
    };
}

function clampInt(v: string | null, dflt: number, min: number, max: number): number {
    const n = Number.parseInt(v ?? "", 10);
    if (Number.isNaN(n)) return dflt;
    return Math.min(Math.max(n, min), max);
}

export interface Pagination {
    total: number;
    page: number;
    perPage: number;
    pageCount: number;
    hasPrev: boolean;
    hasNext: boolean;
    /** 1-based index of the first row on this page (0 when empty). */
    from: number;
    /** 1-based index of the last row on this page. */
    to: number;
}

/** Pagination metadata, computed after a `count()`. Clamps page into range. */
export function paginate(total: number, page: number, perPage: number): Pagination {
    const pageCount = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), pageCount);
    return {
        total,
        page: safePage,
        perPage,
        pageCount,
        hasPrev: safePage > 1,
        hasNext: safePage < pageCount,
        from: total === 0 ? 0 : (safePage - 1) * perPage + 1,
        to: Math.min(safePage * perPage, total),
    };
}
