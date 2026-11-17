/**
 * HeroLabStage — experimental hero for /hero-lab: same look as SingleLookHero
 * (stage photo, centre logo, single CTA) but the models themselves are the
 * interaction. Hover/tap a model → it lights up (effect chosen by `mode`);
 * click (mouse) or a second tap (touch) opens that outfit's product page.
 *
 * Image + all effect layers live in one 16:9 "canvas" box sized like
 * object-fit: cover, so the per-model masks (public/hero/lab/<sid>/) line up
 * exactly. On phones the canvas keeps the desktop 16:9 frame at full height
 * and slowly pans between the two models, so the duo survives on mobile.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LLink, useI18n } from "../i18n";
import { buildAvifSrcset, buildWebpSrcset } from "../utils/responsive-image";
import "../styles/single-look.css";
import "../styles/hero-lab.css";

export type LabMode = "spot" | "rim" | "fabric" | "caption";

export interface LabModel {
    href: string;
    caption: string;
    cx: number;
    head: number;
    feet: number;
}

interface Props {
    image: string;
    maskDir: string;
    models: LabModel[];
    mode: LabMode;
    studioBg?: string;
}

export default function HeroLabStage({ image, maskDir, models, mode, studioBg }: Props) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLDivElement>(null);
    const hitRef = useRef<ImageData | null>(null);
    const [active, setActive] = useState<number | null>(null);
    const [pulse, setPulse] = useState(0);

    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const ctx = c.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(img, 0, 0);
            hitRef.current = ctx.getImageData(0, 0, c.width, c.height);
        };
        img.src = `${maskDir}/hit.png`;
    }, [maskDir]);

    const modelAt = (clientX: number, clientY: number): number | null => {
        const box = canvasRef.current?.getBoundingClientRect();
        const hit = hitRef.current;
        if (!box || !hit) return null;
        const x = Math.floor(((clientX - box.left) / box.width) * hit.width);
        const y = Math.floor(((clientY - box.top) / box.height) * hit.height);
        if (x < 0 || y < 0 || x >= hit.width || y >= hit.height) return null;
        const o = (y * hit.width + x) * 4;
        for (let k = 0; k < Math.min(models.length, 3); k++) if (hit.data[o + k] > 127) return k;
        return null;
    };

    const activate = (k: number | null) => {
        if (k === active) return;
        setActive(k);
        if (k !== null) setPulse((p) => p + 1);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        activate(modelAt(e.clientX, e.clientY));
    };

    const onClick = (e: React.MouseEvent) => {
        const k = modelAt(e.clientX, e.clientY);
        const touch =
            (e.nativeEvent as PointerEvent).pointerType === "touch" ||
            !matchMedia("(hover: hover)").matches;
        if (k === null) return activate(null);
        if (touch && active !== k) return activate(k);
        navigate(models[k].href);
    };

    return (
        <section
            className={`slook hlab hlab--${mode} ${active !== null ? "has-active" : ""}`}
            aria-label={t("Вітрина бренду MIND BODY")}
        >
            <div className="hlab__stage" style={{ backgroundColor: studioBg || "#dedad4" }}>
                <div
                    ref={canvasRef}
                    className="hlab__canvas"
                    data-active={active ?? undefined}
                    onPointerMove={onPointerMove}
                    onPointerLeave={(e) => e.pointerType === "mouse" && activate(null)}
                    onClick={onClick}
                    style={{
                        cursor: active !== null ? "pointer" : undefined,
                        ["--p0" as string]: `${-(models[0]?.cx ?? 0.5) * 100}%`,
                        ["--p1" as string]: `${-(models[models.length - 1]?.cx ?? 0.5) * 100}%`,
                    }}
                >
                    <picture>
                        <source
                            type="image/avif"
                            srcSet={buildAvifSrcset(image)}
                            sizes="(max-width: 768px) 300vw, 100vw"
                        />
                        <source
                            type="image/webp"
                            srcSet={buildWebpSrcset(image)}
                            sizes="(max-width: 768px) 300vw, 100vw"
                        />
                        <img
                            src={`${image}.webp`}
                            alt=""
                            className="hlab__img"
                            fetchPriority="high"
                            decoding="async"
                        />
                    </picture>
                    {models.map((m, k) => (
                        <div
                            key={k}
                            className={`hlab__fx ${active === k ? "is-on" : ""}`}
                            style={{ ["--cx" as string]: `${m.cx * 100}%` }}
                        >
                            {(mode === "spot" || mode === "caption") && (
                                <div
                                    className="hlab__dim"
                                    style={{ ["--mask" as string]: `url(${maskDir}/inv${k}.png)` }}
                                />
                            )}
                            {mode === "rim" && (
                                <div
                                    className="hlab__rim"
                                    style={{ ["--mask" as string]: `url(${maskDir}/rim${k}.png)` }}
                                />
                            )}
                            {mode === "fabric" && (
                                <div
                                    key={active === k ? pulse : "idle"}
                                    className="hlab__sheen"
                                    style={{ ["--mask" as string]: `url(${maskDir}/g${k}.png)` }}
                                />
                            )}
                            {mode === "caption" && (
                                <div
                                    className="hlab__caption"
                                    style={{
                                        left: `${m.cx * 100}%`,
                                        ["--feet" as string]: `${m.feet * 100}%`,
                                        ["--head" as string]: `${m.head * 100}%`,
                                    }}
                                >
                                    {m.caption}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* a11y: the models are links for keyboard / screen readers too */}
            <nav className="hlab__sr">
                {models.map((m, k) => (
                    <LLink
                        key={k}
                        to={m.href}
                        onFocus={() => activate(k)}
                        onBlur={() => activate(null)}
                    >
                        {m.caption}
                    </LLink>
                ))}
            </nav>

            <div className="slook__center-brand" aria-hidden="true">
                <picture>
                    <source srcSet="/pics/mind_body_logo_white.webp" type="image/webp" />
                    <img
                        src="/pics/mind_body_logo_white.png"
                        alt=""
                        className="slook__center-logo"
                        width="280"
                        height="212"
                        decoding="async"
                    />
                </picture>
            </div>

            <div className="slook__overlay">
                <div className="slook__info slook__info--centered">
                    <LLink to="/shop/yoga" className="slook__cta-btn slook__cta-btn--centered">
                        {t("Переглянути колекцію")}
                    </LLink>
                </div>
            </div>
        </section>
    );
}
