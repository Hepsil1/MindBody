import { describe, it, expect } from "vitest";
import { publishBlockers } from "../../app/utils/productQuality";

// yoga/leggings offers fabrics ["sport","cotton"] and no sleeves (see taxonomy).
const complete = {
    price: 1000,
    imagesCount: 1,
    category: "leggings",
    shopPageSlug: "yoga",
    stock: 5,
    fabric: "sport",
    sleeve: "",
};

describe("product publish quality gate", () => {
    it("a complete product (with the required fabric) has no blockers", () => {
        expect(publishBlockers(complete)).toEqual([]);
    });

    it("flags every missing core field", () => {
        const b = publishBlockers({
            price: 0,
            imagesCount: 0,
            category: "",
            shopPageSlug: "",
            stock: 0,
            fabric: "",
            sleeve: "",
        });
        expect(b).toContain("Ціна вказана");
        expect(b).toContain("Є хоча б одне фото");
        expect(b).toContain("Обрана категорія");
        expect(b).toContain("Залишок більше 0");
    });

    it("requires fabric when the (shop, category) offers it", () => {
        expect(publishBlockers({ ...complete, fabric: "" })).toEqual(["Вказана тканина"]);
    });

    it("does not require fabric/sleeve when the category offers none", () => {
        expect(
            publishBlockers({
                price: 1000,
                imagesCount: 1,
                category: "anything",
                shopPageSlug: "",
                stock: 5,
                fabric: "",
                sleeve: "",
            }),
        ).toEqual([]);
    });

    it("zero stock blocks publication", () => {
        expect(publishBlockers({ ...complete, stock: 0 })).toEqual(["Залишок більше 0"]);
    });
});
