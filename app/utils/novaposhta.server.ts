// Nova Poshta API v2.0 Server Utility
// Documentation: https://developers.novaposhta.ua/
//
// ⚠️ IMPORTANT: YOU NEED YOUR OWN API KEY!
//
// HOW TO GET YOUR API KEY:
// 1. Register at https://my.novaposhta.ua/
// 2. Go to Settings → Security → API Keys (Налаштування → Безпека → Ключі API)
// 3. Create a new API key (Створити ключ)
// 4. Set it as environment variable NOVA_POSHTA_API_KEY
//    or replace the placeholder below
//
// Without a valid API key, the city and warehouse search will NOT work!

const NOVA_POSHTA_API_URL = "https://api.novaposhta.ua/v2.0/json/";

// ⚠️ REPLACE THIS WITH YOUR ACTUAL API KEY!
// Get your key from: https://my.novaposhta.ua/ → Settings → Security → API Keys
const NOVA_POSHTA_API_KEY = process.env.NOVA_POSHTA_API_KEY || "0aea11be1cc857201c8f4063e1b3a7a9";

export interface NovaPoshtaCity {
    Ref: string;
    Description: string;
    DescriptionRu: string;
    AreaDescription: string;
    AreaDescriptionRu: string;
    SettlementType: string;
    SettlementTypeDescription: string;
}

export interface NovaPoshtaWarehouse {
    Ref: string;
    Description: string;
    DescriptionRu: string;
    ShortAddress: string;
    ShortAddressRu: string;
    Number: string;
    TypeOfWarehouse: string;
    CityRef: string;
    CityDescription: string;
    SettlementAreaDescription: string;
}

export interface NovaPoshtaResponse<T> {
    success: boolean;
    data: T[];
    errors: string[];
    warnings: string[];
    info: {
        totalCount: number;
    };
}

async function makeNovaPoshtaRequest<T>(
    modelName: string,
    calledMethod: string,
    methodProperties: Record<string, unknown>
): Promise<NovaPoshtaResponse<T>> {
    // Check if API key is configured
    if (!NOVA_POSHTA_API_KEY || NOVA_POSHTA_API_KEY === "YOUR_API_KEY_HERE") {
        console.error('Nova Poshta API key is not configured! Please add your API key to app/utils/novaposhta.server.ts');
        return {
            success: false,
            data: [],
            errors: ['API key not configured. Please set NOVA_POSHTA_API_KEY environment variable or update novaposhta.server.ts'],
            warnings: [],
            info: { totalCount: 0 },
        };
    }

    try {
        const response = await fetch(NOVA_POSHTA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: NOVA_POSHTA_API_KEY,
                modelName,
                calledMethod,
                methodProperties,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json() as NovaPoshtaResponse<T>;

        // Log errors from Nova Poshta API for debugging
        if (!result.success && result.errors && result.errors.length > 0) {
            console.error('Nova Poshta API returned errors:', result.errors);
        }

        return result;
    } catch (error) {
        console.error('Nova Poshta API error:', error);
        return {
            success: false,
            data: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            warnings: [],
            info: { totalCount: 0 },
        };
    }
}

export async function searchCities(query: string, limit: number = 20): Promise<NovaPoshtaCity[]> {
    if (!query || query.length < 2) {
        return [];
    }

    const response = await makeNovaPoshtaRequest<NovaPoshtaCity>(
        'Address',
        'getCities',
        {
            FindByString: query,
            Limit: String(limit),
        }
    );

    return response.success ? response.data : [];
}

export async function getWarehouses(
    cityRef: string,
    searchQuery: string = '',
    limit: number = 50
): Promise<NovaPoshtaWarehouse[]> {
    if (!cityRef) {
        return [];
    }

    const methodProperties: Record<string, unknown> = {
        CityRef: cityRef,
        Limit: String(limit),
    };

    if (searchQuery) {
        methodProperties.FindByString = searchQuery;
    }

    const response = await makeNovaPoshtaRequest<NovaPoshtaWarehouse>(
        'Address',
        'getWarehouses',
        methodProperties
    );

    return response.success ? response.data : [];
}

export async function searchSettlements(query: string, limit: number = 20) {
    if (!query || query.length < 2) {
        return [];
    }

    const response = await makeNovaPoshtaRequest<NovaPoshtaCity>(
        'Address',
        'searchSettlements',
        {
            CityName: query,
            Limit: String(limit),
        }
    );

    return response.success ? response.data : [];
}
