// One-shot conflict resolution between agent part files (2026-06-11).
// Context keys ("X@@ctx") pair with the matching t() call-site edits.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "ui-strings");
const load = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const save = (f, o) => writeFileSync(join(dir, f), JSON.stringify(o, null, 4) + "\n", "utf8");

// 1. footer-cart: drawer CTA gets its own contextual key
const fc = load("components-footer-cart.json");
delete fc["Оформити замовлення"];
fc["Оформити замовлення@@drawer"] = { en: "Checkout", ru: "Оформить заказ" };
save("components-footer-cart.json", fc);

// 2. checkout: totals "Доставка" -> contextual; unify shared phrases
const co = load("route-checkout.json");
delete co["Доставка"];
co["Доставка@@totals"] = { en: "Shipping", ru: "Доставка" };
co["Доставка Новою Поштою 1-3 дні"] = {
    en: "Nova Poshta delivery, 1-3 days",
    ru: "Доставка Новой Почтой 1-3 дня",
};
co["Перейти до каталогу"] = { en: "Browse the catalog", ru: "Перейти в каталог" };
save("route-checkout.json", co);

// 3. pdp: unify NP delivery line (base "Доставка" = "Delivery" stays here)
const pdp = load("route-pdp.json");
pdp["Доставка Новою Поштою 1-3 дні"] = {
    en: "Nova Poshta delivery, 1-3 days",
    ru: "Доставка Новой Почтой 1-3 дня",
};
save("route-pdp.json", pdp);

// 4. profile: tab -> contextual "Orders"; drop its Скасувати vote
const pr = load("route-profile.json");
delete pr["Замовлення"];
pr["Замовлення@@tab"] = { en: "Orders", ru: "Заказы" };
delete pr["Скасувати"];
pr["Перейти до каталогу"] = { en: "Browse the catalog", ru: "Перейти в каталог" };
save("route-profile.json", pr);

// 5. wishlist-search: contextual undo/list/empty
const ws = load("route-wishlist-search.json");
delete ws["Скасувати"];
ws["Скасувати@@undo"] = { en: "Undo", ru: "Отменить" };
delete ws["у списку"];
ws["у списку@@wishlist"] = { en: "in your list", ru: "в списке" };
delete ws["порожній"];
ws["порожній@@wishlist"] = { en: "empty", ru: "пуст" };
ws["Перейти до каталогу"] = { en: "Browse the catalog", ru: "Перейти в каталог" };
save("route-wishlist-search.json", ws);

console.info("part files updated");
