// The REAL MIND BODY brand marks (used site-wide). Never hand-draw the sun —
// use these. `sun` = the teal petal-sun icon; `lockup` = sun + wordmark +
// "sport wear"; `white` filters the sun to white for dark backgrounds.
const SRC = {
    sun: "/pics/mind_body_logo_sun.webp",
    lockup: "/pics/mind_body_logo.webp",
} as const;

export function BrandMark({
    variant = "sun",
    white = false,
    className,
    alt = "MIND BODY",
    eager = false,
    decorative = true,
}: {
    variant?: keyof typeof SRC;
    white?: boolean;
    className?: string;
    alt?: string;
    eager?: boolean;
    decorative?: boolean;
}) {
    return (
        <img
            src={SRC[variant]}
            alt={decorative ? "" : alt}
            aria-hidden={decorative ? true : undefined}
            className={`brandmark${white ? " brandmark--white" : ""}${className ? ` ${className}` : ""}`}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
        />
    );
}
