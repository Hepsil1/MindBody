# MindBody — CLAUDE.md

Украинский e-commerce (спортивная одежда). React Router 7 + Prisma 5 + PostgreSQL (локально, `mindbody_db`) + Vite. Прод на этом же Windows VPS: PM2 (`mindbody`, `caddy`) + Caddy → localhost:3000, домен mindbody-sportwear.com за Cloudflare. Языки uk/en/ru, заказ всегда в ₴ ($ по курсу НБУ).

## Карта «мозгов» (куда смотреть в первую очередь)

**Деньги и заказы**

- `app/services/order.server.ts` — создание заказа, транзакции, инвентарь (FOR UPDATE)
- `app/services/inventory.server.ts`, `app/services/promo.server.ts`
- `app/routes/api.orders.create.tsx`, `app/routes/checkout.tsx` (файл-монстр ~1000 строк — менять точечно)
- `app/utils/shipping.ts` — ЕДИНСТВЕННЫЙ источник правды по доставке: `qualifiesForFreeShipping → false`, бесплатной доставки НЕТ и о ней не пишем нигде

**Каталог и таксономия**

- `app/utils/taxonomy.ts` + `taxonomy-config.server.ts` — дерево категорий/фильтров end-to-end
- `app/utils/shopProducts.server.ts` — запросы каталога (фильтрует `status:"active"`) + `cache.server.ts`
- `app/utils/productQuality.ts` — гейт публикации (нельзя `active` без stock/фото/цены/категории)
- `app/routes/p.$slug.tsx` — PDP (add-to-cart заблокирован до выбора цвета+размера — это фича, не баг)

**Изображения/видео**

- `app/utils/upload.server.ts` + `image-variants.server.ts` — админ-загрузка генерит ВСЕ ширины + LQIP синхронно. `<picture>` НЕ фолбэчит при 404 варианта → фото только через админ-upload, ручная частичная подкладка ломает srcset
- `app/utils/video.server.ts` — ffmpeg (H.264 CRF19 faststart, сохранять исходный fps)

**Инфраструктура запроса**

- `app/utils/admin.server.ts` + `admin-guard.server.ts` — админ-сессии (bcrypt, токен)
- `app/utils/csrf.server.ts`, `rateLimit.server.ts`, `env.server.ts`
- `app/utils/currency.server.ts`, `translations.server.ts` (словарь = укр-ключи, `scripts/build-dicts.mjs`; переводы БД лежат в raw-SQL-колонках вне Prisma-схемы)
- `app/utils/email.server.ts` — Resend, EMAIL_FROM = mindbody-sportwear.com (saleid.icu мёртв: письма с него молча падают 403; ключ restricted sending-only)
- `app/utils/site-settings.server.ts` — редактируемый контент сайта (редактор v2, iframe-предпросмотр)

## Команды и деплой

