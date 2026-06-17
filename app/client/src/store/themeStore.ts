import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeStore {
  dark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      dark: false,
      toggle: () =>
        set((s) => {
          const next = !s.dark;
          // Also set the attribute here (not only in the App.tsx effect) so that
          // subsequent toggles during a session update CSS vars immediately.
          document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
          return { dark: next };
        }),
    }),
    { name: "oikos-theme" },
  ),
);
