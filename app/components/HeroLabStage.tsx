/**
 * HeroLabStage — experimental hero for /hero-lab: same look as SingleLookHero
 * (stage photo, centre logo, single CTA) but the models themselves are the
 * interaction. Hover/tap a model → her light state appears (concept = `mode`);
 * click (mouse) or a second tap (touch) opens that outfit's product page.
 *
 * Quality rule: light is never faked with CSS blends over the photo. Every
 * light state is a frame pre-rendered with real matting by
 * scratch/build_hero_lab_v2.py (lit / back / aura per model); the page only
 * REVEALS that frame (fade, rising wave, growing circle, scan). Skin, hair and
 * floor are therefore never touched.
 *
 * Image + layers live in one 16:9 "canvas" box sized like object-fit: cover so
 * everything lines up; a "camera" wrapper can push in toward the chosen model.
 * On phones the canvas keeps the 16:9 frame at full height and the view glides
 * from model to model, so duos / groups survive on mobile.
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
    | "cinema"
    | "tag"
    | "floor"
    | "editorial"
    | "cursor"
    | "cta"
    | "signature";

type Frame = "lit" | "back" | "aura";
type Reveal = "fade" | "wave" | "grow" | "scan";
/** how the outfit's name / colour / price is shown while a model is chosen */
type Info = "tag" | "floor" | "editorial" | "cursor" | "cta";

interface FxSet {
    /** which pre-rendered frame this concept shows, and how it is revealed */
    frame?: Frame;
    reveal?: Reveal;
    cam?: boolean;
    dim?: boolean;
    hint?: boolean;
    ripple?: boolean;
    beams?: boolean;
    caption?: boolean;
    auto?: boolean;
    info?: Info;
}

const FX: Record<LabMode, FxSet> = {
    spot: { dim: true },
    rim: { frame: "back", reveal: "fade" },
    fabric: { frame: "back", reveal: "wave", cam: true, hint: true },
    caption: { dim: true, caption: true },
    aura: { frame: "aura", reveal: "grow", cam: true, hint: true },
    ripple: { frame: "lit", reveal: "fade", ripple: true, hint: true },
    scan: { frame: "lit", reveal: "scan", cam: true },
    beams: { frame: "lit", reveal: "fade", dim: true, beams: true },
    cinema: { frame: "aura", reveal: "grow", cam: true, auto: true },
    // --- with minimal info on the chosen model. Deliberately all different:
    //     light effect / info form / typeface / bottom button
    // 11 colour aura      · glass tag above the head    · Manrope caps  · solid teal button
    tag: { frame: "aura", reveal: "grow", hint: true, info: "tag" },
    // 12 white light wave · name printed on the floor   · Spectral italic · underlined text link
    floor: { frame: "back", reveal: "wave", hint: true, info: "floor" },
    // 13 spotlight (rest goes dark) · giant word behind her · Onest 800 · glass outline button
    editorial: { frame: "lit", reveal: "fade", dim: true, info: "editorial" },
    // 14 floor ripples    · round price disc on the cursor · numerals-first · white button
    cursor: { frame: "lit", reveal: "fade", ripple: true, cam: true, hint: true, info: "cursor" },
    // 15 scan line        · the button itself becomes the outfit
    cta: { frame: "lit", reveal: "scan", cam: true, hint: true, info: "cta" },
    // THE PICK (/hero-lab/best): the stage directs itself — each model in turn gets
    // her colour aura and a gentle push-in while the one button becomes her outfit.
    // Nothing is added to the slide; works with no hover at all (phones).
    signature: { frame: "aura", reveal: "grow", cam: true, auto: true, info: "cta" },
};

export interface LabModel {
    href: string;
    /** short outfit name, e.g. "WINGS" */
    title: string;
    /** second line: colour · price (or a short descriptor) */
    sub: string;
    cx: number;
    head: number;
    feet: number;
    /** false when the slide has no real product behind it: the button then keeps
     *  its generic label instead of advertising a name/price that leads nowhere */
    linked?: boolean;
}

interface Props {
    image: string;
    maskDir: string;
    models: LabModel[];
    mode: LabMode;
    studioBg?: string;
    /** ms each model gets in the self-running loop */
    slot?: number;
    /** called once every model has had her turn (slideshow advances) */
    onDone?: () => void;
    /** load the light frames right away (slideshow) instead of lazily */
    eager?: boolean;
}

/** Round price badge: the price is the hero, name above, colour below. */
function Disc({ title, sub }: { title: string; sub: string }) {
    const parts = sub.split(" · ").filter(Boolean);
    const main = parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? "");
    const minor = parts.length > 1 ? parts.slice(0, -1).join(" · ") : "";
    return (
        <span className="hlab__disc">
            <b>{title}</b>
            <strong>{main}</strong>
            {minor && <i>{minor}</i>}
        </span>
    );
}

