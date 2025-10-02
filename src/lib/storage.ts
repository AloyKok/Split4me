import type { Item, Person, PreferencesState } from "@/types";

interface PersistedState {
  preferences: PreferencesState;
  persons: Person[];
  items: Item[];
}

const STORAGE_KEY = "split-sgmy:v2";

export const loadPersistedState = (): PersistedState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch (error) {
    console.warn("Failed to load saved state", error);
    return null;
  }
};

export const savePersistedState = (state: PersistedState) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to persist state", error);
  }
};

export const clearPersistedState = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
};
