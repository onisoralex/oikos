import { createServer } from "vite";
import app from "./app.js";
import { PORT, NODE_ENV } from "./config.js";

const startServer = async () => {
  if (NODE_ENV === "development") {
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const { resolve } = await import("path");
    const { fileURLToPath } = await import("url");
    const __dirname = fileURLToPath(new URL(".", import.meta.url));
    const { default: expressStatic } = await import("express");
    const distPath = resolve(__dirname, "../../client/dist");
    app.use(expressStatic.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`Oikos running on port ${PORT}`);
  });
};

startServer();
