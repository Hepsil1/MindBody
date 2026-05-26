import { Link } from "react-router";
import { buildAvifSrcset, buildWebpSrcset } from "../utils/responsive-image";
import { getLqipStyle } from "../utils/lqip";
import { getMoodPreset, type MoodType } from "../utils/moods";

interface CategoryCardProps {
    title: string;
    subtitle: string;
    image: string;
    imagePos?: string; // Format: "x% y% scale" e.g. "50% 30% 1.2"
    link: string;
    buttonText: string;
    /** Batch 41: optional theme mood.  When set, the card applies a
        subtle tint overlay and shifts the title typography per the
        preset in app/utils/moods.ts.  When null/undefined the card
        renders in the existing neutral style — no regression. */
    moodType?: MoodType | string | null;
}

export default function CategoryCard({
    title,
    subtitle,
    image,
    imagePos,
    link,
    buttonText,
    moodType,
}: CategoryCardProps) {
    const mood = getMoodPreset(moodType);
    // Parse imagePos: "50% 30% 1.2" -> { x: 50%, y: 30%, scale: 1.2 }
    const parseImagePos = () => {
        if (!imagePos) return { position: "center center", scale: 1 };
        const parts = imagePos.split(" ");
        const x = parts[0] || "50%";
        const y = parts[1] || "50%";
        const scale = parseFloat(parts[2]) || 1;
        return { position: `${x} ${y}`, scale };
    };

    const { position, scale } = parseImagePos();

    return (
        <Link to={link} prefetch="intent" className="category-card-editorial">
            <div
                className="category-card-editorial__image-wrapper"
                /* Batch 40 atom 8: LQIP blur-up backdrop for instant
                   visual context while the variant loads. */
                style={getLqipStyle(image)}
            >
                <picture>
                    {/* Batch 40 atom 6: AVIF first for -25/-30% wire bytes
                        at premium-equivalent visual quality (q=80). */}
                    <source
                        srcSet={buildAvifSrcset(image)}
                        sizes="(max-width: 768px) 50vw, 33vw"
                        type="image/avif"
                    />
                    <source
                        srcSet={buildWebpSrcset(image)}
                        sizes="(max-width: 768px) 50vw, 33vw"
                        type="image/webp"
                    />
                    <img
                        src={image}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        /* Batch 40 atom 5: explicit width/height pair so the
                           browser reserves layout space and avoids the CLS
                           jump when the image decodes. Aspect 3:4 to match
                           the wrapper. CSS keeps object-fit: cover. */
                        width="800"
                        height="1067"
                        style={{
                            objectPosition: position,
                            transform: scale !== 1 ? `scale(${scale})` : undefined,
                            transformOrigin: position,
                        }}
                    />
                </picture>
            </div>
            <div
                className="category-card-editorial__overlay"
                /* Batch 41: mood tint laid OVER the base overlay. Keep
                   opacity low (≤12%) so the photo stays readable — this
                   is a flavour layer, not a colour wash. */
                style={mood ? { background: mood.tintOverlay } : undefined}
            />
            <div className="category-card-editorial__content">
                <div className="category-card-editorial__text-group">
                    <h3
                        className="category-card-editorial__title"
                        style={
                            mood
                                ? {
                                      fontWeight: mood.titleWeight,
                                      letterSpacing: mood.titleLetterSpacing,
                                  }
                                : undefined
                        }
                    >
                        {title}
                    </h3>
                    <div className="category-card-editorial__reveal-wrap">
                        <div className="category-card-editorial__reveal-inner">
                            <p className="category-card-editorial__subtitle">{subtitle}</p>
                            <span className="category-card-editorial__link">
                                {buttonText} <span>→</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
