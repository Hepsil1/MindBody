import { useState, useEffect } from "react";

// Business contact numbers
const PHONE = "380509656737";
const VIBER_URL = `viber://chat?number=%2B${PHONE}`;
const WHATSAPP_URL = `https://wa.me/380973542848`;
const TELEGRAM_URL = `https://t.me/+${PHONE}`;

export default function FloatingContact() {
    const [isOpen, setIsOpen] = useState(false);
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 400);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div className="floating-contact">
            {/* Messenger buttons — expand on click */}
            <div className={`floating-contact__panel ${isOpen ? "is-open" : ""}`}>
                <a
                    href={VIBER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="floating-contact__btn floating-contact__btn--viber"
                    aria-label="Viber"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21.298 10.456c-.053-4.145-3.328-7.51-7.464-7.564-4.19-.054-7.636 3.28-7.69 7.47-.03 2.378.895 4.542 2.457 6.13-.396 2.08-1.782 3.655-1.84 3.73-.105.127-.123.3-.047.447.078.148.232.24.4.24.938 0 2.87-.205 4.417-1.162a7.669 7.669 0 002.322.366c4.156.054 7.625-3.266 7.68-7.443zm-7.447 6.326a6.43 6.43 0 01-1.954-.31.625.625 0 00-.518.067c-1.285.8-2.846.993-3.61.993a7.351 7.351 0 001.21-2.458.625.625 0 00-.184-.66C7.522 13.14 6.77 11.353 6.79 9.387c.046-3.468 2.898-6.228 6.365-6.183 3.425.045 6.136 2.812 6.18 6.223.045 3.447-2.732 6.31-6.18 6.355zm1.5-3.333c-.092-.046-1.103-.545-1.258-.618-.154-.076-.28-.112-.4.07-.124.184-.46.61-.555.733-.09.124-.184.14-.308.08-.124-.064-.783-.29-1.493-.923-.55-.494-.925-1.104-1.033-1.288-.108-.184-.01-.282.053-.343.056-.056.124-.14.185-.213.06-.073.083-.125.122-.206.04-.083.02-.156-.01-.24-.03-.082-.398-1.026-.546-1.403-.14-.366-.282-.315-.4-.32-.108-.005-.23-.005-.355-.005-.125 0-.323.048-.492.23-.17.184-.647.632-.647 1.54 0 .91.662 1.788.755 1.91.092.124 1.306 2.057 3.167 2.86.44.195.786.31 1.054.397.444.14.85.12 1.168.07.355-.052 1.103-.45 1.258-.885.154-.436.154-.808.106-.885-.046-.076-.17-.124-.294-.184z" />
                    </svg>
                </a>
                <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="floating-contact__btn floating-contact__btn--whatsapp"
                    aria-label="WhatsApp"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                </a>
                <a
                    href={TELEGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="floating-contact__btn floating-contact__btn--telegram"
                    aria-label="Telegram"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                </a>
            </div>

            {/* Main toggle button (Close/X or Chat) */}
            <button
                className={`floating-contact__toggle ${isOpen ? "is-open" : ""}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Зв'язатись з нами"
            >
                {isOpen ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                )}
            </button>

            {/* Back to top */}
            <button
                className={`floating-contact__scroll-top ${showBackToTop ? "is-visible" : ""}`}
                onClick={scrollToTop}
                aria-label="Нагору"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                </svg>
            </button>
        </div>
    );
}
