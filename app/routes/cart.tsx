import { redirect, type LoaderFunctionArgs } from "react-router";

export async function loader({ params }: LoaderFunctionArgs) {
    const lang = params.lang ? `/${params.lang}` : "";
    return redirect(`${lang}/?cart=open`, { status: 302 });
}

export default function CartRedirect() {
    return null;
}
