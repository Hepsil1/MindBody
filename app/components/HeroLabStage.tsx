/**
 * HeroLabStage — experimental hero for /hero-lab: same look as SingleLookHero
 * (stage photo, centre logo, single CTA) but the models themselves are the
 * interaction. Hover/tap a model → it lights up (effect set chosen by `mode`);
 * click (mouse) or a second tap (touch) opens that outfit's product page.
 *
 * Image + all effect layers live in one 16:9 "canvas" box sized like
 * object-fit: cover, so the per-model masks (public/hero/lab/<sid>/) line up
 * exactly. Inside it a "camera" wrapper can push in toward the chosen model.
 * On phones the canvas keeps the desktop 16:9 frame at full height and slowly
 * pans between the two models, so the duo survives on mobile.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LLink, useI18n } from "../i18n";
import { buildAvifSrcset, buildWebpSrcset } from "../utils/responsive-image";
import "../styles/single-look.css";
import "../styles/hero-lab.css";

export type LabMode =
    | "spot"
    | "rim"
    | "fabric"
    | "caption"
    | "aura"
    | "ripple"
    | "scan"
    | "beams"
    | "cinema";

interface FxSet {
    cam?: boolean;
    dim?: boolean;
    rim?: boolean;
    glow?: boolean;
    wave?: boolean;
    hint?: boolean;
    aura?: boolean;
    ripple?: boolean;
    scan?: boolean;
    beams?: boolean;
    pool?: boolean;
    caption?: boolean;
    auto?: boolean;
}

/** Which layers each concept uses. */
const FX: Record<LabMode, FxSet> = {
    spot: { dim: true },
    rim: { rim: true },
    fabric: { cam: true, glow: true, wave: true, rim: true, pool: true, hint: true },
    caption: { dim: true, caption: true },
    aura: { cam: true, glow: true, aura: true, hint: true },
    ripple: { glow: true, ripple: true, rim: true, hint: true },
    scan: { cam: true, dim: true, scan: true },
    beams: { dim: true, beams: true, glow: true },
    cinema: { cam: true, glow: true, wave: true, aura: true, auto: true },
};

export interface LabModel {
    href: string;
    caption: string;
    cx: number;
    head: number;
    feet: number;
    /** saturated garment colour for coloured light (aura) */
    tone: string;
}

interface Props {
    image: string;
    maskDir: string;
    models: LabModel[];
    mode: LabMode;
    studioBg?: string;
}

const CAM_SCALE = 1.08;
/** auto-play timeline (ms in a 16 s loop, synced with the phone pan) */
const AUTO_LOOP = 16000;
const AUTO_STEPS: Array<[number, number, number]> = [
    [700, 4300, 0],
    [8700, 12300, 1],
];
const USER_HOLD = 8000;

