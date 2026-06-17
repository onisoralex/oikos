import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2e7d32" },   // green — home/nature
    secondary: { main: "#ff8f00" }, // amber
  },
  typography: {
    fontFamily: "\"Inter\", \"Roboto\", \"Helvetica\", \"Arial\", sans-serif",
  },
  components: {
    MuiBottomNavigation: {
      styleOverrides: { root: { borderTop: "1px solid rgba(0,0,0,0.12)" } },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#2e7d32" },
    secondary: { main: "#ff8f00" },
  },
  typography: {
    fontFamily: "\"Inter\", \"Roboto\", \"Helvetica\", \"Arial\", sans-serif",
  },
  components: {
    MuiBottomNavigation: {
      styleOverrides: { root: { borderTop: "1px solid rgba(255,255,255,0.12)" } },
    },
  },
});
