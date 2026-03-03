import { prisma } from "../db.server";

export async function loader() {
    try {
        // Get sample product with inventory data
        const products: any[] = await prisma.$queryRawUnsafe(
            `SELECT id, name, stock, inventory FROM Product LIMIT 2`
        );

        // Get DB schema
        const schema: any[] = await prisma.$queryRawUnsafe(
            `PRAGMA table_info(Product)`
        );

        // Test order creation steps
        let testResults: any = {};

        try {
            const customers = await prisma.customer.findMany({ take: 1 });
            testResults.customerCheck = customers.length > 0 ? "OK" : "No customers";
        } catch (e: any) {
            testResults.customerCheck = e.message;
        }

        try {
            const orders = await prisma.order.findMany({ take: 1 });
            testResults.orderCheck = "OK - can read orders";
        } catch (e: any) {
            testResults.orderCheck = e.message;
        }

        return new Response(JSON.stringify({
            products,
            inventorySample: products[0]?.inventory,
            inventoryParsed: products[0]?.inventory ? JSON.parse(products[0].inventory) : null,
            schema: schema.map((c: any) => c.name),
            testResults
        }, null, 2), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
