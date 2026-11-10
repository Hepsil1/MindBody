import { redirect, type LoaderFunctionArgs } from "react-router";

export async function loader({ params }: LoaderFunctionArgs) {
    const lang = params.lang ? `/${params.lang}` : "";
    // 302 (not 301): /shop is a convenience alias, the landing collection may change.
    return redirect(`${lang}/shop/yoga`, { status: 302 });
}

export default function ShopRedirect() {
    return null;
}
