import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme, darkTheme } from "./theme";
import { useThemeStore } from "./store/themeStore";
import { useAuthStore } from "./store/authStore";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import PantryOverviewPage from "./pages/Pantry/PantryOverviewPage";
import ScanPage from "./pages/Pantry/ScanPage";
import AddEditItemPage from "./pages/Pantry/AddEditItemPage";
import ProductDetailPage from "./pages/Pantry/ProductDetailPage";
import type { ReactNode } from "react";

// Route guard — redirects to /login if not authenticated
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <AppShell>{children}</AppShell>;
};

const App = () => {
  const { dark } = useThemeStore();

  // Restore data-theme attribute from persisted store value on initial mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <ThemeProvider theme={dark ? darkTheme : theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes — all wrapped in AppShell via ProtectedRoute */}
          <Route path="/" element={<Navigate to="/pantry" replace />} />
          <Route
            path="/pantry"
            element={
              <ProtectedRoute>
                <PantryOverviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pantry/scan"
            element={
              <ProtectedRoute>
                <ScanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pantry/items/new"
            element={
              <ProtectedRoute>
                <AddEditItemPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pantry/items/:id/edit"
            element={
              <ProtectedRoute>
                <AddEditItemPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pantry/products/:id"
            element={
              <ProtectedRoute>
                <ProductDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/pantry" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
