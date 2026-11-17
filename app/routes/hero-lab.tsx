/**
 * /hero-lab/:n — experiment sandbox, one hero slide per example, fully
 * separate from /hero-gallery (that page stays the client's untouched
 * review set). Each example picks a base slide + background variant; edits
 * for experiments go here only.
 *   /hero-lab/1   example 1 — two models (DUO CONTRAST, outfit-matched wall)
 * Not linked anywhere; noindex.
 */
import { data, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import SingleLookHero from "../components/SingleLookHero";
import { getHeroLooks } from "../utils/heroLooks.server";

interface LabExample {
    /** master basename in /hero/masters */
    slide: string;
    /** background variant suffix ("" = classic studio grey) */
    variant: "" | "match";
}

const EXAMPLES: Record<string, LabExample> = {
    "1": { slide: "v4_s1_duo", variant: "match" },
};

export function meta() {
    return [{ title: "Hero lab — MIND BODY" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ params }: LoaderFunctionArgs) {
    if (!params.n) throw redirect("/hero-lab/1");
    const ex = EXAMPLES[params.n];
    if (!ex) throw data("Not found", { status: 404 });
    const look = (await getHeroLooks({ includeReview: true })).find(
        (l) => l.imageDesktop === `/hero/masters/${ex.slide}`,
    );
    if (!look) throw data("Not found", { status: 404 });
    const v = ex.variant;
    return {
        n: params.n,
        look: v
            ? {
                  ...look,
                  imageDesktop: `${look.imageDesktop}__${v}`,
                  imageMobile: look.imageMobile.replace(/_mobile$/, `__${v}_mobile`),
              }
            : look,
    };
}

export default function HeroLab() {
    const { look } = useLoaderData<typeof loader>();
    return (
        <main style={{ background: "#f4f1ec" }}>
            <SingleLookHero looks={[look]} />
        </main>
    );
}
