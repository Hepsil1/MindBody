import { describe, it, expect, beforeEach } from "vitest";
import {
    validateEmail,
    validatePassword,
    AuthUtils,
    type UserSettings,
} from "../../app/utils/auth";

// Clean storage between tests so each one starts from a known state.
// happy-dom provides full window.sessionStorage / localStorage APIs.
beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
});

describe("validateEmail", () => {
    it("accepts standard emails", () => {
        expect(validateEmail("user@example.com")).toBe(true);
        expect(validateEmail("a.b@x.co.uk")).toBe(true);
        expect(validateEmail("name+tag@domain.org")).toBe(true);
    });

    it("rejects missing @", () => {
        expect(validateEmail("noatsign.com")).toBe(false);
    });

    it("rejects missing domain part", () => {
        expect(validateEmail("user@")).toBe(false);
    });

    it("rejects missing TLD", () => {
        // regex requires "x.y" after @, so bare-host should fail
        expect(validateEmail("user@nodomain")).toBe(false);
    });

    it("rejects whitespace in email", () => {
        expect(validateEmail("user @example.com")).toBe(false);
        expect(validateEmail("user@ex ample.com")).toBe(false);
    });

    it("rejects empty string", () => {
        expect(validateEmail("")).toBe(false);
    });
});

describe("validatePassword", () => {
    it("accepts password with 6+ chars and at least one digit", () => {
        const res = validatePassword("abc123");
        expect(res.valid).toBe(true);
        expect(res.message).toBe("");
    });

    it("rejects password shorter than 6 chars", () => {
        const res = validatePassword("ab12");
        expect(res.valid).toBe(false);
        expect(res.message).toBe("Пароль має бути мінімум 6 символів");
    });

    it("rejects password without any digit", () => {
        const res = validatePassword("abcdef");
        expect(res.valid).toBe(false);
        expect(res.message).toBe("Пароль має містити хоча б одну цифру");
    });

    it("accepts long strong password", () => {
        expect(validatePassword("MySecurePass1234!").valid).toBe(true);
    });
});

describe("AuthUtils.getAuthState", () => {
    it("returns unauthenticated when sessionStorage is empty", () => {
        const state = AuthUtils.getAuthState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
    });

    it("returns authenticated when session contains valid JSON", () => {
        const user = {
            id: "u-1",
            name: "Test",
            email: "test@x.com",
            createdAt: new Date().toISOString(),
            provider: "email" as const,
        };
        sessionStorage.setItem("auth_user", JSON.stringify(user));

        const state = AuthUtils.getAuthState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.user?.email).toBe("test@x.com");
    });

    it("falls back to unauthenticated on malformed JSON in session", () => {
        sessionStorage.setItem("auth_user", "{not-valid-json");
        const state = AuthUtils.getAuthState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
    });
});

describe("AuthUtils.logout", () => {
    it("removes the auth_user session entry", async () => {
        sessionStorage.setItem("auth_user", JSON.stringify({ id: "u-1" }));
        await AuthUtils.logout();
        expect(sessionStorage.getItem("auth_user")).toBeNull();
    });
});

describe("AuthUtils.updateProfile", () => {
    it("merges updates into the cached user", () => {
        const initial = {
            id: "u-1",
            name: "Old Name",
            email: "u@x.com",
            createdAt: new Date().toISOString(),
            provider: "email" as const,
        };
        sessionStorage.setItem("auth_user", JSON.stringify(initial));

        const result = AuthUtils.updateProfile({ name: "New Name", phone: "+380501112233" });
        expect(result.success).toBe(true);
        expect(result.user?.name).toBe("New Name");
        expect(result.user?.phone).toBe("+380501112233");
        expect(result.user?.email).toBe("u@x.com"); // unchanged
    });

    it("returns success=false when no user is logged in", () => {
        const result = AuthUtils.updateProfile({ name: "Whatever" });
        expect(result.success).toBe(false);
    });
});

describe("AuthUtils.addresses CRUD", () => {
    it("starts with empty addresses", () => {
        expect(AuthUtils.getAddresses()).toEqual([]);
    });

    it("saves an address with a generated id", () => {
        const saved = AuthUtils.saveAddress({
            label: "Home",
            city: "Kyiv",
            warehouse: "Branch 1",
            isDefault: false,
        });
        expect(saved.id).toMatch(/^addr_/);
        expect(saved.label).toBe("Home");
        expect(AuthUtils.getAddresses()).toHaveLength(1);
    });

    it("setting a new default unsets the previous default", () => {
        AuthUtils.saveAddress({
            label: "Home",
            city: "Kyiv",
            warehouse: "Branch 1",
            isDefault: true,
        });
        AuthUtils.saveAddress({
            label: "Work",
            city: "Lviv",
            warehouse: "Branch 99",
            isDefault: true,
        });

        const addrs = AuthUtils.getAddresses();
        expect(addrs).toHaveLength(2);
        const defaults = addrs.filter((a) => a.isDefault);
        expect(defaults).toHaveLength(1);
        expect(defaults[0].label).toBe("Work");
    });

    it("deletes by id", () => {
        const a = AuthUtils.saveAddress({
            label: "A",
            city: "C1",
            warehouse: "W1",
            isDefault: false,
        });
        AuthUtils.saveAddress({
            label: "B",
            city: "C2",
            warehouse: "W2",
            isDefault: false,
        });
        AuthUtils.deleteAddress(a.id);
        const remaining = AuthUtils.getAddresses();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].label).toBe("B");
    });
});

describe("AuthUtils.settings", () => {
    it("returns sensible defaults when nothing is stored", () => {
        const s = AuthUtils.getSettings();
        expect(s.language).toBe("uk");
        expect(s.theme).toBe("light");
        expect(s.notifications.email).toBe(true);
    });

    it("round-trips settings through localStorage", () => {
        const next: UserSettings = {
            notifications: { email: false, sms: true, promotions: false },
            language: "en",
            theme: "dark",
        };
        AuthUtils.saveSettings(next);
        expect(AuthUtils.getSettings()).toEqual(next);
    });
});

describe("AuthUtils.subscribeToAuth", () => {
    it("invokes the callback on the AUTH_CHANGED event and unsubscribes cleanly", () => {
        let calls = 0;
        const unsub = AuthUtils.subscribeToAuth(() => {
            calls += 1;
        });

        window.dispatchEvent(new Event("auth-changed"));
        window.dispatchEvent(new Event("auth-changed"));
        expect(calls).toBe(2);

        unsub();
        window.dispatchEvent(new Event("auth-changed"));
        expect(calls).toBe(2); // unchanged after unsubscribe
    });
});
