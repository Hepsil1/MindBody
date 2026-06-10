import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

/**
 * Storefront ↔ visual-editor bridge (client-safe, imported by BOTH sides).
 *
 * The editor (/admin/slides) previews real storefront pages in an iframe with
 * `?editor=1` appended. A page is "in editor mode" only when BOTH hold:
 *   1. the URL carries ?editor=1 (read client-side via useSearchParams — never
 *      in loaders, so server caches don't fragment by the param), and
 *   2. it actually runs inside an iframe (window.parent !== window, checked
 *      post-mount so SSR and the first client render agree — the proven
 *      hydration-safe pattern from shop.$category).
 * A visitor who types ?editor=1 into the address bar gets condition 2 false →
 * no affordances. A hostile same-origin iframe can at most send a postMessage
 * that the editor validates against whitelists before acting on.
 *
 * Messages flow storefront → editor only; the editor reloads the iframe via
 * its key (previewNonce) rather than messaging back.
 */

export const EDITOR_QUERY_PARAM = "editor";

/** Settings sub-sections an in-iframe affordance can deep-link to. */
export type EditorSettingsSection =
    | "contacts"
    | "features"
    | "stats"
    | "brandWorld"
    | "navFeatured";
export const EDITOR_SETTINGS_SECTIONS: EditorSettingsSection[] = [
    "contacts",
    "features",
    "stats",
    "brandWorld",
    "navFeatured",
];

export type EditorBridgeMessage =
    | { type: "OPEN_SHOP_BG_EDITOR"; category: string }
    | { type: "OPEN_HOME_SLIDES_EDITOR" }
    | { type: "OPEN_HOME_CATEGORIES_EDITOR" }
    | { type: "OPEN_SETTINGS_SECTION"; section: EditorSettingsSection };

/** True only inside the visual editor's preview iframe (see module doc). */
export function useEditorMode(): boolean {
    const [framed, setFramed] = useState(false);
    const [searchParams] = useSearchParams();
    useEffect(() => {
        setFramed(window.parent !== window);
    }, []);
    return framed && searchParams.get(EDITOR_QUERY_PARAM) === "1";
}

/** Post a bridge message to the parent editor (same-origin only). */
export function postToEditor(message: EditorBridgeMessage): void {
    window.parent.postMessage(message, window.location.origin);
}
