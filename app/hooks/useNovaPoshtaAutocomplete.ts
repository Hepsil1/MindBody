import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "./useDebounce";
import { useClickOutside } from "./useClickOutside";

const NOVA_POSHTA_API_ROUTE = "/api/novaposhta";
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export interface NovaPoshtaCity {
    Ref: string;
    Description: string;
    AreaDescription: string;
}

export interface NovaPoshtaWarehouse {
    Ref: string;
    Description: string;
    Number: string;
    ShortAddress: string;
}

interface NovaPoshtaResponse<T> {
    success: boolean;
    data?: T[];
    error?: string;
}

interface UseNovaPoshtaAutocompleteOptions {
    /**
     * Disables the entire hook (no API calls, no dropdowns) — pass false
     * when the user picked a different delivery service.
     */
    enabled: boolean;
    /** Currently-selected city ref. Drives the warehouse fetch. */
    cityRef: string;
    onCitySelect: (city: NovaPoshtaCity) => void;
    onWarehouseSelect: (warehouse: NovaPoshtaWarehouse) => void;
}

/**
 * All the Nova Poshta autocomplete state and side-effects extracted from
 * checkout.tsx — cities + warehouses, debounced API calls, dropdown
 * visibility, click-outside handling, and ref containers the parent
 * needs to wire onto its DOM.
 *
 * checkout.tsx used to do all of this inline across ~170 lines + 10
 * useState declarations. This hook keeps it in one cohesive place.
 */
export function useNovaPoshtaAutocomplete({
    enabled,
    cityRef,
    onCitySelect,
    onWarehouseSelect,
}: UseNovaPoshtaAutocompleteOptions) {
    const [cities, setCities] = useState<NovaPoshtaCity[]>([]);
    const [warehouses, setWarehouses] = useState<NovaPoshtaWarehouse[]>([]);
    const [citySearch, setCitySearch] = useState("");
    const [warehouseSearch, setWarehouseSearch] = useState("");
    const [showCitiesDropdown, setShowCitiesDropdown] = useState(false);
    const [showWarehousesDropdown, setShowWarehousesDropdown] = useState(false);
    const [isLoadingCities, setIsLoadingCities] = useState(false);
    const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);

    const cityAutocompleteRef = useRef<HTMLDivElement>(null);
    const warehouseAutocompleteRef = useRef<HTMLDivElement>(null);

    // Server proxy keeps the Nova Poshta API key out of client JS and
    // sidesteps their CORS configuration. The action discriminator is
    // sent as a multipart form field — see app/routes/api.novaposhta.tsx.
    const searchCities = useCallback(async (query: string) => {
        if (query.length < MIN_QUERY_LENGTH) {
            setCities([]);
            return;
        }
        setIsLoadingCities(true);
        try {
            const formData = new FormData();
            formData.append("action", "searchCities");
            formData.append("query", query);
            const response = await fetch(NOVA_POSHTA_API_ROUTE, {
                method: "POST",
                body: formData,
            });
            const data = (await response.json()) as NovaPoshtaResponse<NovaPoshtaCity>;
            if (data.success) {
                setCities(data.data ?? []);
                setShowCitiesDropdown(true);
            } else {
                console.error("Nova Poshta API error:", data.error);
                setCities([]);
            }
        } catch (error) {
            console.error("Nova Poshta API error:", error);
            setCities([]);
        } finally {
            setIsLoadingCities(false);
        }
    }, []);

    const searchWarehouses = useCallback(async (selectedCityRef: string, query = "") => {
        if (!selectedCityRef) {
            setWarehouses([]);
            return;
        }
        setIsLoadingWarehouses(true);
        try {
            const formData = new FormData();
            formData.append("action", "getWarehouses");
            formData.append("cityRef", selectedCityRef);
            formData.append("query", query);
            const response = await fetch(NOVA_POSHTA_API_ROUTE, {
                method: "POST",
                body: formData,
            });
            const data = (await response.json()) as NovaPoshtaResponse<NovaPoshtaWarehouse>;
            if (data.success) {
                setWarehouses(data.data ?? []);
                setShowWarehousesDropdown(true);
            } else {
                console.error("Nova Poshta API error:", data.error);
                setWarehouses([]);
            }
        } catch (error) {
            console.error("Nova Poshta API error:", error);
            setWarehouses([]);
        } finally {
            setIsLoadingWarehouses(false);
        }
    }, []);

    // Debounce user typing so each keystroke doesn't fire a request.
    const debouncedCitySearch = useDebounce(citySearch, DEBOUNCE_MS);
    const debouncedWarehouseSearch = useDebounce(warehouseSearch, DEBOUNCE_MS);

    useEffect(() => {
        if (!enabled) return;
        if (debouncedCitySearch) searchCities(debouncedCitySearch);
    }, [debouncedCitySearch, enabled, searchCities]);

    useEffect(() => {
        if (!enabled) return;
        if (cityRef) searchWarehouses(cityRef, debouncedWarehouseSearch);
    }, [debouncedWarehouseSearch, cityRef, enabled, searchWarehouses]);

    // Close dropdowns when the user clicks outside both autocomplete
    // containers (label/input + the dropdown panel below it).
    useClickOutside(
        [cityAutocompleteRef],
        useCallback(() => setShowCitiesDropdown(false), []),
    );
    useClickOutside(
        [warehouseAutocompleteRef],
        useCallback(() => setShowWarehousesDropdown(false), []),
    );

    const selectCity = useCallback(
        (city: NovaPoshtaCity) => {
            onCitySelect(city);
            setCitySearch(city.Description);
            setShowCitiesDropdown(false);
            setWarehouses([]);
            // Pre-fetch warehouses immediately so the user doesn't wait
            // for the next debounce tick after picking a city.
            searchWarehouses(city.Ref);
        },
        [onCitySelect, searchWarehouses],
    );

    const selectWarehouse = useCallback(
        (warehouse: NovaPoshtaWarehouse) => {
            onWarehouseSelect(warehouse);
            setWarehouseSearch(warehouse.Description);
            setShowWarehousesDropdown(false);
        },
        [onWarehouseSelect],
    );

    return {
        cities,
        warehouses,
        citySearch,
        setCitySearch,
        warehouseSearch,
        setWarehouseSearch,
        showCitiesDropdown,
        setShowCitiesDropdown,
        showWarehousesDropdown,
        setShowWarehousesDropdown,
        isLoadingCities,
        isLoadingWarehouses,
        cityAutocompleteRef,
        warehouseAutocompleteRef,
        selectCity,
        selectWarehouse,
    };
}