const CAM_SCALE = 1.08;
/** one model's turn in the self-running loop */
const SLOT = 5400;
/** the lit part of a slot, as fractions of it */
const SHOW_FROM = 0.24;
const SHOW_TO = 0.83;
const USER_HOLD = 8000;

export default function HeroLabStage({
    image,
    maskDir,
    models,
    mode,
    studioBg,
    slot = SLOT,
    onDone,
    eager,
}: Props) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const camRef = useRef<HTMLDivElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const leaveTimer = useRef<number | undefined>(undefined);
    const overCta = useRef(false);
    const onDoneRef = useRef(onDone);
    useEffect(() => {
        onDoneRef.current = onDone;
    }, [onDone]);
    const hitRef = useRef<ImageData | null>(null);
    const userAt = useRef(-Infinity);
    const activeRef = useRef<number | null>(null);
    const [active, setActive] = useState<number | null>(null);
    const [focus, setFocus] = useState(0);
    const [view, setView] = useState(0);
    const [pulse, setPulse] = useState(0);
    const [held, setHeld] = useState(false);
    const fx = FX[mode];
    const count = models.length;

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
        activeRef.current = k;
        setActive(k);
        if (k !== null) {
            setFocus(k);
            setView(k);
            setPulse((p) => p + 1);
        }
    };
    const activate = (k: number | null) => {
        if (k !== activeRef.current) show(k);
    };

    useEffect(() => {
        if (!held) return;
        const id = window.setTimeout(() => setHeld(false), USER_HOLD);
        return () => window.clearTimeout(id);
    }, [held, pulse]);

    // Self-running loop. Phone view glides from model to model in every concept;
    // in "cinema" the stage also lights each model in turn. Real interaction
    // takes over for USER_HOLD ms.
    useEffect(() => {
        const TICK = 150;
        // own clock: it only runs while the visitor isn't holding the stage
        let ph = 0;
        let done = false;
        const id = window.setInterval(() => {
            if (overCta.current || performance.now() - userAt.current < USER_HOLD) return;
            ph += TICK;
            const idx = Math.floor(ph / slot) % count;
            if (fx.auto) {
                // every model has had her turn (+ time for the camera to settle)
                if (!done && onDoneRef.current && ph >= count * slot + 500) {
                    done = true;
                    onDoneRef.current();
                    return;
                }
                if (done) return;
                const within = ph % slot;
                const k = within >= slot * SHOW_FROM && within < slot * SHOW_TO ? idx : null;
                setView(idx);
                if (k !== activeRef.current) show(k);
            } else if (activeRef.current === null) {
                setView(idx);
            }
        }, TICK);
        return () => window.clearInterval(id);
    }, [fx.auto, count, slot]);

    const modelAt = (clientX: number, clientY: number): number | null => {
        const box = camRef.current?.getBoundingClientRect();
        const hit = hitRef.current;
        if (!box || !hit) return null;
        const x = Math.floor(((clientX - box.left) / box.width) * hit.width);
        const y = Math.floor(((clientY - box.top) / box.height) * hit.height);
        if (x < 0 || y < 0 || x >= hit.width || y >= hit.height) return null;
        const k = Math.round(hit.data[(y * hit.width + x) * 4] / 50) - 1;
        return k >= 0 && k < count ? k : null;
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        window.clearTimeout(leaveTimer.current);
        const k = modelAt(e.clientX, e.clientY);
        if (fx.info === "cursor" && cursorRef.current && sectionRef.current) {
            const box = sectionRef.current.getBoundingClientRect();
            cursorRef.current.style.transform = `translate(${e.clientX - box.left}px, ${e.clientY - box.top}px)`;
        }
        if (fx.auto) {
            // in cinema only a model under the cursor takes over
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
        if (touch && activeRef.current !== k) return activate(k);
        navigate(models[k].href);
    };

    const fm = models[focus] ?? models[0];
    const vm = models[view] ?? models[0];
    const mask = (name: string, k: number) => ({
        ["--mask" as string]: `url(${maskDir}/${name}${k}.png)`,
    });

    return (
        <section
            ref={sectionRef}
            className={`slook hlab hlab--${mode} ${active !== null ? "has-active" : ""} ${held ? "is-held" : ""}`}
            aria-label={t("Вітрина бренду MIND BODY")}
        >
            <div className="hlab__stage" style={{ backgroundColor: studioBg || "#dedad4" }}>
                <div className="hlab__canvas" style={{ ["--vx" as string]: vm.cx }}>
                    <div
                        ref={camRef}
                        className="hlab__cam"
                        style={{
                            ["--fx" as string]: fm.cx,
                            ["--fy" as string]: (fm.head + fm.feet) / 2,
                            ["--s" as string]: fx.cam && active !== null ? CAM_SCALE : 1,
                            cursor:
                                active === null
                                    ? undefined
                                    : fx.info === "cursor"
                                      ? "none"
                                      : "pointer",
                        }}
                        onPointerMove={onPointerMove}
                        onPointerLeave={(e) => {
                            if (e.pointerType !== "mouse" || fx.auto) return;
                            // "cta": give the cursor time to travel to the button
                            if (fx.info === "cta") {
                                leaveTimer.current = window.setTimeout(() => activate(null), 900);
                            } else activate(null);
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
                                        ["--k" as string]: k,
                                        ["--n" as string]: count,
                                    }}
                                >
                                    {fx.frame && (
                                        <img
                                            src={`${maskDir}/${fx.frame}${k}.webp`}
                                            alt=""
                                            loading={eager ? "eager" : "lazy"}
                                            decoding="async"
                                            className={`hlab__frame hlab__frame--${fx.reveal} ${fx.hint ? "has-hint" : ""}`}
                                        />
                                    )}
                                    {fx.dim && <div className="hlab__dim" style={mask("inv", k)} />}
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
                                    {fx.reveal === "wave" && (
                                        <div
                                            key={`w${run}`}
                                            className="hlab__wave"
                                            style={mask("g", k)}
                                        />
                                    )}
                                    {fx.reveal === "scan" && (
                                        <div
                                            key={`l${run}`}
                                            className="hlab__scanline"
                                            style={mask("g", k)}
                                        />
                                    )}
                                    {fx.info === "editorial" && (
                                        <div
                                            className="hlab__word"
                                            style={{
                                                ["--mask" as string]: `url(${maskDir}/outall.png)`,
                                                ["--len" as string]: Math.max(m.title.length, 4),
                                            }}
                                        >
                                            <span>
                                                <b>{m.title}</b>
                                                <i>
                                                    {m.sub.split(" · ").map((part) => (
                                                        <u key={part}>{part}</u>
                                                    ))}
                                                </i>
                                            </span>
                                        </div>
                                    )}
                                    {fx.info === "floor" && (
                                        <div className="hlab__info hlab__floor">
                                            <b>
                                                {m.title.charAt(0) + m.title.slice(1).toLowerCase()}
                                            </b>
                                            <i>{m.sub}</i>
                                        </div>
                                    )}
                                    {fx.info === "tag" && (
                                        <div className="hlab__info hlab__tag">
                                            <span className="hlab__pill">
                                                <b>{m.title}</b>
                                                <i>{m.sub}</i>
                                            </span>
                                            <span className="hlab__stem" />
                                        </div>
                                    )}
                                    {fx.info === "cursor" && (
                                        <div className="hlab__info hlab__disc-touch">
                                            <Disc title={m.title} sub={m.sub} />
                                        </div>
                                    )}
                                    {fx.caption && (
                                        <div
                                            className="hlab__caption"
                                            style={{ left: `${m.cx * 100}%` }}
                                        >
                                            {m.title} · {m.sub}
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
                        {m.title} · {m.sub}
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

            {fx.info === "cursor" && (
                <div ref={cursorRef} className="hlab__cursor" aria-hidden="true">
                    <Disc title={fm.title} sub={fm.sub} />
                </div>
            )}

            <div className="slook__overlay">
                <div className="slook__info slook__info--centered">
                    {fx.info === "cta" ? (
                        <LLink
                            to={active !== null && fm.linked !== false ? fm.href : "/shop/yoga"}
                            className={`slook__cta-btn slook__cta-btn--centered hlab__cta ${active !== null && fm.linked !== false ? "is-product" : ""}`}
                            onPointerEnter={(e) => {
                                window.clearTimeout(leaveTimer.current);
                                // the button must not change under the cursor
                                if (e.pointerType === "mouse") overCta.current = true;
                            }}
                            onPointerLeave={(e) => {
                                overCta.current = false;
                                if (e.pointerType === "mouse" && !fx.auto) activate(null);
                            }}
                        >
                            <span className="hlab__cta-a">{t("Переглянути колекцію")}</span>
                            <span className="hlab__cta-b">
                                <b>{fm.title}</b>
                                <i>{fm.sub}</i>
                                <em>→</em>
                            </span>
                        </LLink>
                    ) : (
                        <LLink
                            to="/shop/yoga"
                            className="slook__cta-btn slook__cta-btn--centered hlab__btn"
                        >
                            <span>{t("Переглянути колекцію")}</span>
                        </LLink>
                    )}
                </div>
            </div>
        </section>
    );
}