- dev: `npm run dev` (порт 3000, иногда 3001); проверки: `npm run typecheck`, `lint`, `format` (CI падает на непроформатированном)
- деплой: `npm run deploy` (вызывает powershell 5.1; pwsh НЕ установлен), timeout ~180с. Внутри `scripts/deploy.ps1`: image-варианты → `react-router build` БЕЗ `prisma generate` (PM2 держит DLL) → `pm2 restart mindbody` → smoke-check. При фейле билда PM2 не трогается (нет даунтайма). **Билдится РАБОЧЕЕ ДЕРЕВО, не git — уедут и незакоммиченные правки!**
- **Ручной build только при остановленном PM2** (Prisma DLL EPERM); build без рестарта PM2 = сломанная гидратация
- PM2 env: `ecosystem.config.cjs` сам парсит `.env` при старте → `pm2 restart` НЕ перечитывает .env, нужно `pm2 delete mindbody && pm2 start ecosystem.config.cjs`
- Caddy тоже под PM2: правки Caddyfile → `pm2 restart caddy`
- Кэш: HTML DYNAMIC/no-cache, ассеты immutable-hash. «Владелец не видит обновление» = ЕГО локальный кэш (особенно iOS Safari bfcache: pull-to-refresh не сбрасывает — приватная вкладка). Cloudflare НЕ чистить — HTML и так не кэшируется
- git: stash НЕ работает (битые объекты, см. `.git_corrupt_bak/`); `"` внутри `git commit -m` в PS5.1 ломает аргументы — here-string
- Бэкапы: `npm run backup:db`, папка `C:\mindbody_backups\`; autostart через Task Scheduler (MindBody-Startup/Watchdog)

## Рецепты верификации (проверять живьём, не «по коду»)

- **Админка под логином**: минт cookie — `createCookie("admin_session",{secrets:[SESSION_SECRET]})` из react-router → `.serialize(token)` → значение в Playwright `context.addCookies` (для прода `secure:true`, `url:"https://mindbody-sportwear.com"`). SESSION_SECRET в `.env`. Пароль хэшировать: `scripts/hash-admin-password.mjs`
- **Playwright-браузеры**: `PLAYWRIGHT_BROWSERS_PATH=C:/mindbody/.pw-browsers`
- **Клиентский вход покупателя**: `sessionStorage['auth_user']` (не cookie)
- **Тестовые товары**: создавать `TEST-*` через админ-форму, после проверки УДАЛИТЬ
- **Тестовые письма**: только pepsig8778@gmail.com (НЕ i3331113@gmail.com); `scripts/send-test-order-email.cjs`
- **Готовые e2e-прогоны**: `scripts/p0-e2e.mjs`, `product-quality-e2e.mjs`, `inventory-e2e.mjs`, `categories-e2e.mjs`, `site-editor-e2e.mjs`, `slug-url-e2e.mjs`
- **Аналитика** — только живой network-панелью: код-аудит не видит GA Enhanced Measurement

## Дебаг «добавила товар, а его нет на сайте»

1. Новый товар default `status:"draft"` → невидим, пока не «Опубліковано» (публикация требует stock>0) — причина №1
2. HEIC с айфона ловится на клиенте; совет: Камера → Форматы → «Наиболее совместимый»
3. Цвета в форме товара = только ВКЛЮЧЁННЫЕ в «Меню та фільтри магазину» (палитра фиксирована в `utils/colors.ts`)
4. Категории товаров редактируются в модалке «Меню та фільтри» (`admin/slides.tsx`), НЕ в `/admin/categories` (то — карточки главной)
5. `admin/inventory.tsx` — read-only журнал; склад задаётся в форме товара

## Железные правила проекта

1. GA4 page_view шлётся через Enhanced Measurement — вручную НЕ добавлять (двойной счёт).
2. Новые админ-кнопки/инпуты — только классы `.admin-btn`/`.admin-input`, не инлайн-стили.
3. Никаких морфов/блендов/WebGL между фото; владелец смотрит с reduce-motion ON — scroll-driven `animation-timeline` замерзает под reduce-motion, гейтить и давать IntersectionObserver-фолбэк.
4. Дизайн: плотно = премиум; избегать больших пустых зон; «просто» ≠ «пусто». Шрифты Onest/Manrope/Spectral/Hanken Grotesk; Cormorant/DM Sans/Fraunces забанены.
5. Не писать «малые партии» и «бесплатная доставка» ни в одном тексте сайта.
6. По умолчанию typed Prisma. Raw SQL легитимен там, где уже есть (~13 файлов: i18n-колонки переводов, FOR UPDATE, health, audit-JOIN) — новых мест не плодить без причины.
7. `\w` в JS-regex не матчит кириллицу — для укр/рус текста явные диапазоны.
8. Мега-панель категорий: не возвращать `:focus-within` (приклеивал панели после SPA-клика).

## Как мыслить (протокол Fable для этого проекта)

1. **Сначала понять, потом трогать.** Прочитай реальный код вокруг места правки; не полагайся на память о том, «как обычно делается». Половина багов здесь — от правок вслепую в файлах-монстрах.
2. **Атомарные шаги.** Одно изменение = один атом: что меняем → риск → как проверяем → как откатываем. Не смешивать рефактор с фиксом.
3. **Верификация живьём.** Код-ревью не видит кэш, гидратацию, GA, письма. Использовать рецепты выше; «должно работать» — запрещённая фраза: либо проверено, либо явно помечено как непроверенное.
4. **Честный отчёт.** Упало — сказать что упало и показать вывод. Собрано, но не задеплоено — писать прямо. Пропустил шаг — сказать.
5. **Вывод первым.** Ответ начинается с результата, детали после. Без воды.
6. **Не переспрашивать разрешение** на обратимые шаги, вытекающие из задачи; останавливаться только перед разрушительным (удаление данных, прод-миграции, деплой без запроса) или сменой скоупа.
7. **Симптом ≠ диагноз.** Перед рестартом/удалением/правкой конфига проверь улики. Классика: «сломалось» = кэш браузера владельца; «письма не ушли» = молчаливый 403 от Resend.
8. **Стабилизация важнее косметики.** Сначала корректность и аудит, дизайн — потом (явная просьба владельца).
9. **Помни про рабочее дерево при деплое:** deploy.ps1 выкатывает всё незакоммиченное — перед деплоем проверь `git status`, чтобы не уехало лишнее.
