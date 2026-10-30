const memoryStorage = new Map<string, string>();

const getBrowserStorage = (): Storage | null => {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

export const readStorage = (key: string): string | null => {
    const storage = getBrowserStorage();

    try {
        return storage?.getItem(key) ?? memoryStorage.get(key) ?? null;
    } catch {
        return memoryStorage.get(key) ?? null;
    }
};

export const writeStorage = (key: string, value: string): void => {
    const storage = getBrowserStorage();

    try {
        storage?.setItem(key, value);
        if (storage) {
            return;
        }
    } catch {
        // Fall back to an in-memory copy when browser storage is unavailable.
    }

    memoryStorage.set(key, value);
};
