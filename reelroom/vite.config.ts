import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiPlugin } from "./server/apiPlugin.ts";

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: { host: true, port: 5178 },
  preview: { host: true, port: 4178 },
});