export default function HeroLabStage({ image, maskDir, models, mode, studioBg }: Props) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const camRef = useRef<HTMLDivElement>(null);
    const hitRef = useRef<ImageData | null>(null);
    const userAt = useRef(-Infinity);
    const [active, setActive] = useState<number | null>(null);
    const [focus, setFocus] = useState(0);
    const [pulse, setPulse] = useState(0);
    // a real tap/click "holds" the stage: the phone pan stops on that model
    const [held, setHeld] = useState(false);
    const fx = FX[mode];

    useEffect(() => {
        if (!held) return;
        const id = window.setTimeout(() => setHeld(false), USER_HOLD);
        return () => window.clearTimeout(id);
    }, [held, pulse]);

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

    const show = (k: number | null) => {
        setActive(k);
        if (k !== null) {
            setFocus(k);
            setPulse((p) => p + 1);
        }
    };
    const activate = (k: number | null) => {
        if (k !== active) show(k);
    };

    // "Cinema": the slide directs itself — each model gets its moment in turn.
    // Any real interaction takes over for USER_HOLD ms.
    useEffect(() => {
        if (!fx.auto) return;
        const t0 = performance.now();
        let last: number | null | undefined;
        const id = window.setInterval(() => {
            if (performance.now() - userAt.current < USER_HOLD) return;
            const ph = (performance.now() - t0) % AUTO_LOOP;
            const step = AUTO_STEPS.find(([a, b]) => ph >= a && ph < b);
            const k = step ? step[2] : null;
            if (k !== last) {
                last = k;
                show(k);
            }
        }, 120);
        return () => window.clearInterval(id);
    }, [fx.auto]);

    const modelAt = (clientX: number, clientY: number): number | null => {
        const box = camRef.current?.getBoundingClientRect();
        const hit = hitRef.current;
        if (!box || !hit) return null;
        const x = Math.floor(((clientX - box.left) / box.width) * hit.width);
        const y = Math.floor(((clientY - box.top) / box.height) * hit.height);
        if (x < 0 || y < 0 || x >= hit.width || y >= hit.height) return null;
        const o = (y * hit.width + x) * 4;
        for (let k = 0; k < Math.min(models.length, 3); k++) if (hit.data[o + k] > 127) return k;
        return null;
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const k = modelAt(e.clientX, e.clientY);
        if (fx.auto) {
            // in cinema mode only a model under the cursor takes over
            if (k === null) return;
            userAt.current = performance.now();
        }
        activate(k);
    };

    const onClick = (e: React.MouseEvent) => {
        userAt.current = performance.now();
        setHeld(true);
        const k = modelAt(e.clientX, e.clientY);
        const touch =
            (e.nativeEvent as PointerEvent).pointerType === "touch" ||
            !matchMedia("(hover: hover)").matches;
        if (k === null) return activate(null);
        if (touch && active !== k) return activate(k);
        navigate(models[k].href);
    };

    const fm = models[focus] ?? models[0];
    const mask = (name: string, k: number) => ({
        ["--mask" as string]: `url(${maskDir}/${name}${k}.png)`,
    });

    return (
        <section
            className={`slook hlab hlab--${mode} ${active !== null ? "has-active" : ""} ${held ? "is-held" : ""}`}
            aria-label={t("Вітрина бренду MIND BODY")}
        >
            <div className="hlab__stage" style={{ backgroundColor: studioBg || "#dedad4" }}>
                <div
                    className="hlab__canvas"
                    style={{
                        ["--p0" as string]: `${-(models[0]?.cx ?? 0.5) * 100}%`,
                        ["--p1" as string]: `${-(models[models.length - 1]?.cx ?? 0.5) * 100}%`,
                    }}
                >
                    <div
                        ref={camRef}
                        className="hlab__cam"
                        style={{
                            ["--fx" as string]: fm.cx,
                            ["--fy" as string]: (fm.head + fm.feet) / 2,
                            ["--s" as string]: fx.cam && active !== null ? CAM_SCALE : 1,
                            cursor: active !== null ? "pointer" : undefined,
                        }}
                        onPointerMove={onPointerMove}
                        onPointerLeave={(e) => {
                            if (e.pointerType === "mouse" && !fx.auto) activate(null);
                        }}
                        onClick={onClick}
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
                        {models.map((m, k) => {
                            const on = active === k;
                            const run = on ? pulse : "idle";
                            return (
                                <div
                                    key={k}
                                    className={`hlab__fx ${on ? "is-on" : ""}`}
                                    style={{
                                        ["--cx" as string]: `${m.cx * 100}%`,
                                        ["--head" as string]: `${m.head * 100}%`,
                                        ["--feet" as string]: `${m.feet * 100}%`,
                                        ["--tone" as string]: m.tone,
                                        ["--k" as string]: k,
                                    }}
                                >
                                    {fx.aura && (
                                        <div className="hlab__aura" style={mask("aura", k)} />
                                    )}
                                    {fx.dim && <div className="hlab__dim" style={mask("inv", k)} />}
                                    {fx.rim && <div className="hlab__rim" style={mask("rim", k)} />}
                                    {fx.pool && <span className="hlab__pool hlab__pool--solo" />}
                                    {fx.beams && (
                                        <div className="hlab__beams" style={mask("out", k)}>
                                            <span className="hlab__beam hlab__beam--a" />
                                            <span className="hlab__beam hlab__beam--b" />
                                            <span className="hlab__pool" />
                                        </div>
                                    )}
                                    {fx.ripple && (
                                        <div
                                            key={`r${run}`}
                                            className="hlab__ripples"
                                            style={mask("out", k)}
                                        >
                                            <span />
                                            <span />
                                            <span />
                                        </div>
                                    )}
                                    {fx.hint && <div className="hlab__hint" style={mask("g", k)} />}
                                    {fx.glow && <div className="hlab__glow" style={mask("g", k)} />}
                                    {fx.wave && (
                                        <div
                                            key={`w${run}`}
                                            className="hlab__wave"
                                            style={mask("g", k)}
                                        />
                                    )}
                                    {fx.scan && (
                                        <>
                                            <div
                                                key={`s${run}`}
                                                className="hlab__scanlit"
                                                style={mask("g", k)}
                                            />
                                            <div
                                                key={`l${run}`}
                                                className="hlab__scanline"
                                                style={mask("m", k)}
                                            />
                                        </>
                                    )}
                                    {fx.caption && (
                                        <div
                                            className="hlab__caption"
                                            style={{ left: `${m.cx * 100}%` }}
                                        >
                                            {m.caption}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
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
