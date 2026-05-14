import { Link } from "react-router";
import "../styles/size-guide.css";

export default function SizeGuide() {
    return (
        <main className="size-guide-page">
            <section className="page-hero">
                <div className="container">
                    <nav className="breadcrumb">
                        <Link to="/">Головна</Link>
                        <span> / </span>
                        <span>Розмірна сітка</span>
                    </nav>
                    <h1>Розмірна сітка</h1>
                    <p>Як обрати правильний розмір</p>
                </div>
            </section>

            <section className="section sg-section">
                <div className="container sg-container">
                    <div className="sg-table-group">
                        <h2>Жіночі розміри</h2>
                        <div className="sg-table-wrap">
                            <table className="sg-table sg-table--women">
                                <thead>
                                    <tr>
                                        <th>Розмір</th>
                                        <th>XS</th>
                                        <th>S</th>
                                        <th>M</th>
                                        <th>L</th>
                                        <th>XL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="sg-label">Обхват грудей (см)</td>
                                        <td>80-84</td>
                                        <td>84-88</td>
                                        <td>88-92</td>
                                        <td>92-96</td>
                                        <td>96-100</td>
                                    </tr>
                                    <tr>
                                        <td className="sg-label">Обхват талії (см)</td>
                                        <td>60-64</td>
                                        <td>64-68</td>
                                        <td>68-72</td>
                                        <td>72-76</td>
                                        <td>76-80</td>
                                    </tr>
                                    <tr>
                                        <td className="sg-label">Обхват стегон (см)</td>
                                        <td>88-92</td>
                                        <td>92-96</td>
                                        <td>96-100</td>
                                        <td>100-104</td>
                                        <td>104-108</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="sg-table-group">
                        <h2>Дитячі розміри</h2>
                        <div className="sg-table-wrap">
                            <table className="sg-table sg-table--kids">
                                <thead>
                                    <tr>
                                        <th>Розмір</th>
                                        <th>104</th>
                                        <th>110</th>
                                        <th>116</th>
                                        <th>122</th>
                                        <th>128</th>
                                        <th>134</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="sg-label">Вік (років)</td>
                                        <td>3-4</td>
                                        <td>4-5</td>
                                        <td>5-6</td>
                                        <td>6-7</td>
                                        <td>7-8</td>
                                        <td>8-9</td>
                                    </tr>
                                    <tr>
                                        <td className="sg-label">Зріст (см)</td>
                                        <td>99-104</td>
                                        <td>105-110</td>
                                        <td>111-116</td>
                                        <td>117-122</td>
                                        <td>123-128</td>
                                        <td>129-134</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="sg-tips">
                        <h3>Як правильно зняти мірки</h3>
                        <div className="sg-tips-grid">
                            <div>
                                <h4>Обхват грудей</h4>
                                <p>
                                    Виміряйте стрічкою по найширшій частині грудей, тримаючи її горизонтально.
                                </p>
                            </div>
                            <div>
                                <h4>Обхват талії</h4>
                                <p>
                                    Виміряйте по найвужчій частині талії, зазвичай трохи вище пупка.
                                </p>
                            </div>
                            <div>
                                <h4>Обхват стегон</h4>
                                <p>
                                    Виміряйте по найширшій частині стегон і сідниць.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="sg-cta">
                        <p>
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
