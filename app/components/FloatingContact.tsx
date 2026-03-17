import { useState, useEffect } from "react";

// Example phone numbers — replace with real ones later
const PHONE = "380501234567";
const VIBER_URL = `viber://chat?number=%2B${PHONE}`;
const WHATSAPP_URL = `https://wa.me/${PHONE}`;
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
                    title="Написати у Viber"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <path d="M11.398.002C9.473.028 5.331.344 3.014 2.467 1.294 4.177.518 6.77.404 9.94c-.114 3.168-.26 9.108 5.584 10.77h.004l-.004 2.462s-.038.997.62 1.2c.796.246 1.263-.513 2.024-1.33.418-.448.995-1.108 1.43-1.612 3.937.332 6.962-.427 7.306-.54.796-.26 5.3-.836 6.034-6.82.758-6.178-.368-10.08-2.396-11.834l.002-.001C19.478 1.005 15.39-.08 11.398.002zm.595 2.126c3.473-.054 6.916.784 8.22 1.9 1.608 1.406 2.59 4.792 1.946 9.97-.594 4.788-3.986 5.18-4.652 5.396-.284.094-2.88.746-6.137.55 0 0-2.43 2.932-3.19 3.706-.12.122-.264.17-.36.146-.134-.034-.17-.194-.168-.428l.026-4.026s-.002-.006 0 0C2.63 17.756 2.77 12.65 2.862 9.97c.092-2.68.722-4.87 2.13-6.262C6.8 1.956 8.97 2.182 11.993 2.128zm-.266 3.088a.576.576 0 00-.008 1.152c1.592.018 2.962.576 3.972 1.574.984.974 1.56 2.346 1.588 3.946a.576.576 0 001.152-.012c-.032-1.86-.698-3.468-1.87-4.652C15.373 6.04 13.706 5.39 11.727 5.216zm.142 1.89a.576.576 0 00-.014 1.152c.966.018 1.73.338 2.316.918.564.556.862 1.316.876 2.296a.576.576 0 101.152-.016c-.018-1.252-.432-2.266-1.196-3.022-.746-.738-1.758-1.14-2.942-1.324a4.22 4.22 0 00-.192-.004zm-2.498.96c-.346-.006-.708.1-.978.356l-.002-.002c-.396.362-.78.758-1.11 1.2-.368.472-.544.95-.466 1.404l.002.002c.25.9.68 1.848 1.348 2.858.876 1.346 1.968 2.572 3.26 3.706l.039.034.034.028.008.008.012.008.006.006.022.02c1.134 1.064 2.35 1.918 3.686 2.562 1.546.768 2.52.962 3.108.72l.002.002c.512-.196.956-.542 1.37-.898l-.002-.002c.58-.55.66-1.286.2-1.896-.47-.628-1.218-1.244-2.012-1.784-.646-.44-1.378-.38-1.804.062l-.462.54c-.458.502-.612.448-.612.448l-.002.002c-2.916-1.054-4.186-4.094-4.186-4.094s-.054-.154.448-.612l.54-.46c.442-.428.502-1.16.062-1.804-.54-.794-1.156-1.544-1.784-2.014a1.397 1.397 0 00-.718-.298zm2.636.938a.576.576 0 00-.04 1.15c.488.036.864.208 1.128.472.236.236.372.53.4.92a.576.576 0 001.15-.06c-.042-.652-.274-1.186-.68-1.592-.39-.39-.906-.636-1.582-.844a.576.576 0 00-.376-.046z" />
                    </svg>
                </a>
                <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="floating-contact__btn floating-contact__btn--whatsapp"
                    aria-label="WhatsApp"
                    title="Написати у WhatsApp"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                </a>
                <a
                    href={TELEGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="floating-contact__btn floating-contact__btn--telegram"
                    aria-label="Telegram"
                    title="Написати у Telegram"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                </a>
            </div>

            {/* Main toggle button */}
            <button
                className={`floating-contact__toggle ${isOpen ? "is-open" : ""}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Зв'язатись з нами"
                title="Зв'язатись з нами"
            >
                {isOpen ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                    <polyline points="18 15 12 9 6 15" />
                </svg>
            </button>
        </div>
    );
}
