import { redirect, type LoaderFunctionArgs } from "react-router";

export async function loader({ params }: LoaderFunctionArgs) {
    const lang = params.lang ? `/${params.lang}` : "";
    return redirect(`${lang}/shop/women`, { status: 301 });
}

export default function ShopRedirect() {
    return null;
}
