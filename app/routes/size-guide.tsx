import { Link } from "react-router";

export default function SizeGuide() {
    return (
        <main className="size-guide-page">
            <section className="page-hero" style={{
                background: 'linear-gradient(135deg, var(--color-bg-cream) 0%, var(--color-bg-soft) 100%)',
                padding: '120px 0 60px',
                textAlign: 'center'
            }}>
                <div className="container">
                    <nav className="breadcrumb" style={{ marginBottom: '20px' }}>
                        <Link to="/">Головна</Link>
                        <span> / </span>
                        <span>Розмірна сітка</span>
                    </nav>
                    <h1>Розмірна сітка</h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Як обрати правильний розмір</p>
                </div>
            </section>

            <section className="section" style={{ background: '#fff' }}>
                <div className="container" style={{ maxWidth: '1000px' }}>
                    <div style={{ marginBottom: '60px' }}>
                        <h2 style={{ marginBottom: '30px' }}>Жіночі розміри</h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-primary)', color: '#fff' }}>
                                        <th style={{ padding: '15px' }}>Розмір</th>
                                        <th style={{ padding: '15px' }}>XS</th>
                                        <th style={{ padding: '15px' }}>S</th>
                                        <th style={{ padding: '15px' }}>M</th>
                                        <th style={{ padding: '15px' }}>L</th>
                                        <th style={{ padding: '15px' }}>XL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ background: 'var(--color-bg-cream)' }}>
                                        <td style={{ padding: '15px', fontWeight: '600' }}>Обхват грудей (см)</td>
                                        <td style={{ padding: '15px' }}>80-84</td>
                                        <td style={{ padding: '15px' }}>84-88</td>
                                        <td style={{ padding: '15px' }}>88-92</td>
                                        <td style={{ padding: '15px' }}>92-96</td>
                                        <td style={{ padding: '15px' }}>96-100</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '15px', fontWeight: '600' }}>Обхват талії (см)</td>
                                        <td style={{ padding: '15px' }}>60-64</td>
                                        <td style={{ padding: '15px' }}>64-68</td>
                                        <td style={{ padding: '15px' }}>68-72</td>
                                        <td style={{ padding: '15px' }}>72-76</td>
                                        <td style={{ padding: '15px' }}>76-80</td>
                                    </tr>
                                    <tr style={{ background: 'var(--color-bg-cream)' }}>
                                        <td style={{ padding: '15px', fontWeight: '600' }}>Обхват стегон (см)</td>
                                        <td style={{ padding: '15px' }}>88-92</td>
                                        <td style={{ padding: '15px' }}>92-96</td>
                                        <td style={{ padding: '15px' }}>96-100</td>
                                        <td style={{ padding: '15px' }}>100-104</td>
                                        <td style={{ padding: '15px' }}>104-108</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ marginBottom: '60px' }}>
                        <h2 style={{ marginBottom: '30px' }}>Дитячі розміри</h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-accent)', color: '#fff' }}>
                                        <th style={{ padding: '15px' }}>Розмір</th>
                                        <th style={{ padding: '15px' }}>104</th>
                                        <th style={{ padding: '15px' }}>110</th>
                                        <th style={{ padding: '15px' }}>116</th>
                                        <th style={{ padding: '15px' }}>122</th>
                                        <th style={{ padding: '15px' }}>128</th>
                                        <th style={{ padding: '15px' }}>134</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ background: 'var(--color-bg-cream)' }}>
                                        <td style={{ padding: '15px', fontWeight: '600' }}>Вік (років)</td>
                                        <td style={{ padding: '15px' }}>3-4</td>
                                        <td style={{ padding: '15px' }}>4-5</td>
                                        <td style={{ padding: '15px' }}>5-6</td>
                                        <td style={{ padding: '15px' }}>6-7</td>
                                        <td style={{ padding: '15px' }}>7-8</td>
                                        <td style={{ padding: '15px' }}>8-9</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '15px', fontWeight: '600' }}>Зріст (см)</td>
                                        <td style={{ padding: '15px' }}>99-104</td>
                                        <td style={{ padding: '15px' }}>105-110</td>
                                        <td style={{ padding: '15px' }}>111-116</td>
                                        <td style={{ padding: '15px' }}>117-122</td>
                                        <td style={{ padding: '15px' }}>123-128</td>
                                        <td style={{ padding: '15px' }}>129-134</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ padding: '40px', background: 'var(--color-bg-cream)', borderRadius: '20px' }}>
                        <h3 style={{ marginBottom: '20px' }}>Як правильно зняти мірки</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' }}>
                            <div>
                                <h4 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>Обхват грудей</h4>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                                    Виміряйте стрічкою по найширшій частині грудей, тримаючи її горизонтально.
                                </p>
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>Обхват талії</h4>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                                    Виміряйте по найвужчій частині талії, зазвичай трохи вище пупка.
                                </p>
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>Обхват стегон</h4>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                                    Виміряйте по найширшій частині стегон і сідниць.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '40px', textAlign: 'center' }}>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                            Потрібна допомога з вибором розміру?
                        </p>
                        <Link to="/contacts" className="btn btn--primary">
                            Зв'язатися з нами
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
