# Nova Poshta API Integration — Інструкція

## ✅ Що Готово

Інтегровано **Nova Poshta API** в checkout процес:

### Функціонал:
1. **Автозаповнення міст** — при введенні назви міста з'являються підказки
2. **Вибір відділення** — після вибору міста автоматично завантажуються відділення НП
3. **Відправка замовлення** — коректне збереження даних в базу + редірект на thank-you.html

---

## 🔑 Як Отримати Свій API Ключ

Зараз використовується **тестовий ключ**: `2d0a8bcd4fa370b8a213d90597122dd4`

### Щоб отримати власний ключ:

1. Зайдіть на [https://devcenter.novaposhta.ua/](https://devcenter.novaposhta.ua/)
2. Натисніть **"Реєстрація"** (або увійдіть, якщо є акаунт)
3. Після входу:
   - Перейдіть в розділ **"Ключі"** (API Keys)
   - Натисніть **"Створити ключ"**
   - Скопіюйте ключ (формат: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

4. **Замініть** тестовий ключ у файлі `d:\mindbody\src\js\checkout.js`:

```javascript
// Знайдіть рядок 9:
novaPoshtaApiKey: '2d0a8bcd4fa370b8a213d90597122dd4', // Тестовий ключ

// Замініть на:
novaPoshtaApiKey: 'ВАШ_КЛЮЧ_ТУТ',
```

---

## 🧪 Тестування

### 1. Додайте товари в кошик:
   - Перейдіть на каталог: `http://localhost:4000/shop-women.html`
   - Додайте кілька товарів в кошик

### 2. Перейдіть до оформлення:
   - Натисніть на іконку кошика → Кнопка "Оформити замовлення"
   - Відкриється `checkout.html`

### 3. Заповніть форму:
   **Крок 1 — Контактні дані:**
   - Ім'я: `Олександр`
   - Телефон: `+380501234567`
   - Email: (опціонально)
   - Натисніть "Продовжити"

   **Крок 2 — Доставка:**
   - Почніть вводити місто, наприклад: `Київ`
   - Виберіть зі списку підказок
   - Після вибору міста заповніться список відділень
   - Виберіть відділення
   - Натисніть "Підтвердити замовлення"

### 4. Результат:
   - Замовлення відправиться на backend (`POST /orders`)
   - Буде створений запис в базі даних `orders` та `order_items`
   - Редірект на `thank-you.html?order=MB-123456`
   - Кошик очиститься

---

## 🗂️ Що Було Створено/Змінено

### 1. Новий файл: `src/js/checkout.js` (291 рядків)
**Функції:**
- `loadCart()` — завантаження кошика з localStorage
- `renderCartSummary()` — відображення товарів у sidebar
- `searchCities(query)` — пошук міст через NovaPoshta API
- `getWarehouses(cityRef)` — отримання відділень по місту
- `setupNovaPoshtaAutocomplete()` — підключення автозаповнення
- `submitOrder()` — відправка замовлення на backend
- `goToStep(step)` — навігація між кроками форми

### 2. Оновлено: `checkout.html`
Додано скрипти:
```html
<script src="src/js/api.js"></script>
<script src="src/js/main.js"></script>
<script src="src/js/cart.js"></script>
<script src="src/js/wishlist.js"></script>
<script src="src/js/checkout.js"></script> <!-- NEW -->
```

---

## 📡 Nova Poshta API Methods

### 1. Пошук міст
**Endpoint:** `https://api.novaposhta.ua/v2.0/json/`  
**Метод POST:**
```json
{
  "apiKey": "YOUR_KEY",
  "modelName": "Address",
  "calledMethod": "searchSettlements",
  "methodProperties": {
    "CityName": "Київ",
    "Limit": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": [{
    "Addresses": [
      {
        "Ref": "8d5a980d-391c-11dd-90d9-001a92567626",
        "Present": "м. Київ, Київська обл."
      }
    ]
  }]
}
```

### 2. Отримання відділень
**Метод POST:**
```json
{
  "apiKey": "YOUR_KEY",
  "modelName": "Address",
  "calledMethod": "getWarehouses",
  "methodProperties": {
    "CityRef": "8d5a980d-391c-11dd-90d9-001a92567626",
    "Limit": 50
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "Ref": "xxx",
      "Description": "Відділення №1: вул. Хрещатик, 1"
    }
  ]
}
```

---

## 🚀 Backend Integration

### Orders Endpoint (`POST /orders`)

**Request Body:**
```json
{
  "customer_name": "Олександр",
  "customer_phone": "+380501234567",
  "customer_email": "alex@example.com",
  "delivery_city": "м. Київ, Київська обл.",
  "delivery_address": "Відділення №5: вул. Хрещатик, 1",
  "payment_method": "cash_on_delivery",
  "total_amount": 4950,
  "items": [
    {
      "product_id": 1,
      "name": "Комбінезон Winter Cherry Bell",
      "price": 2250,
      "quantity": 2,
      "size": "M",
      "color": null
    }
  ]
}
```

**Response:**
```json
{
  "id": 12,
  "order_number": "MB-000012",
  "status": "new",
  "total_amount": 4950,
  "created_at": "2026-01-28T01:40:00"
}
```

---

## ✅ Checklist

- [x] Створено `checkout.js`
- [x] Додано NovaPoshta API інтеграцію
- [x] Підключено автозаповнення міст
- [x] Підключено вибір відділень
- [x] Відправка замовлення працює
- [x] Очищення кошика після замовлення
- [x] Редірект на thank-you page
- [ ] **Отримати особистий API ключ** (замість тестового)
- [ ] Протестувати на реальних даних

---

## 🐛 Troubleshooting

### Проблема: Міста не підвантажуються
**Рішення:** Перевірте API ключ. Тестовий ключ може мати ліміти.

### Проблема: Console error "CORS"
**Рішення:** NovaPoshta API підтримує CORS, але переконайтеся, що запити йдуть через `https://api.novaposhta.ua/v2.0/json/`

### Проблема: Замовлення не створюється
**Рішення:** 
1. Перевірте, чи працює backend (`http://localhost:4444`)
2. Перевірте консоль браузера на помилки
3. Перевірте, чи є товари в кошику

---

**Готово до тестування!** 🎉
