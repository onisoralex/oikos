import { create } from "zustand";

interface AuthStore {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  token: null,
  setToken: (token) => set({ token }),
  clearToken: () => set({ token: null }),
  // Returns true only if a token is currently held in memory.
  // No persist middleware — a page refresh clears the token and re-prompts login (intentional for this personal home server).
  isAuthenticated: () => get().token !== null,
}));
