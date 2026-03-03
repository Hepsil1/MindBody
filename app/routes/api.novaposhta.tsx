// Nova Poshta API Route
// This is a "resource route" - it has no UI component, only handles API requests

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { searchCities, getWarehouses } from "../utils/novaposhta.server";

// Handle POST requests for city/warehouse search
export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const actionType = formData.get("action") as string;

    try {
        if (actionType === "searchCities") {
            const query = formData.get("query") as string;
            const cities = await searchCities(query);
            return Response.json({ success: true, data: cities });
        }

        if (actionType === "getWarehouses") {
            const cityRef = formData.get("cityRef") as string;
            const query = formData.get("query") as string || "";
            const warehouses = await getWarehouses(cityRef, query);
            return Response.json({ success: true, data: warehouses });
        }

        return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
    } catch (error) {
        console.error("Nova Poshta API error:", error);
        return Response.json(
            { success: false, error: "API request failed" },
            { status: 500 }
        );
    }
}

// Handle GET requests (for testing)
export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const actionType = url.searchParams.get("action");

    if (actionType === "searchCities") {
        const query = url.searchParams.get("query") || "";
        const cities = await searchCities(query);
        return Response.json({ success: true, data: cities });
    }

    if (actionType === "getWarehouses") {
        const cityRef = url.searchParams.get("cityRef") || "";
        const query = url.searchParams.get("query") || "";
        const warehouses = await getWarehouses(cityRef, query);
        return Response.json({ success: true, data: warehouses });
    }

    return Response.json({
        success: false,
        message: "Nova Poshta API endpoint. Use POST with action=searchCities or action=getWarehouses"
    });
}
