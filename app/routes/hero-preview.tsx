/**
 * /hero-preview — Visual Hero Concepts Gallery
 * Open at http://localhost:3000/hero-preview
 * Shows 3 live interactive hero concepts with real brand photos.
 * NOT linked in the main nav — preview only.
 */
export default function HeroPreview() {
    return (
        <div
            style={{ background: "#0B0B0C", minHeight: "100vh", fontFamily: "'Onest', sans-serif" }}
        >
            {/* ---- CONCEPT A: CINEMATIC FULL-BLEED + PARALLAX TEXT ---- */}
            <section
                id="concept-a"
                style={{
                    position: "relative",
                    height: "100vh",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "flex-end",
                }}
            >
                {/* BG Image */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: "url('/hero/fable-s3-black-2560w.jpg')",
                        backgroundSize: "cover",
                        backgroundPosition: "50% 20%",
                        transform: "scale(1.05)",
                        animation: "heroZoom 12s ease-in-out infinite alternate",
                    }}
                />
                {/* Gradient overlay */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(to top, rgba(11,11,12,0.92) 0%, rgba(11,11,12,0.3) 50%, rgba(11,11,12,0.1) 100%)",
                    }}
                />
                {/* Giant ghost lettering */}
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        fontSize: "clamp(100px, 20vw, 240px)",
                        fontWeight: 800,
                        letterSpacing: "-0.04em",
                        color: "rgba(255,255,255,0.04)",
                        whiteSpace: "nowrap",
                        userSelect: "none",
                        lineHeight: 1,
                    }}
                >
                    MIND BODY
                </div>
                {/* Content */}
                <div
                    style={{
                        position: "relative",
                        zIndex: 2,
                        padding: "0 6vw 8vh",
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        alignItems: "flex-end",
                        width: "100%",
                        gap: "2rem",
                    }}
                >
                    <div>
                        {/* Collection badge */}
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                border: "1px solid rgba(255,255,255,0.2)",
                                borderRadius: 100,
                                padding: "6px 16px",
                                marginBottom: 20,
                                backdropFilter: "blur(12px)",
                                background: "rgba(255,255,255,0.05)",
                            }}
                        >
                            <span
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "#2A5A68",
                                    display: "inline-block",
                                    boxShadow: "0 0 8px #2A5A68",
                                    animation: "pulse 2s infinite",
                                }}
                            />
                            <span
                                style={{
                                    color: "rgba(255,255,255,0.7)",
                                    fontSize: 11,
                                    letterSpacing: "0.15em",
                                    textTransform: "uppercase",
                                }}
                            >
                                Осінь — Зима 2025
                            </span>
                        </div>
                        <h2
                            style={{
                                color: "#FAF8F5",
                                fontSize: "clamp(36px, 5vw, 72px)",
                                fontWeight: 300,
                                letterSpacing: "-0.02em",
                                margin: 0,
                                lineHeight: 1.1,
                            }}
                        >
                            Сила починається
                            <br />
                            <em style={{ fontStyle: "normal", fontWeight: 700 }}>зсередини</em>
                        </h2>
                        <p
                            style={{
                                color: "rgba(250,248,245,0.5)",
                                fontSize: 15,
                                marginTop: 16,
                                letterSpacing: "0.02em",
                                lineHeight: 1.6,
                            }}
                        >
                            Supplex 280 г/м² · Ручна відбілка · Колекція Black Obsidian
                        </p>
                        {/* CTA row */}
                        <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
                            <a
                                href="/shop/yoga"
                                style={{
                                    display: "inline-block",
                                    background: "#FAF8F5",
                                    color: "#0B0B0C",
                                    padding: "14px 32px",
                                    borderRadius: 100,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    textDecoration: "none",
                                }}
                            >
                                Дивитись колекцію
                            </a>
                            <a
                                href="/shop/yoga"
                                style={{
                                    display: "inline-block",
                                    border: "1px solid rgba(255,255,255,0.3)",
                                    color: "#FAF8F5",
                                    padding: "14px 32px",
                                    borderRadius: 100,
                                    fontSize: 13,
                                    fontWeight: 400,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    textDecoration: "none",
                                    backdropFilter: "blur(8px)",
                                    background: "rgba(255,255,255,0.04)",
                                }}
                            >
                                Лукбук
                            </a>
                        </div>
                    </div>
                    {/* Right: slide dots + scroll indicator */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 8,
                            paddingBottom: 4,
                        }}
                    >
                        {["01", "02", "03", "04"].map((n, i) => (
                            <button
                                key={n}
                                style={{
                                    width: i === 0 ? 36 : 4,
                                    height: 4,
                                    borderRadius: 100,
                                    background: i === 0 ? "#FAF8F5" : "rgba(255,255,255,0.25)",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                    transition: "all 0.3s",
                                }}
                            />
                        ))}
                    </div>
                </div>
                {/* Concept label */}
                <div style={labelStyle}>КОНЦЕПЦІЯ A — Cinematic Full-Bleed</div>
            </section>

            {/* Divider */}
            <div style={{ padding: "24px 6vw", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <span
                    style={{
                        color: "rgba(255,255,255,0.3)",
                        fontSize: 11,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                    }}
                >
                    ↓ Scroll — 3 концепції нижче
                </span>
            </div>

            {/* ---- CONCEPT B: SPLIT EDITORIAL (65/35) ---- */}
            <section
                id="concept-b"
                style={{
                    position: "relative",
                    height: "100vh",
                    overflow: "hidden",
                    display: "grid",
                    gridTemplateColumns: "65fr 35fr",
                }}
            >
                {/* Left — hero photo */}
                <div
                    style={{
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            backgroundImage: "url('/hero/fable-s1-front.jpg')",
                            backgroundSize: "cover",
                            backgroundPosition: "50% 20%",
                        }}
                    />
                    {/* Left edge gradient to blend with right panel */}
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: "80px",
                            background: "linear-gradient(to right, transparent, #111214)",
                        }}
                    />
                    {/* Top gradient */}
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "30%",
                            background:
                                "linear-gradient(to bottom, rgba(11,11,12,0.6), transparent)",
                        }}
                    />
                    {/* Badge overlay */}
                    <div
                        style={{
                            position: "absolute",
                            top: "6vh",
                            left: "5vw",
                        }}
                    >
                        <div
                            style={{
                                background: "rgba(11,11,12,0.6)",
                                backdropFilter: "blur(16px)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 16,
                                padding: "16px 20px",
                            }}
                        >
                            <div
                                style={{
                                    color: "rgba(255,255,255,0.4)",
                                    fontSize: 10,
                                    letterSpacing: "0.15em",
                                    textTransform: "uppercase",
                                    marginBottom: 6,
                                }}
                            >
                                Новинка
                            </div>
                            <div style={{ color: "#FAF8F5", fontSize: 18, fontWeight: 600 }}>
                                Fable S1
                            </div>
                            <div
                                style={{
                                    color: "rgba(255,255,255,0.4)",
                                    fontSize: 12,
                                    marginTop: 2,
                                }}
                            >
                                від 2 890 ₴
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right panel — dark editorial */}
                <div
                    style={{
                        background: "#111214",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        padding: "6vh 5vw",
                    }}
                >
                    {/* Logo area */}
                    <div>
                        <div
                            style={{
                                color: "rgba(255,255,255,0.3)",
                                fontSize: 10,
                                letterSpacing: "0.2em",
                                textTransform: "uppercase",
                                marginBottom: 8,
                            }}
                        >
                            Mind Body Studio
                        </div>
                        <div
                            style={{
                                width: 40,
                                height: 1,
                                background: "rgba(255,255,255,0.2)",
                                marginBottom: 32,
                            }}
                        />
                    </div>

                    {/* Detail cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {/* Card 1 */}
                        <div
                            style={{
                                borderRadius: 12,
                                overflow: "hidden",
                                aspectRatio: "16/10",
                                backgroundImage: "url('/brand/detail-strap.avif')",
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                position: "relative",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    padding: "10px 14px",
                                    background:
                                        "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                                }}
                            >
                                <span style={{ color: "#FAF8F5", fontSize: 11, fontWeight: 500 }}>
                                    Перехресне лямування
                                </span>
                            </div>
                        </div>
                        {/* Card 2 */}
                        <div
                            style={{
                                borderRadius: 12,
                                overflow: "hidden",
                                aspectRatio: "16/10",
                                backgroundImage: "url('/brand/lookbook-red.avif')",
                                backgroundSize: "cover",
                                backgroundPosition: "50% 30%",
                                position: "relative",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    padding: "10px 14px",
                                    background:
                                        "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                                }}
                            >
                                <span style={{ color: "#FAF8F5", fontSize: 11, fontWeight: 500 }}>
                                    Supplex 280 г/м²
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Text + CTA */}
                    <div>
                        <h2
                            style={{
                                color: "#FAF8F5",
                                fontSize: 32,
                                fontWeight: 300,
                                lineHeight: 1.2,
                                margin: "0 0 16px",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            Комфорт,
                            <br />
                            <strong style={{ fontWeight: 700 }}>що надихає</strong>
                        </h2>
                        <a
                            href="/shop/yoga"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                color: "#FAF8F5",
                                textDecoration: "none",
                                fontSize: 12,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                borderBottom: "1px solid rgba(255,255,255,0.3)",
                                paddingBottom: 4,
                            }}
                        >
                            Дивитись колекцію
                            <span>→</span>
                        </a>
                    </div>
                </div>

                <div style={labelStyle}>КОНЦЕПЦІЯ B — Split Editorial 65/35</div>
            </section>

            {/* ---- CONCEPT C: MORPHING COLORWAY CAROUSEL ---- */}
            <section
                id="concept-c"
                style={{
                    position: "relative",
                    height: "100vh",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {/* BG with duo-tone color wash */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: "url('/hero/fable-s2-duo-campaign.jpg')",
                        backgroundSize: "cover",
                        backgroundPosition: "50% 25%",
                    }}
                />
                {/* Teal color wash */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(135deg, rgba(42,90,104,0.7) 0%, rgba(11,11,12,0.8) 70%)",
                    }}
                />

                {/* Center floating card */}
                <div
                    style={{
                        position: "relative",
                        zIndex: 2,
                        backdropFilter: "blur(32px) saturate(180%)",
                        background: "rgba(11,11,12,0.5)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 24,
                        padding: "48px 56px",
                        maxWidth: 480,
                        textAlign: "center",
                        boxShadow:
                            "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                    }}
                >
                    <div
                        style={{
                            display: "inline-block",
                            background: "rgba(42,90,104,0.3)",
                            border: "1px solid rgba(42,90,104,0.5)",
                            borderRadius: 100,
                            padding: "4px 14px",
                            color: "#7EC8D8",
                            fontSize: 10,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                            marginBottom: 24,
                        }}
                    >
                        Nordic Teal
                    </div>
                    <h2
                        style={{
                            color: "#FAF8F5",
                            fontSize: 42,
                            fontWeight: 300,
                            lineHeight: 1.1,
                            margin: "0 0 12px",
                            letterSpacing: "-0.03em",
                        }}
                    >
                        Два образи.
                        <br />
                        <strong style={{ fontWeight: 700 }}>Одна душа.</strong>
                    </h2>
                    <p
                        style={{
                            color: "rgba(250,248,245,0.5)",
                            fontSize: 14,
                            margin: "0 0 32px",
                            lineHeight: 1.6,
                        }}
                    >
                        Колекція Duo — однаковий крій,
                        <br />
                        два кольорові шляхи.
                    </p>

                    {/* Color swatches */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: 12,
                            marginBottom: 32,
                        }}
                    >
                        {[
                            { color: "#1a2733", label: "Obsidian" },
                            { color: "#2A5A68", label: "Nordic Teal", active: true },
                            { color: "#6B4E3D", label: "Warm Cocoa" },
                            { color: "#4A3728", label: "Espresso" },
                        ].map((swatch) => (
                            <div key={swatch.label} style={{ textAlign: "center" }}>
                                <div
                                    style={{
                                        width: swatch.active ? 36 : 28,
                                        height: swatch.active ? 36 : 28,
                                        borderRadius: "50%",
                                        background: swatch.color,
                                        border: swatch.active
                                            ? "2px solid #FAF8F5"
                                            : "2px solid transparent",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        boxShadow: swatch.active
                                            ? "0 0 0 3px rgba(255,255,255,0.2)"
                                            : "none",
                                        margin: "0 auto 6px",
                                    }}
                                />
                                <div
                                    style={{
                                        fontSize: 9,
                                        letterSpacing: "0.1em",
                                        color: swatch.active ? "#FAF8F5" : "rgba(255,255,255,0.3)",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {swatch.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                        <a
                            href="/shop/yoga"
                            style={{
                                display: "inline-block",
                                background: "#FAF8F5",
                                color: "#0B0B0C",
                                padding: "14px 28px",
                                borderRadius: 100,
                                fontSize: 12,
                                fontWeight: 600,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                textDecoration: "none",
                            }}
                        >
                            Дивитись обидва
                        </a>
                        <a
                            href="/shop/yoga"
                            style={{
                                display: "inline-block",
                                border: "1px solid rgba(255,255,255,0.25)",
                                color: "#FAF8F5",
                                padding: "14px 28px",
                                borderRadius: 100,
                                fontSize: 12,
                                fontWeight: 400,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                textDecoration: "none",
                            }}
                        >
                            Лукбук
                        </a>
                    </div>
                </div>

                <div style={labelStyle}>КОНЦЕПЦІЯ C — Colorway Glass Card</div>
            </section>

            {/* ---- CONCEPT D: HORIZONTAL SCROLL FILMSTRIP ---- */}
            <section
                id="concept-d"
                style={{
                    position: "relative",
                    height: "100vh",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    background: "#0d0d0f",
                }}
            >
                {/* Top bar */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4vh 6vw",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <div>
                        <div
                            style={{
                                color: "rgba(255,255,255,0.3)",
                                fontSize: 10,
                                letterSpacing: "0.15em",
                                textTransform: "uppercase",
                                marginBottom: 4,
                            }}
                        >
                            Нова колекція
                        </div>
                        <h2
                            style={{
                                color: "#FAF8F5",
                                fontSize: "clamp(20px, 3vw, 36px)",
                                fontWeight: 300,
                                margin: 0,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            Осінь 2025 — <strong>Black Series</strong>
                        </h2>
                    </div>
                    <a
                        href="/shop/yoga"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "#FAF8F5",
                            textDecoration: "none",
                            padding: "12px 24px",
                            borderRadius: 100,
                            fontSize: 11,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            backdropFilter: "blur(8px)",
                            background: "rgba(255,255,255,0.03)",
                        }}
                    >
                        Вся колекція
                    </a>
                </div>

                {/* Filmstrip row */}
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        gap: "2px",
                        overflow: "hidden",
                    }}
                >
                    {[
                        {
                            src: "/hero/fable-s3-black-2560w.jpg",
                            pos: "50% 15%",
                            label: "Butterfly — Black",
                            price: "2 890 ₴",
                        },
                        {
                            src: "/hero/fable-s1-front.jpg",
                            pos: "50% 20%",
                            label: "Fable S1 — Plum",
                            price: "2 490 ₴",
                        },
                        {
                            src: "/hero/fable-s5-espresso-runway-2560w.jpg",
                            pos: "50% 15%",
                            label: "Espresso Set",
                            price: "3 290 ₴",
                        },
                        {
                            src: "/hero/s2-cocoa-front-2560w.jpg",
                            pos: "50% 20%",
                            label: "Cocoa Front",
                            price: "2 690 ₴",
                        },
                        {
                            src: "/hero/fable-s2-duo-campaign.jpg",
                            pos: "50% 25%",
                            label: "Duo Campaign",
                            price: "від 4 990 ₴",
                        },
                    ].map((item, i) => (
                        <div
                            key={i}
                            style={{
                                flex: i === 1 ? "2.5" : "1",
                                position: "relative",
                                overflow: "hidden",
                                cursor: "pointer",
                                transition: "flex 0.5s cubic-bezier(.4,0,.2,1)",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    backgroundImage: `url('${item.src}')`,
                                    backgroundSize: "cover",
                                    backgroundPosition: item.pos,
                                    filter:
                                        i === 1
                                            ? "brightness(0.95)"
                                            : "brightness(0.6) saturate(0.7)",
                                    transition: "filter 0.4s",
                                }}
                            />
                            {i === 1 && (
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        background:
                                            "linear-gradient(to top, rgba(11,11,12,0.7) 0%, transparent 60%)",
                                    }}
                                />
                            )}
                            {/* Product info — visible on the expanded panel */}
                            {i === 1 && (
                                <div
                                    style={{
                                        position: "absolute",
                                        bottom: "5vh",
                                        left: "5%",
                                        color: "#FAF8F5",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 11,
                                            letterSpacing: "0.1em",
                                            textTransform: "uppercase",
                                            opacity: 0.5,
                                            marginBottom: 6,
                                        }}
                                    >
                                        {`0${i + 1}`}
                                    </div>
                                    <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
                                        {item.label}
                                    </div>
                                    <div style={{ fontSize: 15, opacity: 0.6 }}>{item.price}</div>
                                </div>
                            )}
                            {/* Thin vertical number on collapsed panels */}
                            {i !== 1 && (
                                <div
                                    style={{
                                        position: "absolute",
                                        bottom: "5vh",
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        color: "rgba(255,255,255,0.5)",
                                        fontSize: 11,
                                        letterSpacing: "0.1em",
                                        writingMode: "vertical-rl",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {`0${i + 1} · ${item.label}`}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div style={labelStyle}>КОНЦЕПЦІЯ D — Filmstrip / Accordion Gallery</div>
            </section>

            {/* Choose CTA */}
            <section
                style={{
                    padding: "80px 6vw",
                    textAlign: "center",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
            >
                <div
                    style={{
                        color: "rgba(255,255,255,0.3)",
                        fontSize: 11,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        marginBottom: 16,
                    }}
                >
                    Вибери концепцію для реалізації
                </div>
                <h3
                    style={{
                        color: "#FAF8F5",
                        fontSize: 32,
                        fontWeight: 300,
                        letterSpacing: "-0.02em",
                        margin: "0 0 40px",
                    }}
                >
                    Яка тобі найбільше подобається?
                </h3>
                <div
                    style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
                >
                    {[
                        "A — Cinematic Full-Bleed",
                        "B — Split Editorial 65/35",
                        "C — Colorway Glass Card",
                        "D — Filmstrip Accordion",
                    ].map((label) => (
                        <a
                            key={label}
                            href={`#concept-${label[0].toLowerCase()}`}
                            style={{
                                display: "inline-block",
                                border: "1px solid rgba(255,255,255,0.2)",
                                color: "#FAF8F5",
                                textDecoration: "none",
                                padding: "14px 28px",
                                borderRadius: 100,
                                fontSize: 13,
                                letterSpacing: "0.06em",
                                backdropFilter: "blur(8px)",
                                background: "rgba(255,255,255,0.03)",
                            }}
                        >
                            ↑ {label}
                        </a>
                    ))}
                </div>
            </section>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Onest:wght@300;400;500;600;700;800&display=swap');
                @keyframes heroZoom {
                    from { transform: scale(1.0); }
                    to { transform: scale(1.08); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
                html { scroll-behavior: smooth; }
                * { box-sizing: border-box; }
            `}</style>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    position: "absolute",
    top: 20,
    right: 24,
    background: "rgba(42,90,104,0.9)",
    backdropFilter: "blur(8px)",
    color: "#FAF8F5",
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    padding: "6px 14px",
    borderRadius: 100,
    zIndex: 100,
    border: "1px solid rgba(255,255,255,0.15)",
};
