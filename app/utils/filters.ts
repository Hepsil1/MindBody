export const DEFAULT_FILTER_CONFIG = {
    categories: {
        "jumpsuit": "Комбінезони",
        "leggings": "Легінси",
        "tops": "Топи",
        "shorts": "Шорти",
        "jackets": "Куртки",
        "sets": "Комплекти"
    },
    colors: {
        'black': 'Чорний',
        'white': 'Білий',
        'blue': 'Синій',
        'pink': 'Рожевий',
        'green': 'Зелений',
        'gray': 'Сірий',
        'red': 'Червоний',
        'other': 'Інші'
    },
    sizes: ["XS", "S", "M", "L", "XL"],
    priceRanges: [
        { id: 'low', label: 'До 1000 ₴', min: 0, max: 1000 },
        { id: 'mid', label: '1000 - 3000 ₴', min: 1000, max: 3000 },
        { id: 'high', label: '3000 - 5000 ₴', min: 3000, max: 5000 },
        { id: 'premium', label: 'Від 5000 ₴', min: 5000, max: 999999 }
    ]
};

// Helper function to safely merge a database filter config string with the defaults
export function parseAndMergeFilterConfig(dbConfigString: string | null | undefined) {
    let parsedConfig = {};
    if (dbConfigString) {
        try {
            parsedConfig = JSON.parse(dbConfigString);
        } catch (e) {
            console.error("Failed to parse DB FilterConfig", e);
        }
    }

    return {
        ...DEFAULT_FILTER_CONFIG,
        ...parsedConfig,
        // Ensure deeply nested objects also fallback if missing
        categories: (parsedConfig as any).categories || DEFAULT_FILTER_CONFIG.categories,
        colors: (parsedConfig as any).colors || DEFAULT_FILTER_CONFIG.colors,
        sizes: (parsedConfig as any).sizes || DEFAULT_FILTER_CONFIG.sizes,
        priceRanges: (parsedConfig as any).priceRanges || DEFAULT_FILTER_CONFIG.priceRanges
    };
}
