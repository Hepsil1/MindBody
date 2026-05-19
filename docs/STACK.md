# Stack: что у нас и почему

Короткая справка по нашему фронтенду — чтобы через месяц не возник
вопрос "а SEO у нас нормальный?" во второй раз.

## TL;DR

У нас **не SPA**. У нас полноценный **SSR на React Router 7** (бывший
Remix). Production-сервер `react-router-serve` рендерит каждый URL на
сервере и отдаёт готовый HTML с `<title>`, meta, Open Graph, canonical
и JSON-LD. То же, что делает Next.js — только без миграции.

## Версии (на момент написания)

| Пакет                 | Версия | Что делает                                               |
| --------------------- | ------ | -------------------------------------------------------- |
| `react`               | 19.2   | UI                                                       |
| `react-router`        | 7.12   | роутинг + SSR (нет `react-router-dom`, она тут не нужна) |
| `@react-router/serve` | 7.12   | production-сервер                                        |
| `vite`                | 7.1    | dev-сервер + production build                            |
| Prisma                | 5.22   | ORM поверх PostgreSQL 16                                 |

## Где включён SSR

`react-router.config.ts`:

```ts
export default {
    ssr: true,
} satisfies Config;
```

Один флаг — и каждая страница рендерится на сервере перед отправкой
браузеру. Чистый SPA получился бы при `ssr: false`.

## Как проверить, что SSR живой

Если когда-то снова закрадётся сомнение — одна команда отвечает на
вопрос:

```powershell
curl https://saleid.icu | Select-String "og:title|canonical|application/ld\+json" -Context 0,1
```

В ответе должно быть:

- `<link rel="canonical" href="https://saleid.icu">`
- `<meta property="og:title" content="MIND BODY — Спортивний одяг">`
- `<script type="application/ld+json">{"@type":"Organization", ...}</script>`

Если эти строки есть в `curl`-output (то есть до выполнения JS) —
значит сервер уже отдаёт их в HTML, и Google их видит сразу.

На PDP (`/product/<id>`) дополнительно отдаётся **Product JSON-LD** с
ценой, валютой UAH, availability и breadcrumbs. На `/shop/<category>`
— **CollectionPage** с ItemList первых десяти товаров.

## Что у нас уже покрыто для SEO

| Возможность                                         | Где                                              |
| --------------------------------------------------- | ------------------------------------------------ |
| SSR с готовым HTML                                  | `react-router.config.ts` + `@react-router/serve` |
| Динамический `sitemap.xml` со всеми active товарами | `app/routes/sitemap[.]xml.tsx`                   |
| `robots.txt` с правильным sitemap                   | `public/robots.txt`                              |
| Meta + Open Graph + canonical                       | `MetaFunction<typeof loader>` в каждом роуте     |
| `og:image:width` / `og:image:height`                | home, about, product, category                   |
| Organization JSON-LD                                | `app/routes/home.tsx`                            |
| BreadcrumbList JSON-LD                              | category и product роуты                         |
| Product JSON-LD (price/currency/availability)       | `app/routes/product.$id.tsx`                     |
| CollectionPage + ItemList JSON-LD                   | `app/routes/shop.$category.tsx`                  |

## Когда стоит мигрировать на Next.js

Сейчас триггера нет. Пересмотрим, если появится **хотя бы один**:

1. Каталог вырос до 10k+ товаров и **LCP > 3 секунд** на PDP/категориях
   (тогда ISR Next.js даст ощутимый выигрыш — у нас же сейчас live SSR
   на каждый запрос и этого хватает).
2. Решили хостить на Vercel и не хочется поддерживать собственный
   Caddy/PM2 стек (но мы их уже знаем и контролируем).
3. Команда выросла и нанимать React Router 7 разработчиков
   объективно сложнее, чем Next.js.
4. **Конкретные claim'ы от Google Search Console**, что страницы не
   индексируются — и расследование показало, что причина в нашем SSR,
   а не в чём-то ещё (robots, canonical, контенте).

Без этих триггеров миграция стоит ~2-3 недели + риск регрессий после
41+ коммитов стабилизации. Не оправдано.

## Что Next.js дал бы дополнительно

| Что обещает Next.js                       | Наша ситуация                                              |
| ----------------------------------------- | ---------------------------------------------------------- |
| SSR                                       | Уже есть                                                   |
| Meta / OG / canonical                     | Уже есть, типизировано через `MetaFunction<typeof loader>` |
| JSON-LD structured data                   | Уже есть везде где нужно                                   |
| Sitemap.xml                               | Уже есть (динамический, со всеми active товарами)          |
| Server-side data fetching                 | `loader()` функции, уже есть                               |
| File-based routing                        | Explicit в `app/routes.ts` — даже надёжнее                 |
| Code splitting                            | Vite делает автоматом                                      |
| **`next/image`**                          | Реальная разница. Мы используем `sharp` вручную.           |
| **ISR** (Incremental Static Regeneration) | Не критично пока ~50 товаров                               |
| **Vercel auto-deploy**                    | Self-hosted VPS — осознанный выбор, больше контроля        |
| **Большая экосистема, легче нанимать**    | Реальное, но не блокирующее                                |

## История

- Стек выбран осознанно в начале проекта: React Router 7 (Remix-наследник)
  даёт SSR из коробки + типизированные `loader()`/`action()` без
  отдельного бэкенда.
- В мае 2026 был аудит после вопроса "может, перейти на Next.js?".
  Вывод: не нужно. Этот документ — память об аудите.
