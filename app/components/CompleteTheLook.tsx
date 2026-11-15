import type { RelatedProductCard } from "../types/product";
import { useI18n, useMoney, LLink } from "../i18n";
import { buildAvifSrcset, buildWebpSrcset } from "../utils/responsive-image";
import { generateProductAltText } from "../utils/seo";

interface CompleteTheLookProps {
    items: RelatedProductCard[];
}

export default function CompleteTheLook({ items }: CompleteTheLookProps) {
    const { t, locale } = useI18n();
    const money = useMoney();

    if (!items || items.length === 0) return null;

    return (
        <section className="complete-the-look" aria-labelledby="complete-look-title">
            <div className="complete-the-look__header">
                <span className="complete-the-look__kicker">{t("ДОПОВНИТИ ОБРАЗ")}</span>
                <h2 id="complete-look-title" className="complete-the-look__title">
                    {t("Завершений силует для повної свободи")}
                </h2>
                <p className="complete-the-look__subtitle">
                    {t(
                        "Комбінуйте з виробами з натуральних тканин та аксесуарами для цілісного образу.",
                    )}
                </p>
            </div>

            <div className="complete-the-look__grid">
                {items.map((item) => (
                    <LLink
                        key={item.id}
                        to={`/p/${item.slug || item.id}`}
                        className="complete-the-look__card group"
                    >
                        <div className="complete-the-look__image-wrapper">
                            <picture>
                                <source
                                    srcSet={buildAvifSrcset(item.image)}
                                    sizes="(max-width: 768px) 50vw, 320px"
                                    type="image/avif"
                                />
                                <source
                                    srcSet={buildWebpSrcset(item.image)}
                                    sizes="(max-width: 768px) 50vw, 320px"
                                    type="image/webp"
                                />
                                <img
                                    src={item.image}
                                    alt={generateProductAltText({
                                        title: item.name,
                                        locale,
                                    })}
                                    width="320"
                                    height="426"
                                    loading="lazy"
                                    decoding="async"
                                    className="complete-the-look__image"
                                />
                            </picture>
                            <span className="complete-the-look__badge">{t("Переглянути")}</span>
                        </div>
                        <div className="complete-the-look__info">
                            <h3 className="complete-the-look__name">{item.name}</h3>
                            <span className="complete-the-look__price">{money(item.price)}</span>
                        </div>
                    </LLink>
                ))}
            </div>
        </section>
    );
}
