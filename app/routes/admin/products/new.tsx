// Re-export the same component for creating new products. `links` must be
// re-exported too, else /admin/products/new loses the stylesheet that $id
// loads via its links() export (the styles used to be an inline <style>).
export { default, loader, action, ErrorBoundary, links } from "./$id";
