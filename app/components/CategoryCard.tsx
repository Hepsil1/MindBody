import { Link } from "react-router";

interface CategoryCardProps {
    title: string;
    subtitle: string;
    image: string;
    imagePos?: string; // Format: "x% y% scale" e.g. "50% 30% 1.2"
    link: string;
    buttonText: string;
}

export default function CategoryCard({ title, subtitle, image, imagePos, link, buttonText }: CategoryCardProps) {
    // Parse imagePos: "50% 30% 1.2" -> { x: 50%, y: 30%, scale: 1.2 }
    const parseImagePos = () => {
        if (!imagePos) return { position: "center center", scale: 1 };
        const parts = imagePos.split(' ');
        const x = parts[0] || "50%";
        const y = parts[1] || "50%";
        const scale = parseFloat(parts[2]) || 1;
        return { position: `${x} ${y}`, scale };
    };

    const { position, scale } = parseImagePos();

    return (
        <Link to={link} prefetch="intent" className="category-card">
            <div className="category-card__image">
                <img
                    src={image}
                    alt={title}
                    style={{
                        objectPosition: position,
                        transform: scale !== 1 ? `scale(${scale})` : undefined,
                        transformOrigin: position
                    }}
                />
            </div>
            <div className="category-card__overlay"></div>
            <div className="category-card__content">
                <p className="category-card__count">{subtitle}</p>
                <h3 className="category-card__title">{title}</h3>
                <div className="category-card__shop-now">{buttonText}</div>
            </div>
        </Link>
    );
}
