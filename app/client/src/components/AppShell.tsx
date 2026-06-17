import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import KitchenIcon from "@mui/icons-material/Kitchen";
import LocalDiningIcon from "@mui/icons-material/LocalDining";
import YardIcon from "@mui/icons-material/Yard";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { useThemeStore } from "../store/themeStore";

const BOTTOM_NAV_HEIGHT = 56;
const SIDEBAR_WIDTH = 220;

// Nav items — only Pantry is active in Phase 1; others are placeholders
const navItems = [
  { label: "Pantry", path: "/pantry", icon: <KitchenIcon /> },
  { label: "Kitchen", path: "/kitchen", icon: <LocalDiningIcon />, disabled: true },
  { label: "Plants", path: "/plants", icon: <YardIcon />, disabled: true },
  { label: "Finance", path: "/finance", icon: <AccountBalanceWalletIcon />, disabled: true },
];

interface AppShellProps {
  children: ReactNode;
}

const AppShell = ({ children }: AppShellProps) => {
  const theme = useTheme();
  const isSidebar = useMediaQuery(theme.breakpoints.up("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const { dark, toggle } = useThemeStore();

  // Determine which nav item is active based on pathname prefix
  const activeIndex = navItems.findIndex((item) => location.pathname.startsWith(item.path));
  const [mobileNavValue, setMobileNavValue] = useState(activeIndex === -1 ? 0 : activeIndex);

  const handleNavChange = (_: React.SyntheticEvent, newValue: number) => {
    const item = navItems[newValue];
    if (item && !item.disabled) {
      setMobileNavValue(newValue);
      navigate(item.path);
    }
  };

  const sidebarContent = (
    <Box sx={{ width: SIDEBAR_WIDTH, pt: 1 }}>
      <List>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={location.pathname.startsWith(item.path)}
            disabled={item.disabled}
            onClick={() => navigate(item.path)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top app bar */}
      {/* zIndex must exceed Drawer's default so the bar renders above the permanent sidebar */}
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            Oikos
          </Typography>
          <IconButton color="inherit" onClick={toggle} aria-label="toggle dark mode">
            {dark ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 1, mt: "64px" /* AppBar height */ }}>
        {/* Permanent sidebar on md+ */}
        {isSidebar && (
          <Drawer
            variant="permanent"
            sx={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              "& .MuiDrawer-paper": {
                width: SIDEBAR_WIDTH,
                boxSizing: "border-box",
                top: "64px", // below AppBar
                height: "calc(100% - 64px)",
              },
            }}
          >
            {sidebarContent}
          </Drawer>
        )}

        {/* Main content */}
        <Box
          component="main"
          sx={{
            flex: 1,
            p: "var(--sp-page)",
            // On mobile, leave room for bottom nav
            pb: isSidebar ? "var(--sp-page)" : `calc(var(--sp-page) + ${BOTTOM_NAV_HEIGHT}px)`,
            minWidth: 0, // flex child won't shrink below content width without this
          }}
        >
          {children}
        </Box>
      </Box>

      {/* Bottom navigation on xs/sm */}
      {!isSidebar && (
        <BottomNavigation
          value={mobileNavValue}
          onChange={handleNavChange}
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (t) => t.zIndex.appBar,
          }}
        >
          {navItems.map((item) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={item.icon}
              disabled={item.disabled}
            />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
};

export default AppShell;
